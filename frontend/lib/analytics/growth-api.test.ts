/** @fileOverview Private growth endpoints retain authentication, rate limits and deterministic UTC days. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), findMany: vi.fn(), limit: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { product: { findMany: mocks.findMany }, user: { findMany: mocks.findMany }, company: { findMany: mocks.findMany } } }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.limit, getClientIdentifier: () => 'test', rateLimitedResponse: () => new Response(null, { status: 429 }) }));
import { GET as products } from '@/app/api/analytics/products/route';
import { GET as users } from '@/app/api/analytics/users/route';
import { GET as companies } from '@/app/api/analytics/companies/route';

describe.each([['products', products], ['users', users], ['companies', companies]] as const)('%s access and dates', (metric, get) => {
  beforeEach(() => { vi.resetAllMocks(); mocks.limit.mockResolvedValue({ success: true }); });
  it('denies guests and ordinary users without querying data', async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await get(new Request('http://localhost/api/analytics/' + metric))).status).toBe(401);
    mocks.auth.mockResolvedValue({ user: { id: 'demo', role: 'USER' } });
    expect((await get(new Request('http://localhost/api/analytics/' + metric))).status).toBe(403);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it('rate limits administrators before touching the database', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'admin', role: 'ADMIN' } });
    mocks.limit.mockResolvedValue({ success: false });
    expect((await get(new Request('http://localhost/api/analytics/' + metric))).status).toBe(429);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it('includes today even when the first creation time was later in the day', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-03-30T01:00:00Z'));
      mocks.auth.mockResolvedValue({ user: { id: 'admin', role: 'ADMIN' } });
      mocks.findMany.mockResolvedValue([{ createdAt: new Date('2026-03-28T23:30:00Z') }, { createdAt: new Date('2026-03-30T00:30:00Z') }]);
      const response = await get(new Request('http://localhost/api/analytics/' + metric));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data[0].data.map((p: { date: string }) => p.date.slice(0, 10))).toEqual(['2026-03-28', '2026-03-29', '2026-03-30']);
      expect(body.data[0].data.at(-1)[metric === 'companies' ? 'companies' : 'users']).toBe(2);
      expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 10000 }));
    } finally { vi.useRealTimers(); }
  });
});
