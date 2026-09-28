/** @fileOverview Access denial discards report payloads; transient errors and timeouts remain retryable. @stability stable */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPrivateAnalytics } from './private-read';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('private analytics reads', () => {
  it.each([401, 403])('replaces cached data with a denial for %s without parsing its body', async status => {
    const parse = vi.fn(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('do not parse', { status })));
    const result = await readPrivateAnalytics('/api/analytics/users', parse, 'growth');
    expect(result.data).toBeNull(); expect(result.accessError).toMatch(/session has expired|administrators only/); expect(parse).not.toHaveBeenCalled();
  });
  it.each([429, 500, 503])('rejects transient %s so an already-authorized report can remain', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));
    await expect(readPrivateAnalytics('/api/analytics/users', value => value, 'growth')).rejects.toThrow(status === 429 ? /Too many requests/ : /temporarily unavailable/);
  });
  it('validates successful data and requests no-store with an abort signal', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ count: 2 })); vi.stubGlobal('fetch', fetcher);
    expect(await readPrivateAnalytics('/api/analytics/users', value => (value as {count:number}).count, 'growth')).toEqual({ data: 2, accessError: null });
    expect(fetcher).toHaveBeenCalledWith('/api/analytics/users', { cache: 'no-store', signal: expect.any(AbortSignal) });
  });
  it('rejects invalid JSON and schema failures with safe messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('not json')).mockResolvedValueOnce(Response.json({})));
    await expect(readPrivateAnalytics('/api/analytics/users', value => value, 'growth')).rejects.toThrow('Analytics returned an unreadable response.');
    await expect(readPrivateAnalytics('/api/analytics/user-product-creation', () => { throw new Error('internal validator details'); }, 'publishing')).rejects.toThrow('The publishing mix returned an unreadable response.');
  });
  it('aborts a hung request after 15 seconds and clears the timer', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, { signal }: RequestInit) => new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(new Error('aborted'))))));
    const result = expect(readPrivateAnalytics('/api/analytics/users', value => value, 'growth')).rejects.toThrow('The analytics request did not respond.');
    await vi.advanceTimersByTimeAsync(15_000); await result; expect(vi.getTimerCount()).toBe(0);
  });
});
