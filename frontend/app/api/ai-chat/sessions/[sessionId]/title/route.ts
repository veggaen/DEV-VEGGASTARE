import { NextRequest, NextResponse } from "next/server";
import { MyLibUserAuth } from "@/lib/user-auth";
import { dbPrisma } from "@/lib/db";
import { getUserAiKeyForGeneration } from "@/lib/ai-key-store";
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

  // Resolve an API key: prefer the creator's BYOK Google key, else the platform key.
  let apiKey = "";
  try {
    const byok = await getUserAiKeyForGeneration({ userId: session.id, provider: "GOOGLE" });
    apiKey = byok?.apiKey ?? "";
  } catch {
    /* fall through to platform key */
  }
  if (!apiKey) apiKey = process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_AI_API_KEY ?? "";
  if (!apiKey) return NextResponse.json({ ok: false, reason: "no-key" });

  const prompt =
    "Generate a concise chat title (3–6 words, Title Case) summarizing this first message. " +
    "Reply with ONLY the title — no quotes, no punctuation at the end, no preamble.\n\n" +
    `Message: ${firstMessage.slice(0, 500)}`;

  let title = "";
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 24 },
      }),
    });
    if (!res.ok) return NextResponse.json({ ok: false, reason: "upstream" });
    const data = await res.json();
    title = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, reason: "fetch-failed" });
  }

  // Sanitize: strip wrapping quotes, collapse whitespace, clamp length.
  title = title.replace(/^["'`]+|["'`]+$/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  // Fallback: first few words of the message if the model returned nothing usable.
  if (!title) title = firstMessage.split(/\s+/).slice(0, 6).join(" ").slice(0, 80);
  if (!title) return NextResponse.json({ ok: false, reason: "empty" });

  const updated = await dbPrisma.aiConversation.update({
    where: { id: sessionId },
    data: { title },
    select: { title: true },
  });

  return NextResponse.json({ ok: true, title: updated.title });
}
