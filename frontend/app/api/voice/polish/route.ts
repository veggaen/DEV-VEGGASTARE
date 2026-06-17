import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MyLibUserAuth } from "@/lib/user-auth";
import { getUserAiKeyForGeneration } from "@/lib/ai-key-store";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const schema = z.object({
  /** Raw speech-to-text transcript to clean up. */
  raw: z.string().min(1).max(4000),
  /** Optional recent messages for tone/context (last few). */
  context: z.array(z.string().max(500)).max(8).optional(),
  /** Optional user style hint ("concise" | "casual" | "professional" | ...). */
  tone: z.string().max(40).optional(),
});

/**
 * POST /api/voice/polish
 *
 * Wispr-Flow-style dictation cleanup: takes a raw STT transcript and returns
 * polished text — fillers removed, self-corrections resolved, natural
 * punctuation/casing, tone preserved. Uses the platform Gemini key (or the
 * user's BYOK Google key). Best-effort: on any failure it returns the raw text
 * so dictation never breaks.
 */
export async function POST(req: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const raw = body.raw.trim();
  if (!raw) return NextResponse.json({ ok: true, text: "" });

  // Resolve a key: user's BYOK Google key, else the platform key.
  let apiKey = "";
  try {
    const byok = await getUserAiKeyForGeneration({ userId: session.id, provider: "GOOGLE" });
    apiKey = byok?.apiKey ?? "";
  } catch {
    /* fall through */
  }
  if (!apiKey) apiKey = process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_AI_API_KEY ?? "";
  // No key → just return the raw transcript (graceful, no error surfaced).
  if (!apiKey) return NextResponse.json({ ok: true, text: raw, polished: false });

  const contextBlock = body.context?.length
    ? `\nRecent conversation (for tone/context only — do NOT respond to it):\n${body.context.map((c) => `- ${c}`).join("\n")}\n`
    : "";
  const toneHint = body.tone ? `\nPreferred tone: ${body.tone}.` : "";

  const prompt =
    "You are a dictation cleanup engine (like Wispr Flow). Rewrite the user's raw " +
    "speech-to-text into clean, natural written text.\n" +
    "Rules:\n" +
    "- Remove fillers (um, uh, like, you know, I mean) and false starts.\n" +
    "- Resolve self-corrections: if they restate (\"send it tomorrow, wait no, today\"), keep only the final intent.\n" +
    "- Add natural punctuation, capitalization, and paragraph breaks.\n" +
    "- Preserve the speaker's meaning, voice, and any names/jargon verbatim.\n" +
    "- Do NOT answer questions, add content, or summarize. Output ONLY the cleaned message text — no preamble, no quotes." +
    toneHint +
    contextBlock +
    `\nRaw transcript:\n${raw}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
      }),
    });
    if (!res.ok) return NextResponse.json({ ok: true, text: raw, polished: false });
    const data = await res.json();
    let text = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
    text = text.replace(/^["'`]+|["'`]+$/g, "").trim();
    if (!text) return NextResponse.json({ ok: true, text: raw, polished: false });
    return NextResponse.json({ ok: true, text, polished: true });
  } catch {
    return NextResponse.json({ ok: true, text: raw, polished: false });
  }
}
