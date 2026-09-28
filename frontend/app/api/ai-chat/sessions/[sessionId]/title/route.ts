import { NextRequest, NextResponse } from "next/server";
import { MyLibUserAuth } from "@/lib/user-auth";
import { dbPrisma } from "@/lib/db";
import { stripHtml } from "@/lib/ai-chat/safety";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const DEFAULT_TITLES = new Set(["new chat", "untitled", "untitled chat", ""]);

/**
 * POST /api/ai-chat/sessions/[sessionId]/title
 *
 * Auto-name a fresh conversation from its first user message — like ChatGPT /
 * t3.chat. Only runs while the title is still the default ("New Chat"); a custom
 * title is never overwritten. Best-effort: any failure returns ok:false without
 * disturbing the chat, so the client can fire-and-forget after the first send.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await MyLibUserAuth();
  if (!session?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (_req.headers.get('origin') !== _req.nextUrl.origin) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });

  const conv = await dbPrisma.aiConversation.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      title: true,
      creatorId: true,
      isDeleted: true,
      messages: {
        where: { role: "user" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { content: true },
      },
    },
  });

  if (!conv || conv.isDeleted) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (conv.creatorId !== session.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  // Respect a title the user (or a previous run) already set.
  if (!DEFAULT_TITLES.has((conv.title ?? "").trim().toLowerCase())) {
    return NextResponse.json({ ok: true, title: conv.title, skipped: "already-titled" });
  }
  const firstMessage = stripHtml(conv.messages[0]?.content ?? "").trim();
  if (!firstMessage) return NextResponse.json({ ok: false, reason: "no-message" });

  // Deterministic title: no hidden provider call or extra charge after sending.
  const title = firstMessage.replace(/\s+/g, ' ').split(' ').slice(0, 8).join(' ').slice(0, 80);


  const updated = await dbPrisma.aiConversation.update({
    where: { id: sessionId },
    data: { title },
    select: { title: true },
  });

  return NextResponse.json({ ok: true, title: updated.title });
}
