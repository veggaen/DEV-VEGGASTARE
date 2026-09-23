/** @fileOverview Generation boundary: reservation before spend, failure refunds and BYOK isolation. @stability stable */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ reserve: vi.fn(), settle: vi.fn(), grantDemo: vi.fn(), saved: vi.fn(), save: vi.fn() }));
vi.mock('@/lib/ai-credit-ledger', () => ({
  AiCreditError: class extends Error { constructor(public code: string, public status: number) { super(code); } },
  aiCreditLedger: { reserve: m.reserve, settle: m.settle, grantDemo: m.grantDemo },
}));
vi.mock('@/lib/ai-key-store', () => ({ getUserAiKeyForGeneration: m.saved, upsertUserAiKey: m.save }));
import { AiCreditError } from '@/lib/ai-credit-ledger';
import { aiErrorResponse, generateMeteredStream, generateMeteredText } from './generation';
const request = () => new Request('http://localhost:3000/api/ai-chat', { headers: { origin: 'http://localhost:3000' } });
const input = () => ({ request: request(), userId: 'fixture-user', provider: 'OPENAI' as const, model: 'gpt-5.6-luna',
  messages: [{ role: 'user' as const, content: 'Hello' }], systemPrompt: 'Be concise.' });
const output = () => new Response('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n');
beforeEach(() => {
  vi.clearAllMocks();
  vi.setSystemTime(new Date('2026-09-24T01:00:00Z'));
  vi.stubEnv('OPENAI_API_KEY', 'fixture-platform-key'); vi.stubEnv('AUTH_SECRET', 'fixture-hmac-secret');
  m.reserve.mockResolvedValue({ id: 'reservation-1', credits: 2 }); m.settle.mockResolvedValue(true);
  m.grantDemo.mockResolvedValue(true); m.saved.mockResolvedValue(null); m.save.mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(output()));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('metered generation boundary', () => {
  it('reserves the server quote before any provider request and settles success', async () => {
    const response = await generateMeteredStream(input());
    expect(await response.text()).toContain('Hello');
    expect(m.reserve).toHaveBeenCalledWith(expect.objectContaining({ funding: 'PLATFORM', credits: 2, reservedMicroUsd: 15000 }));
    expect(m.reserve.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(fetch).mock.invocationCallOrder[0]);
    expect(m.settle).toHaveBeenCalledExactlyOnceWith('reservation-1', true);
    expect(response.headers.get('X-Ai-Credits')).toBe('2');
  });
  it.each([['AI_CREDITS_REQUIRED', 402], ['AI_DAILY_LIMIT', 429], ['AI_PLATFORM_DAILY_LIMIT', 503]] as const)('does not call the provider when %s', async (code, status) => {
    m.reserve.mockRejectedValueOnce(new AiCreditError(code, status));
    await expect(generateMeteredStream(input())).rejects.toMatchObject({ code, status });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not allow an arbitrary platform model even with a configured key', async () => {
    await expect(generateMeteredStream({ ...input(), model: 'unreviewed-model' })).rejects.toMatchObject({ code: 'AI_MODEL_UNAVAILABLE' });
    expect(m.reserve).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('refunds a provider failure and keeps keys out of errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('fixture-platform-key', { status: 401 }));
    const response = await generateMeteredStream(input());
    expect(response.status).toBe(502); expect(await response.text()).not.toContain('fixture-platform-key');
    expect(m.settle).toHaveBeenCalledExactlyOnceWith('reservation-1', false);
  });
  it('uses a saved key without charging platform credits or budget', async () => {
    m.saved.mockResolvedValueOnce({ provider: 'OPENAI', apiKey: 'fixture-personal-key' });
    m.reserve.mockResolvedValueOnce({ id: 'reservation-1', credits: 0 });
    const response = await generateMeteredStream(input()); await response.text();
    expect(m.reserve).toHaveBeenCalledWith(expect.objectContaining({ funding: 'BYOK', credits: 0, reservedMicroUsd: 0 }));
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer fixture-personal-key' });
    expect(response.headers.get('X-Ai-Cost-Tier')).toBe('byok');
  });
  it('never falls back to platform billing when a saved key fails to decrypt', async () => {
    m.saved.mockRejectedValueOnce(new Error('fixture-key-decryption-failure'));
    await expect(generateMeteredStream(input())).rejects.toThrow();
    expect(m.reserve).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('does not use a different provider saved key returned by legacy fallback', async () => {
    m.saved.mockResolvedValueOnce({ provider: 'GOOGLE', apiKey: 'fixture-wrong-provider' });
    const response = await generateMeteredStream(input()); await response.text();
    expect(m.reserve).toHaveBeenCalledWith(expect.objectContaining({ funding: 'PLATFORM' }));
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer fixture-platform-key' });
  });
  it('grants the demo allowance once through the idempotent ledger, then debits a free model by one', async () => {
    vi.stubEnv('GROQ_API_KEY', 'fixture-groq-key');
    const response = await generateMeteredStream({ ...input(), userId: 'demo_fixture', provider: 'GROQ', model: 'openai/gpt-oss-20b' });
    await response.text();
    expect(m.grantDemo).toHaveBeenCalledExactlyOnceWith('demo_fixture');
    expect(m.reserve).toHaveBeenCalledWith(expect.objectContaining({ credits: 1, reservedMicroUsd: 4000 }));
    expect(m.saved).not.toHaveBeenCalled();
  });
  it('rejects demo BYOK and anonymous premium access before provider spend', async () => {
    await expect(generateMeteredStream({ ...input(), userId: 'demo_fixture', key: { apiKey: 'fixture-personal-key' } })).rejects.toMatchObject({ code: 'SIGN_IN_FOR_BYOK' });
    await expect(generateMeteredStream({ ...input(), userId: undefined })).rejects.toMatchObject({ code: 'AI_SIGN_IN_REQUIRED' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('refunds invalid structured output before text consumers receive success', async () => {
    await expect(generateMeteredText({ ...input(), beforeComplete: async () => { throw new Error('INVALID_JSON'); } })).rejects.toMatchObject({ code: 'AI_UPSTREAM_ERROR' });
    expect(m.settle).toHaveBeenCalledExactlyOnceWith('reservation-1', false);
  });
  it('returns a human-readable zero-credit error and buy link, never a stack', async () => {
    const response = aiErrorResponse(new AiCreditError('AI_CREDITS_REQUIRED', 402));
    expect(response.status).toBe(402);
    expect(await response.json()).toMatchObject({ buyCreditsUrl: '/products/cveggatinterviewcredits01', message: expect.stringContaining('Not enough credits') });
  });
});
