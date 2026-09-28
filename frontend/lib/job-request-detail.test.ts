/** @fileOverview Detail identity, access, timeout, URL and date regressions. @stability stable */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatRequestDate, isRequestImage, isRequestUrl, readJobRequest } from './job-request-detail';

const key = ['/api/job-requests/qa-detail', 'qa-reader', 'qa-detail'] as const;
const fixture = { id: 'qa-detail', userId: 'qa-author', title: null, user: { id: 'qa-author', name: null, image: null },
  descriptions: [], images: [], links: [], docs: [], companyIds: [], price: 0, negotiable: false,
  paymentMethod: null, delivery: null, additionalNotes: null, createdAt: 'invalid-date', updatedAt: '2026-09-24' };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('request detail reads', () => {
  it.each([401, 403, 404])('discards cached details on %s without parsing the body', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not JSON', { status })));
    expect(await readJobRequest(key)).toEqual({ data: null, problem: { kind: status === 404 ? 'missing' : 'access', message: expect.any(String) } });
  });
  it.each([429, 500, 503])('rejects transient %s safely', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private upstream detail', { status })));
    await expect(readJobRequest(key)).rejects.toThrow(status === 429 ? /Too many requests/ : /temporarily unavailable/);
  });
  it('validates a matching detail, preserves zero budget and disables HTTP cache', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(fixture)); vi.stubGlobal('fetch', fetcher);
    expect(await readJobRequest(key)).toEqual({ data: fixture, problem: null });
    expect(fetcher).toHaveBeenCalledWith(key[0], { cache: 'no-store', signal: expect.any(AbortSignal) });
  });
  it.each(['not JSON', '{}', JSON.stringify({ ...fixture, id: 'different-request' })])('rejects malformed or mismatched payloads', async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
    await expect(readJobRequest(key)).rejects.toThrow('This request is temporarily unavailable.');
  });
  it('bounds a stalled read and clears its timer', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, { signal }: RequestInit) => new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(new Error('aborted'))))));
    const result = expect(readJobRequest(key)).rejects.toThrow('temporarily unavailable');
    await vi.advanceTimersByTimeAsync(15_000); await result; expect(vi.getTimerCount()).toBe(0);
  });
});

describe('request display helpers', () => {
  it.each(['javascript:alert(1)', 'data:text/html,test', '//example.com/test', 'https://user:secret@example.com/a', 'not a url'])('rejects unsafe external link %s', value => {
    expect(isRequestUrl(value)).toBe(false);
  });
  it('allows web links and same-origin image paths but not protocol-relative or backslash paths', () => {
    expect(isRequestUrl('https://example.com/reference')).toBe(true);
    expect(isRequestUrl('http://example.com/reference')).toBe(true);
    expect(isRequestImage('/watchdarkmode.webp')).toBe(true);
    expect(isRequestImage('//example.com/image')).toBe(false);
    expect(isRequestImage('/\\example.com/image')).toBe(false);
    expect(isRequestImage('javascript:alert(1)')).toBe(false);
  });
  it('formats valid dates in UTC and handles invalid dates without throwing', () => {
    expect(formatRequestDate('2026-09-24T23:59:00Z')).toBe('Sep 24, 2026');
    expect(formatRequestDate('invalid-date')).toBe('Date unavailable');
  });
});
