/** @fileOverview External proxy validation, bounded caching and redacted failure responses. @stability stable */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ history: vi.fn(), limit: vi.fn() }));
vi.mock('@/lib/analytics/crypto-history-server', () => ({ getCryptoHistory: mocks.history }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.limit, getClientIdentifier: () => 'test-client', rateLimitedResponse: () => new Response(null, { status: 429 }) }));
import { GET } from '@/app/api/analytics/crypto-price/route';
import { GET as ethereum } from '@/app/api/analytics/ethereum-price/route';
const request = (query: string) => new Request('http://localhost/api/analytics/crypto-price?' + query);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.limit.mockResolvedValue({ success: true });
  mocks.history.mockResolvedValue({ coin: 'ethereum', currency: 'usd', fetchedAt: '2026-03-31T12:00:00Z', data: [{ date: '2026-03-29', price: 10 }, { date: '2026-03-30', price: 20 }, { date: '2026-03-31', price: 30 }] });
});
afterEach(() => vi.restoreAllMocks());
it('rejects invalid parameters before calling the provider cache', async () => {
  for (const query of ['crypto=other', 'vs_currency=usd%26days%3Dmax', 'interval=hourly', 'days=9999', 'fromDate=bad']) expect((await GET(request(query))).status).toBe(400);
  expect(mocks.history).not.toHaveBeenCalled();
});
it('rate limits before the provider operation', async () => {
  mocks.limit.mockResolvedValue({ success: false });
  expect((await GET(request(''))).status).toBe(429);
  expect(mocks.history).not.toHaveBeenCalled();
});
it('keeps upstream cache keys independent of range and aggregates locally', async () => {
  const response = await GET(request('fromDate=2026-03-30&toDate=2026-03-31&interval=weekly'));
  expect(mocks.history).toHaveBeenCalledWith('ethereum', 'usd');
  expect((await response.json()).data).toEqual([{ date: '2026-03-30', price: 25 }]);
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it('returns real empty data and never replaces failure with invented prices', async () => {
  mocks.history.mockResolvedValue({ coin: 'ethereum', currency: 'usd', fetchedAt: '2026-03-31T12:00:00Z', data: [] });
  expect((await (await GET(request(''))).json()).data).toEqual([]);
  mocks.history.mockRejectedValue(new Error('secret provider failure body'));
  const response = await GET(request(''));
  expect(response.status).toBe(503);
  expect(response.headers.get('retry-after')).toBe('60');
  expect(JSON.stringify(await response.json())).not.toContain('secret');
});
it('routes the legacy Ethereum endpoint through the same validation and cache', async () => {
  expect((await ethereum(request('crypto=bitcoin&days=max&interval=monthly'))).status).toBe(200);
  expect(mocks.history).toHaveBeenCalledWith('ethereum', 'usd');
  expect((await ethereum(request('vs_currency=invalid'))).status).toBe(400);
});
