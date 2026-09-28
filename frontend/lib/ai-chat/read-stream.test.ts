import { expect, it, vi } from 'vitest';
import { readChatStream } from './read-stream';
it('accepts split UTF-8, CRLF and a terminal marker without a trailing newline', async () => {
  const bytes = new TextEncoder().encode('data: {"text":"Hello 🌱"}\r\n\r\ndata: [DONE]');
  const response = new Response(new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } }));
  const update = vi.fn();
  expect(await readChatStream(response, update)).toBe('Hello 🌱'); expect(update).toHaveBeenCalledExactlyOnceWith('Hello 🌱');
});
it.each([
  'data: {"text":"partial"}\n\n',
  'data: {"text":"partial"}\n\ndata: {broken}\n\ndata: [DONE]\n\n',
  'data: {"text":"partial"}\n\ndata: {"error":"FAILED"}\n\n',
  'data: [DONE]\n\n',
  'data: {"text":"ok"}\n\ndata: [DONE]\n\ndata: {"text":"late"}\n\n',
])('never reports incomplete/malformed output as completed: %s', async body => {
  await expect(readChatStream(new Response(body), () => {})).rejects.toThrow();
});
