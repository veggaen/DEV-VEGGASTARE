/** @fileOverview BYOK-only audio until server-verified duration can bound platform spend. @stability experimental */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { MyLibUserAuth } from "@/lib/user-auth";
import { getUserAiKeyForGeneration } from "@/lib/ai-key-store";
import { aiCreditLedger, AiCreditError } from "@/lib/ai-credit-ledger";
import { aiErrorResponse } from "@/lib/ai-chat/generation";
import { guardAiRequest, readAiBytes } from "@/lib/ai-chat/request";
import { isDemoUserId } from "@/lib/demo-policy";

export const maxDuration = 30;
export const dynamic = "force-dynamic";
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let reservationId: string | undefined;
  try {
    const session = await MyLibUserAuth();
    if (!session?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    await guardAiRequest(req, session.id);
    if (isDemoUserId(session.id)) throw new AiCreditError("SIGN_IN_FOR_BYOK", 403);
    const saved = await getUserAiKeyForGeneration({ userId: session.id, provider: "OPENAI" });
    if (!saved?.apiKey || saved.provider !== "OPENAI") {
      return NextResponse.json({ error: "TRANSCRIPTION_REQUIRES_PERSONAL_KEY",
        message: "Audio transcription needs your own saved OpenAI key in Settings. Your provider bills audio directly; platform credits are not used. You can still type your message." }, { status: 503 });
    }
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.startsWith("multipart/form-data;")) throw new AiCreditError("INVALID_REQUEST", 400);
    const bytes = await readAiBytes(req, MAX_AUDIO_BYTES + 64_000);
    let form: FormData;
    try { form = await new Response(bytes, { headers: { "Content-Type": contentType } }).formData(); }
    catch { throw new AiCreditError("INVALID_REQUEST", 400); }
    const file = form.get("file");
    if (!(file instanceof File)) throw new AiCreditError("INVALID_REQUEST", 400);
    if (file.size > MAX_AUDIO_BYTES) throw new AiCreditError("AI_MESSAGE_TOO_LARGE", 413);
    if (file.size < 256) return NextResponse.json({ ok: true, text: "" });
    const reservation = await aiCreditLedger.reserve({ userId: session.id, actorKey: session.id, requestId: randomUUID(),
      provider: "OPENAI", model: "whisper-1", funding: "BYOK", credits: 0, reservedMicroUsd: 0 });
    reservationId = reservation.id;
    const upstream = new FormData();
    upstream.set("file", file, file.name || "dictation.webm");
    upstream.set("model", "whisper-1"); upstream.set("response_format", "json");
    const prompt = form.get("prompt");
    if (typeof prompt === "string" && prompt.trim()) upstream.set("prompt", prompt.trim().slice(0, 500));
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${saved.apiKey}` }, body: upstream,
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(25_000)]), redirect: "error",
    });
    if (!response.ok) { await response.body?.cancel(); throw new AiCreditError("AI_UPSTREAM_ERROR", 502); }
    const data = await response.json();
    const text = typeof data?.text === "string" ? data.text.trim() : "";
    if (!text || text.length > 100_000) throw new AiCreditError("AI_UPSTREAM_ERROR", 502);
    await aiCreditLedger.settle(reservation.id, true);
    return NextResponse.json({ ok: true, text });
  } catch (error) {
    if (reservationId) await aiCreditLedger.settle(reservationId, false).catch(() => undefined);
    return aiErrorResponse(error);
  }
}
