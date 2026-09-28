/** @fileOverview Bounded same-origin messaging requests and private responses. @stability stable */
import 'server-only';
import { NextResponse } from 'next/server';
export class MessageError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export const messageReply = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
});
export function sameMessageOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new MessageError('Open this page on Veggat and try again.', 403);
}
export async function messageBody(request: Request, limit = 32_768) {
  if (!request.body) throw new MessageError('Request body required.', 400);
  const reader = request.body.getReader(), decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) throw new MessageError('This message is too large.', 413);
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
export const messageFailure = (error: unknown) => messageReply({ message: error instanceof MessageError ? error.message : 'Messages are temporarily unavailable. Try again.' }, error instanceof MessageError ? error.status : 503);
