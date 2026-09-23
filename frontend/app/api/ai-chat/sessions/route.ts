import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MyLibUserAuth } from "@/lib/user-auth";
import { dbPrisma } from "@/lib/db";
import { isDemoUserId } from '@/lib/demo-policy';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';

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
  if (req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  if (!await allowAuthAttempt('ai-session-create', userId, req)) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  // Create conversation + creator participant + platform AI participant in a transaction
  const conversation = await dbPrisma.$transaction(async (tx) => {
    if (isDemoUserId(userId)) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`demo-chats:${userId}`}, 0))`;
      if (await tx.aiConversation.count({ where: { creatorId: userId } }) >= 5) return null;
    }
    const conv = await tx.aiConversation.create({
      data: {
        title: body.title,
        creatorId: userId,
        isPublic: isDemoUserId(userId) ? false : body.isPublic,
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
        aiModel: "gemini-2.5-flash-lite",
        byokUserId: null,
      },
    });

    return conv;
  });

  if (!conversation) return NextResponse.json({ error: 'DEMO_SESSION_LIMIT', message: 'Your demo already has five conversations. Open an existing chat.' }, { status: 429 });
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
      // Last message for the hover-expand preview on the AI home cards.
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, role: true },
      },
    },
  });

  // Flatten the single last message into a lightweight preview field.
  const shaped = sessions.map(({ messages, ...s }) => ({
    ...s,
    lastMessage: messages[0]
      ? {
          // Strip any HTML and clamp so the client gets a clean snippet.
          content: messages[0].content.replace(/<[^>]*>/g, "").slice(0, 240),
          role: messages[0].role,
        }
      : null,
  }));

  return NextResponse.json({
    sessions: shaped,
    nextCursor: shaped.length === limit ? shaped[shaped.length - 1]?.id : null,
  });
}
