/** @fileOverview Same-origin, durable-limited AI requests with bounded JSON bodies. @stability experimental */
import 'server-only';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';
import { AiCreditError } from '@/lib/ai-credit-ledger';
export async function readAiBytes(request: Request, limit = 64_000): Promise<ArrayBuffer> {
  if (!request.body) throw new AiCreditError('INVALID_REQUEST', 400);
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new AiCreditError('AI_MESSAGE_TOO_LARGE', 413);
      chunks.push(value);
    }
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return result.buffer;
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
export async function guardAiRequest(request: Request, userId?: string) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new AiCreditError('INVALID_ORIGIN', 403);
  if (!await allowAuthAttempt('ai-generation', userId ?? '', request)) throw new AiCreditError('AI_RATE_LIMIT', 429);
}
export async function readAiJson(request: Request) {
  if (!request.body) throw new AiCreditError('INVALID_REQUEST', 400);
  const reader = request.body.getReader(), decoder = new TextDecoder();
  let bytes = 0, text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 64_000) throw new AiCreditError('AI_MESSAGE_TOO_LARGE', 413);
      text += decoder.decode(value, { stream: true });
    }
    try { return JSON.parse(text + decoder.decode()) as unknown; }
    catch { throw new AiCreditError('INVALID_REQUEST', 400); }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
