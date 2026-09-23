/** @fileOverview Bounded direct-provider streaming with explicit success/failure settlement. @stability experimental */
import 'server-only';
import type { AiProvider } from '@/lib/ai-models';
import { buildGeminiContents, stripHtml } from './safety';
import { AI_PROVIDER_TIMEOUT_MS, MAX_AI_OUTPUT_TOKENS, type ChatMessage } from './credit-policy';

type StreamInput = { provider: AiProvider; model: string; apiKey: string; messages: ChatMessage[];
  systemPrompt: string; signal?: AbortSignal; settle: (success: boolean) => Promise<unknown>;
  beforeComplete?: (text: string) => Promise<void> };
const HEADERS = { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' };

export function providerRequest(input: Omit<StreamInput, 'settle' | 'signal'>) {
  const { provider, model, apiKey, messages, systemPrompt } = input;
  if (!/^[A-Za-z0-9_./:-]{1,120}$/.test(model)) throw new Error('INVALID_MODEL');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiMessages = [{ role: 'system', content: systemPrompt }, ...messages];
  if (provider === 'GOOGLE') {
    headers['x-goog-api-key'] = apiKey;
    return { url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, headers,
      body: { contents: buildGeminiContents(messages), systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: MAX_AI_OUTPUT_TOKENS, ...(model === 'gemini-2.5-flash-lite' ? { thinkingConfig: { thinkingBudget: 0 } } : {}) } } };
  }
  if (provider === 'ANTHROPIC') {
    headers['x-api-key'] = apiKey; headers['anthropic-version'] = '2023-06-01';
    return { url: 'https://api.anthropic.com/v1/messages', headers,
      body: { model, messages, system: systemPrompt, stream: true, max_tokens: MAX_AI_OUTPUT_TOKENS } };
  }
  headers.Authorization = `Bearer ${apiKey}`;
  const url = provider === 'GROQ' ? 'https://api.groq.com/openai/v1/chat/completions' :
    provider === 'GROK' ? 'https://api.x.ai/v1/chat/completions' :
    provider === 'OPENROUTER' ? 'https://openrouter.ai/api/v1/chat/completions' :
    provider === 'VERCEL' ? 'https://ai-gateway.vercel.sh/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
  const modern = provider === 'GROQ' || (provider === 'OPENAI' && (/^gpt-[5-9]/.test(model) || /^o\d/.test(model)));
  return { url, headers, body: { model, messages: apiMessages, stream: true,
    ...(modern ? { max_completion_tokens: MAX_AI_OUTPUT_TOKENS } : { max_tokens: MAX_AI_OUTPUT_TOKENS }),
    ...(provider === 'OPENAI' ? { store: false, service_tier: 'default' } : {}),
    ...(model === 'gpt-6-astra' || (provider === 'GROQ' && model.startsWith('openai/gpt-oss-')) || provider === 'GROK' ? { reasoning_effort: 'low' } : {}),
  } };
}

/** No raw provider body, request URL or key is logged or returned. Streaming
 * failure is not silently reported as success, even after some text was sent. */
export async function streamBoundedProvider(input: StreamInput): Promise<Response> {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), AI_PROVIDER_TIMEOUT_MS);
  const signal = input.signal ? AbortSignal.any([input.signal, abort.signal]) : abort.signal;
  let settled: Promise<unknown> | undefined;
  const settleOnce = (success: boolean) => settled ??= input.settle(success);
  let upstream: Response;
  try {
    const request = providerRequest(input);
    upstream = await fetch(request.url, { method: 'POST', headers: request.headers,
      body: JSON.stringify(request.body), signal, redirect: 'error' });
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel();
      throw new Error('AI_PROVIDER_UNAVAILABLE');
    }
  } catch {
    abort.abort(); clearTimeout(timeout);
    await settleOnce(false).catch(() => undefined);
    return Response.json({ error: 'AI_UPSTREAM_ERROR', message: 'The model is temporarily unavailable. Reserved credits are being returned. Try again shortly or choose another model.' }, { status: 502 });
  }
  const reader = upstream.body!.getReader();
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = '', fullText = '', totalBytes = 0, textBytes = 0, sawText = false, sawTerminal = false;
      function data(raw: string) {
        if (raw === '[DONE]') { sawTerminal = true; return; }
        const parsed = JSON.parse(raw);
        if (parsed.error || parsed.type === 'error') throw new Error('PROVIDER_STREAM_ERROR');
        let text = '';
        if (input.provider === 'GOOGLE') {
          const candidate = parsed.candidates?.[0];
          text = (candidate?.content?.parts ?? []).filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text ?? '').join('');
          if (candidate?.finishReason) {
            if (!['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) throw new Error('PROVIDER_REFUSED');
            sawTerminal = true;
          }
        } else if (input.provider === 'ANTHROPIC') {
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') text = parsed.delta.text ?? '';
          if (parsed.type === 'message_stop') sawTerminal = true;
        } else {
          text = parsed.choices?.[0]?.delta?.content ?? '';
        }
        if (typeof text !== 'string') throw new Error('INVALID_PROVIDER_TEXT');
        text = stripHtml(text);
        if (text) {
          textBytes += encoder.encode(text).length;
          if (textBytes > 128_000) throw new Error('PROVIDER_OUTPUT_TOO_LARGE');
          if (input.beforeComplete) fullText += text;
          if (text.trim()) sawText = true;
          if (!cancelled) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        }
      }
      function lines(final = false) {
        const parts = buffer.split('\n');
        buffer = final ? '' : parts.pop() ?? '';
        for (const line of parts) if (line.startsWith('data:')) data(line.slice(5).trim());
      }
      try {
        while (!cancelled) {
          const chunk = await reader.read();
          if (chunk.done) break;
          totalBytes += chunk.value.byteLength;
          if (totalBytes > 512_000) throw new Error('PROVIDER_STREAM_TOO_LARGE');
          buffer += decoder.decode(chunk.value, { stream: true });
          lines();
          if (buffer.length > 128_000) throw new Error('PROVIDER_EVENT_TOO_LARGE');
        }
        buffer += decoder.decode(); lines(true);
        if (cancelled || signal.aborted || !sawText || !sawTerminal) throw new Error('INCOMPLETE_STREAM');
        await input.beforeComplete?.(fullText);
        await settleOnce(true);
        if (!cancelled) controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch {
        abort.abort();
        await settleOnce(false).catch(() => undefined);
        if (!cancelled) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'AI_STREAM_FAILED', message: 'The response was interrupted. Reserved credits are being reconciled; please try again.' })}\n\n`));
      } finally {
        abort.abort(); clearTimeout(timeout);
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
        if (!cancelled) controller.close();
      }
    },
    async cancel() {
      cancelled = true; abort.abort(); clearTimeout(timeout);
      await reader.cancel().catch(() => undefined);
      await settleOnce(false).catch(() => undefined);
    },
  });
  return new Response(stream, { headers: HEADERS });
}
