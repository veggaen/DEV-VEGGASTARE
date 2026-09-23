/** @fileOverview Publishing mix stays private and aggregates without materializing product identities. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), count: vi.fn(), limit: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { product: { count: mocks.count } } }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.limit, getClientIdentifier: () => 'test', rateLimitedResponse: () => new Response(null, { status: 429 }) }));
import { GET } from '@/app/api/analytics/user-product-creation/route';
const request = () => new Request('http://localhost/api/analytics/user-product-creation');
beforeEach(() => { vi.resetAllMocks(); mocks.limit.mockResolvedValue({ success: true }); });

it('denies anonymous and demo visitors without counting records', async () => {
  mocks.auth.mockResolvedValue(null);
  expect((await GET(request())).status).toBe(401);
  mocks.auth.mockResolvedValue({ user: { id: 'demo', role: 'USER' } });
  expect((await GET(request())).status).toBe(403);
  expect(mocks.count).not.toHaveBeenCalled();
});
it('rate limits administrators before running aggregates', async () => {
  mocks.auth.mockResolvedValue({ user: { id: 'admin', role: 'ADMIN' } });
  mocks.limit.mockResolvedValue({ success: false });
  expect((await GET(request())).status).toBe(429);
  expect(mocks.count).not.toHaveBeenCalled();
});
it('returns truthful zero counts and uses only database count operations', async () => {
  mocks.auth.mockResolvedValue({ user: { id: 'admin', role: 'ADMIN' } });
  mocks.count.mockResolvedValueOnce(0).mockResolvedValueOnce(3);
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: [{ label: 'Independent seller products', count: 0 }, { label: 'Company products', count: 3 }] });
  expect(mocks.count.mock.calls).toEqual([[{ where: { companyId: null } }], [{ where: { companyId: { not: null } } }]]);
});
it('fails closed on query failure without returning database details', async () => {
  mocks.auth.mockResolvedValue({ user: { id: 'admin', role: 'ADMIN' } });
  mocks.count.mockRejectedValue(new Error('internal database details'));
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Analytics temporarily unavailable' });
    expect(log).toHaveBeenCalledWith('Product publishing mix query failed');
  } finally { log.mockRestore(); }
});
