/** Read only Veggat's bounded SSE protocol. HTTP 200 and partial text are not
 * success: saving a reply requires the server's explicit completion marker. */
export async function readChatStream(response: Response, onText: (text: string) => void) {
  if (!response.body) throw new Error('The response was empty. Please retry.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', text = '', bytes = 0, completed = false;
  const line = (value: string) => {
    if (!value.startsWith('data:')) return;
    const raw = value.slice(5).trim();
    if (completed) throw new Error('The response was malformed. Please retry.');
    if (raw === '[DONE]') { completed = true; return; }
    let event;
    try { event = JSON.parse(raw); } catch { throw new Error('The response was malformed. Please retry.'); }
    if (event?.error) throw new Error(typeof event.message === 'string' ? event.message : 'The response was interrupted. Please retry.');
    if (typeof event?.text !== 'string') throw new Error('The response was malformed. Please retry.');
    text += event.text;
    if (text.length > 128_000) throw new Error('The response was too large. Please retry.');
    onText(event.text);
  };
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 512_000) throw new Error('The response was too large. Please retry.');
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
      for (const value of lines) line(value);
    }
    buffer += decoder.decode(); if (buffer) line(buffer);
    if (!completed || !text.trim()) throw new Error('The response was interrupted before completion. Please retry.');
    return text;
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
