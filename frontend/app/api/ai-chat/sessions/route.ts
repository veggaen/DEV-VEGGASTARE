import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MyLibUserAuth } from "@/lib/user-auth";
import { dbPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().trim().max(200).optional().default("New Chat"),
  isPublic: z.boolean().optional().default(false),
  triggerMode: z.enum(["MENTION", "DEBOUNCE", "ALL", "MANUAL"]).optional().default("MENTION"),
});

// POST — create a new AI conversation session
export async function POST(req: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const userId = session.id;

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    body = createSchema.parse({});
  }

  // Create conversation + creator participant + platform AI participant in a transaction
  const conversation = await dbPrisma.$transaction(async (tx) => {
    const conv = await tx.aiConversation.create({
      data: {
        title: body.title,
        creatorId: userId,
        isPublic: body.isPublic,
        triggerMode: body.triggerMode,
      },
    });

    // Add human participant (creator)
    await tx.aiConvParticipant.create({
      data: {
        conversationId: conv.id,
        type: "HUMAN",
        userId: userId,
        displayName: null,
      },
    });

    // Add platform AI participant (Gemini Flash)
    await tx.aiConvParticipant.create({
      data: {
        conversationId: conv.id,
        type: "AI_PLATFORM",
        userId: null,
        displayName: "Gemini",
        aiProvider: "GOOGLE",
        aiModel: "gemini-1.5-flash",
        byokUserId: null,
      },
    });

    return conv;
  });

  return NextResponse.json({ id: conversation.id, title: conversation.title }, { status: 201 });
}

// GET — list all sessions (same as the main route GET, kept here too for /sessions path)
export async function GET(req: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const userId = session.id;

  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10),
    100
  );
  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;

  const sessions = await dbPrisma.aiConversation.findMany({
    where: { creatorId: userId, isDeleted: false },
    orderBy: { updatedAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      isPublic: true,
      triggerMode: true,
      isSuspended: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({
    sessions,
    nextCursor: sessions.length === limit ? sessions[sessions.length - 1]?.id : null,
  });
}
