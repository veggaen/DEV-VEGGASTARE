import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MyLibUserAuth } from "@/lib/user-auth";
import { dbPrisma } from "@/lib/db";
import { detectSensitiveData } from "@/lib/ai-chat/safety";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
  userMessage: z.string().min(1).max(4000),
  assistantMessage: z.string().min(1).max(8000),
  modelUsed: z.string().max(100).optional().default("gemini-1.5-flash"),
  providerUsed: z.string().max(50).optional().default("GOOGLE"),
  tokenCount: z.number().int().min(0).optional(),
});

// GET — fetch messages for a session
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const conv = await dbPrisma.aiConversation.findUnique({
    where: { id: sessionId },
    select: { creatorId: true, isPublic: true, participants: { select: { userId: true } } },
  });
  if (!conv) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const isParticipant = conv.participants.some((p) => p.userId === session.id);
  if (!conv.isPublic && conv.creatorId !== session.id && !isParticipant) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "100", 10), 200);

  const messages = await dbPrisma.aiConvMessage.findMany({
    where: { conversationId: sessionId },
    orderBy: { createdAt: "asc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      reactions: true,
      participant: { select: { id: true, type: true, displayName: true, aiModel: true } },
    },
  });

  return NextResponse.json({
    messages,
    nextCursor: messages.length === limit ? messages[messages.length - 1]?.id : null,
  });
}

// POST — save a message pair (user + assistant) after streaming completes
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const conv = await dbPrisma.aiConversation.findUnique({
    where: { id: sessionId },
    select: {
      creatorId: true,
      isSuspended: true,
      isDeleted: true,
      participants: { select: { id: true, userId: true, type: true } },
    },
  });

  if (!conv) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (conv.isDeleted) return NextResponse.json({ error: "DELETED" }, { status: 410 });
  if (conv.isSuspended) return NextResponse.json({ error: "SUSPENDED" }, { status: 403 });
  if (conv.creatorId !== session.id) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  let body: z.infer<typeof saveSchema>;
  try {
    body = saveSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const humanParticipant = conv.participants.find((p) => p.userId === session.id && p.type === "HUMAN");
  const aiParticipant = conv.participants.find((p) => p.type === "AI_PLATFORM");

  if (!humanParticipant || !aiParticipant) {
    return NextResponse.json({ error: "MISSING_PARTICIPANTS" }, { status: 400 });
  }

  // Detect sensitive data in user message
  const sensitive = detectSensitiveData(body.userMessage);

  await dbPrisma.$transaction([
    // Save human message
    dbPrisma.aiConvMessage.create({
      data: {
        conversationId: sessionId,
        participantId: humanParticipant.id,
        content: body.userMessage,
        role: "user",
        senderType: "HUMAN",
        hasSensitiveData: sensitive.found,
        sensitiveTypes: sensitive.types,
      },
    }),
    // Save AI message
    dbPrisma.aiConvMessage.create({
      data: {
        conversationId: sessionId,
        participantId: aiParticipant.id,
        content: body.assistantMessage,
        role: "assistant",
        senderType: "AI_PLATFORM",
        modelUsed: body.modelUsed,
        providerUsed: body.providerUsed,
        tokenCount: body.tokenCount,
      },
    }),
    // Update conversation timestamp
    dbPrisma.aiConversation.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ success: true });
}
