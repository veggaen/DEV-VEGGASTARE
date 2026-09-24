/** @fileOverview Request-board access, validation and bounded retry regressions. @stability stable */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readJobRequests } from './job-requests-read';

const key = ['/api/job-requests', 'qa-user'] as const;
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('private request reads', () => {
  it.each([401, 403])('replaces cached rows with denial on %s without parsing its body', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not JSON', { status })));
    expect(await readJobRequests(key)).toEqual({ data: null, accessError: expect.stringMatching(/session has expired|no longer has access/) });
  });
  it.each([429, 500, 503])('keeps transient %s failures retryable', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));
    await expect(readJobRequests(key)).rejects.toThrow(status === 429 ? /Too many requests/ : /temporarily unavailable/);
  });
  it('validates a successful empty list and disables HTTP caching', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json([])); vi.stubGlobal('fetch', fetcher);
    expect(await readJobRequests(key)).toEqual({ data: [], accessError: null });
    expect(fetcher).toHaveBeenCalledWith(key[0], { cache: 'no-store', signal: expect.any(AbortSignal) });
  });
  it.each(['not JSON', '{"private":"invalid shape"}'])('does not expose malformed responses', async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
    await expect(readJobRequests(key)).rejects.toThrow('The request list is temporarily unavailable. Please try again.');
  });
  it('bounds a stalled request to 15 seconds and clears its timer', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, { signal }: RequestInit) => new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(new Error('aborted'))))));
    const result = expect(readJobRequests(key)).rejects.toThrow('The request list did not respond.');
    await vi.advanceTimersByTimeAsync(15_000); await result;
    expect(vi.getTimerCount()).toBe(0);
  });
});
