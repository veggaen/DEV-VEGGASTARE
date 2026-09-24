import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MyLibUserAuth } from "@/lib/user-auth";
import { dbPrisma } from "@/lib/db";
import { isDemoUserId } from '@/lib/demo-policy';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';
import { SessionListQuery } from '@/lib/ai-chat/session-list';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';

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
  const headers = { 'Cache-Control': 'private, no-store' };
  const rate = await checkRateLimit(getClientIdentifier(req, userId), 'read');
  if (!rate.success) return rateLimitedResponse(rate);
  const params = req.nextUrl.searchParams;
  const parsed = SessionListQuery.safeParse(Object.fromEntries(params));
  if (!parsed.success || new Set(params.keys()).size !== [...params.keys()].length) return NextResponse.json({ error: 'INVALID_QUERY' }, { status: 400, headers });
  const { limit, cursor, q, view } = parsed.data;
  const where = { creatorId: userId, isDeleted: false, ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}) };
  try {
  // Do not allow a cursor belonging to another user or outside the search scope.
  if (cursor && !await dbPrisma.aiConversation.findFirst({ where: { ...where, id: cursor }, select: { id: true } })) return NextResponse.json({ error: 'INVALID_CURSOR' }, { status: 400, headers });
  if (view === 'rail') {
    const rows = await dbPrisma.aiConversation.findMany({ where, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, title: true, updatedAt: true } });
    const sessions = rows.slice(0, limit);
    return NextResponse.json({ sessions, nextCursor: rows.length > limit ? sessions.at(-1)?.id ?? null : null }, { headers });
  }
  const sessions = await dbPrisma.aiConversation.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: 'desc' }],
    take: limit + 1,
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
  const shaped = sessions.slice(0, limit).map(({ messages, ...s }) => ({
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
    nextCursor: sessions.length > limit ? shaped.at(-1)?.id ?? null : null,
  }, { headers });
  } catch {
    return NextResponse.json({ error: 'CONVERSATIONS_UNAVAILABLE' }, { status: 503, headers });
  }
}
