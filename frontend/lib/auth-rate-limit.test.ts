/** @fileOverview Durable auth limiter failure and privacy boundaries. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn() }));
vi.mock('@/lib/db', () => ({ dbPrisma: { $queryRaw: mocks.query, $executeRaw: mocks.execute } }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
import { allowAuthAttempt } from './auth-rate-limit';

describe('durable auth throttling', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('AUTH_SECRET', 'unit-test-only-secret'); mocks.query.mockResolvedValue([{ count: 1 }]); mocks.execute.mockResolvedValue(0); });
  it('checks both network and account buckets without storing raw identifiers', async () => {
    expect(await allowAuthAttempt('password', 'qa@example.test', new Request('http://localhost:3000', { headers: { 'x-forwarded-for': '192.0.2.1' } }))).toBe(true);
    expect(mocks.query).toHaveBeenCalledTimes(2);
    for (const call of mocks.query.mock.calls) expect(call[1]).toMatch(/^[a-f0-9]{64}$/);
  });
  it('blocks the sixth account attempt', async () => {
    mocks.query.mockResolvedValueOnce([{ count: 1 }]).mockResolvedValueOnce([{ count: 6 }]);
    expect(await allowAuthAttempt('password', 'qa@example.test')).toBe(false);
  });
  it('blocks the twenty-first network attempt', async () => {
    mocks.query.mockResolvedValue([{ count: 21 }]);
    expect(await allowAuthAttempt('password')).toBe(false);
  });
  it('fails closed on database errors', async () => {
    mocks.query.mockRejectedValue(new Error('unavailable'));
    expect(await allowAuthAttempt('password')).toBe(false);
  });
});
