/** @fileOverview Provider transport keeps credentials in headers and requests daily bounded history. @stability stable */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const cacheMock = vi.hoisted(() => vi.fn((fn: (...args: unknown[]) => unknown) => fn));
vi.mock('next/cache', () => ({ unstable_cache: cacheMock }));
import { fetchProviderHistory } from './crypto-history-server';
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ prices: [[Date.UTC(2026, 2, 31), 12]] }), { status: 200 }));
  vi.stubEnv('COINGECKO_API_KEY', '');
  vi.stubEnv('COINGECKO_DEMO_API_KEY', '');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('configures the shared one-hour framework cache', () => {
  expect(cacheMock).toHaveBeenCalledWith(expect.any(Function), ['veggat-daily-price-history-v1'], { revalidate: 3600 });
});
it('requests daily history, fixed lookback and a ten-second abort signal', async () => {
  const result = await fetchProviderHistory('bitcoin', 'nok');
  const [url, options] = fetchMock.mock.calls[0];
  expect(url.hostname).toBe('api.coingecko.com');
  expect(url.searchParams.get('days')).toBe('365');
  expect(url.searchParams.get('interval')).toBe('daily');
  expect(options.signal).toBeInstanceOf(AbortSignal);
  expect(options.cache).toBe('no-store');
  expect(result.data).toEqual([{ date: '2026-03-31', price: 12 }]);
});
it.each([['COINGECKO_DEMO_API_KEY', 'api.coingecko.com', 'x-cg-demo-api-key'], ['COINGECKO_API_KEY', 'pro-api.coingecko.com', 'x-cg-pro-api-key']])('sends %s only as a server header', async (env, host, header) => {
  vi.stubEnv(env, 'test-only-placeholder');
  await fetchProviderHistory('ethereum', 'usd');
  const [url, options] = fetchMock.mock.calls[0];
  expect(url.hostname).toBe(host);
  expect(url.toString()).not.toContain('test-only-placeholder');
  expect(options.headers[header]).toBe('test-only-placeholder');
});
it('does not include provider error bodies in thrown errors or cache malformed successes', async () => {
  fetchMock.mockResolvedValueOnce(new Response('sensitive provider details', { status: 401 }));
  await expect(fetchProviderHistory('ethereum', 'usd')).rejects.toThrow('Market data provider unavailable');
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ unexpected: true }), { status: 200 }));
  await expect(fetchProviderHistory('ethereum', 'usd')).rejects.toThrow();
});
