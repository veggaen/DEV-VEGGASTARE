import { NextRequest, NextResponse } from "next/server";
import { MyLibUserAuth } from "@/lib/user-auth";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "TRANSCRIPTION_NOT_CONFIGURED", message: "Server transcription is not configured." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "INVALID_FORM" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "MISSING_AUDIO" }, { status: 400 });
  }
  if (file.size < 256) return NextResponse.json({ ok: true, text: "" });
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "AUDIO_TOO_LARGE" }, { status: 413 });
  }

  const upstream = new FormData();
  upstream.set("file", file, file.name || "dictation.webm");
  // Stable fallback for real selected-mic dictation. The UI can later swap this
  // endpoint to realtime/streaming STT without changing composer components.
  upstream.set("model", "whisper-1");
  upstream.set("response_format", "json");

  const prompt = form.get("prompt");
  if (typeof prompt === "string" && prompt.trim()) {
    upstream.set("prompt", prompt.trim().slice(0, 500));
  }

  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "TRANSCRIPTION_FAILED", detail: detail.slice(0, 500) },
        { status: 502 },
      );
    }

    const data = await res.json().catch(() => null);
    const text = typeof data?.text === "string" ? data.text.trim() : "";
    return NextResponse.json({ ok: true, text });
  } catch (error) {
    return NextResponse.json(
      { error: "TRANSCRIPTION_FAILED", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 502 },
    );
  }
}
