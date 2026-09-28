/** @fileOverview Durable auth limiter failure and privacy boundaries. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn() }));
vi.mock('@/lib/db', () => ({ dbPrisma: { $queryRaw: mocks.query, $executeRaw: mocks.execute } }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
import { allowAuthAttempt, allowAdminDetailRead, allowSettlementEdit } from './auth-rate-limit';

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
  it('keeps the admin read budget separate from strict auth/write attempts', async () => {
    const request = new Request('http://localhost:3000');
    mocks.query.mockResolvedValueOnce([{ count: 60 }]).mockResolvedValueOnce([{ count: 60 }]);
    expect(await allowAdminDetailRead('qa-admin', request)).toBe(true);
    const readKey = mocks.query.mock.calls[1][1];
    mocks.query.mockResolvedValueOnce([{ count: 61 }]).mockResolvedValueOnce([{ count: 61 }]);
    expect(await allowAdminDetailRead('qa-admin', request)).toBe(false);
    mocks.query.mockResolvedValue([{ count: 1 }]);
    expect(await allowAuthAttempt('admin-user-edit', 'qa-admin', request)).toBe(true);
    expect(mocks.query.mock.calls.at(-1)![1]).not.toBe(readKey);
  });
  it('bounds auto-edit traffic without consuming or weakening checkout attempt limits', async () => {
    const request = new Request('http://localhost:3000');
    mocks.query.mockResolvedValueOnce([{count:120}]).mockResolvedValueOnce([{count:60}]);
    expect(await allowSettlementEdit('buyer',request)).toBe(true);
    const editKey = mocks.query.mock.calls[1][1];
    mocks.query.mockResolvedValueOnce([{count:121}]); expect(await allowSettlementEdit('',request)).toBe(false);
    mocks.query.mockResolvedValueOnce([{count:1}]).mockResolvedValueOnce([{count:61}]);
    expect(await allowSettlementEdit('buyer',request)).toBe(false);
    mocks.query.mockResolvedValueOnce([{count:1}]).mockResolvedValueOnce([{count:6}]);
    expect(await allowAuthAttempt('checkout','buyer',request)).toBe(false);
    expect(mocks.query.mock.calls.at(-1)![1]).not.toBe(editKey);
  });
});
