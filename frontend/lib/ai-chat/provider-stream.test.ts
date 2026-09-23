/** @fileOverview Streaming success, refund, cancellation and token-bound regressions. @stability stable */
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { providerRequest, streamBoundedProvider } from './provider-stream';
import { boundedChatHistory, FUNDED_AI_MODELS, MAX_AI_INPUT_BYTES, MAX_AI_OUTPUT_TOKENS, pricingIsReviewed } from './credit-policy';
const base = { provider: 'OPENAI' as const, model: 'gpt-5.6-luna', apiKey: 'fixture-secret',
  systemPrompt: 'Be concise.', messages: [{ role: 'user' as const, content: 'Hello' }] };
const textEvent = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
const upstream = (body: string) => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('bounded provider requests', () => {
  it.each(FUNDED_AI_MODELS)('caps $provider / $model without tools or key URLs', item => {
    const r = providerRequest({ ...base, provider: item.provider, model: item.model });
    expect(r.url).not.toContain(base.apiKey);
    expect(JSON.stringify(r.body)).not.toContain('"tools"');
    const b = r.body as Record<string, any>;
    expect(b.max_tokens ?? b.max_completion_tokens ?? b.generationConfig?.maxOutputTokens).toBe(MAX_AI_OUTPUT_TOKENS);
    expect(item.reserveMicroUsd).toBeGreaterThan(0);
    expect(item.reserveMicroUsd).toBeLessThanOrEqual(1_000_000);
  });
  it('uses Astra-compatible reasoning with no unsupported sampling parameters', () => {
    const r = providerRequest({ ...base, model: 'gpt-6-astra' });
    expect(r.body).toMatchObject({ reasoning_effort: 'low', max_completion_tokens: 2048, service_tier: 'default' });
    expect(r.body).not.toHaveProperty('temperature');
  });
  it('disables thinking for the funded Gemini Lite model', () => {
    expect(providerRequest({ ...base, provider: 'GOOGLE', model: 'gemini-2.5-flash-lite' }).body)
      .toMatchObject({ generationConfig: { thinkingConfig: { thinkingBudget: 0 } } });
  });
  it('rejects model URL injection', () => {
    expect(() => providerRequest({ ...base, provider: 'GOOGLE', model: 'evil?key=leak' })).toThrow();
  });
  it('bounds Unicode bytes and removes old history without altering the latest message', () => {
    const history = Array.from({ length: 20 }, () => ({ role: 'user' as const, content: '😀'.repeat(500) }));
    const trimmed = boundedChatHistory(history, base.systemPrompt);
    expect(new TextEncoder().encode(base.systemPrompt + trimmed.map(m => m.content).join('')).length).toBeLessThanOrEqual(MAX_AI_INPUT_BYTES);
    expect(trimmed.at(-1)).toEqual(history.at(-1));
    expect(history).toHaveLength(20);
    expect(() => boundedChatHistory([{ role: 'user', content: '😀'.repeat(3000) }], '')).toThrow('AI_MESSAGE_TOO_LARGE');
  });
  it('fails closed when pricing review expires', () => {
    expect(pricingIsReviewed(Date.parse('2026-09-24T00:00:00Z'))).toBe(true);
    expect(pricingIsReviewed(Date.parse('2026-10-24T00:00:00Z'))).toBe(false);
  });
});

describe('settlement follows provider output, not HTTP 200 alone', () => {
  it('refunds a bounded-output violation', async () => {
    const event = `data: ${JSON.stringify({ choices: [{ delta: { content: 'x'.repeat(128001) } }] })}\n\ndata: [DONE]\n\n`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(event)));
    const settle = vi.fn().mockResolvedValue(true);
    expect(await (await streamBoundedProvider({ ...base, settle })).text()).toContain('AI_STREAM_FAILED');
    expect(settle).toHaveBeenCalledExactlyOnceWith(false);
  });
  it('validates or persists output before charging success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(textEvent + 'data: [DONE]\n\n')));
    const settle = vi.fn().mockResolvedValue(true), beforeComplete = vi.fn().mockRejectedValue(new Error('Invalid output'));
    expect(await (await streamBoundedProvider({ ...base, settle, beforeComplete })).text()).toContain('AI_STREAM_FAILED');
    expect(beforeComplete).toHaveBeenCalledExactlyOnceWith('Hello');
    expect(settle).toHaveBeenCalledExactlyOnceWith(false);
  });
  it('settles nonempty completed output once', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(textEvent + 'data: [DONE]\n\n')));
    const settle = vi.fn().mockResolvedValue(true);
    const r = await streamBoundedProvider({ ...base, settle });
    const body = await r.text();
    expect(body).toContain('Hello'); expect(body).toContain('[DONE]');
    expect(settle).toHaveBeenCalledExactlyOnceWith(true);
  });
  it.each(['', textEvent, 'data: [DONE]\n\n', textEvent + 'data: {"error":{"message":"fixture-secret"}}\n\n', 'data: not-json\n\n'])('refunds empty, incomplete and error streams', async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(body)));
    const settle = vi.fn().mockResolvedValue(true);
    const output = await (await streamBoundedProvider({ ...base, settle })).text();
    expect(output).toContain('AI_STREAM_FAILED'); expect(output).not.toContain('fixture-secret');
    expect(output).not.toContain('[DONE]'); expect(settle).toHaveBeenCalledExactlyOnceWith(false);
  });
  it('refunds an HTTP provider failure without exposing its body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('fixture-secret', { status: 401 })));
    const settle = vi.fn().mockResolvedValue(true);
    const response = await streamBoundedProvider({ ...base, settle });
    expect(response.status).toBe(502); expect(await response.text()).not.toContain('fixture-secret');
    expect(settle).toHaveBeenCalledExactlyOnceWith(false);
  });
  it.each([
    { provider: 'GOOGLE' as const, body: 'data: {"candidates":[{"content":{"parts":[{"thought":true,"text":"private thought"},{"text":"Visible"}]},"finishReason":"STOP"}]}\n\n' },
    { provider: 'ANTHROPIC' as const, body: 'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Visible"}}\n\ndata: {"type":"message_stop"}\n\n' },
  ])('accepts $provider terminal events and only visible output', async item => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(item.body)));
    const settle = vi.fn().mockResolvedValue(true);
    const result = await (await streamBoundedProvider({ ...base, provider: item.provider, settle })).text();
    expect(result).toContain('Visible'); expect(result).not.toContain('private thought');
    expect(settle).toHaveBeenCalledExactlyOnceWith(true);
  });
  it('cancels upstream and refunds once when the client leaves', async () => {
    const cancelled = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel: cancelled }))));
    const settle = vi.fn().mockResolvedValue(true);
    const response = await streamBoundedProvider({ ...base, settle });
    await response.body!.cancel();
    expect(cancelled).toHaveBeenCalledOnce(); expect(settle).toHaveBeenCalledExactlyOnceWith(false);
  });
  it('refunds a timeout without extending the reservation lease', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('timeout')));
    })));
    const settle = vi.fn().mockResolvedValue(true);
    const pending = streamBoundedProvider({ ...base, settle });
    await vi.advanceTimersByTimeAsync(40_001);
    expect((await pending).status).toBe(502); expect(settle).toHaveBeenCalledExactlyOnceWith(false);
  });
});
