/** @fileOverview Scheduled mutations cannot run without explicit authorization. @stability stable */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isCronAuthorized } from './cron-auth';

afterEach(() => vi.unstubAllEnvs());

describe('scheduled-job authentication', () => {
  it.each([undefined, '', ' ', 'short'])('fails closed with an unusable secret (%s)', secret => {
    vi.stubEnv('CRON_SECRET', secret);
    expect(isCronAuthorized(new Request('https://veggat.com/api/cron/test'))).toBe(false);
    expect(isCronAuthorized(new Request('https://veggat.com/api/cron/test', {
      headers: { authorization: `Bearer ${secret}` },
    }))).toBe(false);
  });

  it('requires the exact configured Bearer token', () => {
    vi.stubEnv('CRON_SECRET', 'test-secret-with-at-least-sixteen-characters');
    for (const authorization of ['', 'Bearer undefined', 'bearer test-secret-with-at-least-sixteen-characters', 'Bearer test-secret-with-at-least-sixteen-characterX']) {
      expect(isCronAuthorized(new Request('https://veggat.com', { headers: { authorization } }))).toBe(false);
    }
    expect(isCronAuthorized(new Request('https://veggat.com', {
      headers: { authorization: 'Bearer test-secret-with-at-least-sixteen-characters' },
    }))).toBe(true);
  });
});
