/** @fileOverview Same-origin and bounded-body regressions. @stability stable */
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai-credit-ledger', () => ({ AiCreditError: class extends Error { constructor(public code: string, public status: number) { super(code); } } }));
const rate = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: rate }));
import { guardAiRequest, readAiBytes, readAiJson } from './request';
describe('AI request boundary', () => {
  it('rejects cross-origin and absent origins', async () => {
    for (const origin of ['', 'https://other.example']) {
      await expect(guardAiRequest(new Request('http://localhost:3000/api/ai-chat', { headers: { origin } }))).rejects.toMatchObject({ code: 'INVALID_ORIGIN', status: 403 });
    }
  });
  it('uses the shared durable throttle for same-origin calls', async () => {
    const request = new Request('http://localhost:3000/api/ai-chat', { headers: { origin: 'http://localhost:3000' } });
    rate.mockResolvedValueOnce(false);
    await expect(guardAiRequest(request, 'user')).rejects.toMatchObject({ code: 'AI_RATE_LIMIT', status: 429 });
  });
  it('accepts bounded valid JSON and rejects malformed JSON as 400', async () => {
    const request = (body: string) => new Request('http://localhost:3000', { method: 'POST', body });
    expect(await readAiJson(request('{"text":"Hello 😀"}'))).toEqual({ text: 'Hello 😀' });
    await expect(readAiJson(request('{not-json'))).rejects.toMatchObject({ code: 'INVALID_REQUEST', status: 400 });
    await expect(readAiJson(request('x'.repeat(64001)))).rejects.toMatchObject({ status: 413 });
  });
  it('bounds upload bytes before multipart parsing', async () => {
    await expect(readAiBytes(new Request('http://localhost:3000', { method: 'POST', body: 'abcd' }), 3)).rejects.toMatchObject({ status: 413 });
  });
});
