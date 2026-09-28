/** @fileOverview Seller inbox scope, bounded disclosure and failure states. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), employees: vi.fn(), records: vi.fn(), counters: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mock.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { employee: { findMany: mock.employees }, returnRequest: { findMany: mock.records }, downloadToken: { groupBy: mock.counters } } }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mock.limit, getClientIdentifier: () => 'qa', rateLimitedResponse: () => new Response(null, { status: 429 }) }));
import { GET } from '@/app/api/seller/returns/route';
import { reviewableOrderWhere } from '@/lib/payments/return-review-access';
import { SellerRequestList } from '@/lib/payments/return-review';
const request = (query = '') => new Request(`http://localhost:3000/api/seller/returns${query}`);
const record = (id = 'qa-request') => ({
  id, orderId: 'qa-order', reason: 'DEFECTIVE', description: 'The file is damaged.', status: 'PENDING', sellerNote: null,
  createdAt: new Date('2026-09-24T01:00:00.000Z'), updatedAt: new Date('2026-09-24T01:00:00.000Z'),
  Order: { totalAmount: 29, currency: 'NOK', status: 'COMPLETED', OrderItem: [{ title: 'Interview Pack', quantity: 1 }],
    _count: { OrderItem: 1 }, CheckoutAttempt: { environment: 'SANDBOX', state: 'REFUNDED', captureId: 'capture', refundReference: 'refund', quote: { privateValue: 'must-not-leak' } } },
});
beforeEach(() => {
  vi.clearAllMocks(); mock.auth.mockResolvedValue({ user: { id: 'seller', role: 'USER' } });
  mock.limit.mockResolvedValue({ success: true }); mock.employees.mockResolvedValue([{ companyId: 'managed' }]);
  mock.records.mockResolvedValue([record()]); mock.counters.mockResolvedValue([{ orderId: 'qa-order', _sum: { usedCount: 2 } }]);
});
describe('seller purchase-request inbox', () => {
  it('requires authentication and throttles reads', async () => {
    mock.auth.mockResolvedValueOnce(null); expect((await GET(request())).status).toBe(401);
    mock.limit.mockResolvedValueOnce({ success: false }); expect((await GET(request())).status).toBe(429);
    expect(mock.records).not.toHaveBeenCalled();
  });
  it('never loads real buyer data for demo identities, including a forged admin role', async () => {
    mock.auth.mockResolvedValue({ user: { id: 'demo_qa', role: 'ADMIN' } });
    const response = await GET(request());
    expect(await response.json()).toEqual({ requests: [], page: 1, hasMore: false, readOnly: true });
    expect(mock.records).not.toHaveBeenCalled(); expect(mock.employees).not.toHaveBeenCalled();
  });
  it.each(['?page=0', '?page=1.5', '?page=10001', '?status=INVALID', '?userId=other', '?id=../other'])('rejects invalid query %s', async query => {
    expect((await GET(request(query))).status).toBe(400); expect(mock.records).not.toHaveBeenCalled();
  });
  it('requires a nonempty order and ownership of every line inside the query', async () => {
    const response = await GET(request('?page=2&status=ALL'));
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mock.records).toHaveBeenCalledWith(expect.objectContaining({
      skip: 20, take: 21, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      where: { Order: { OrderItem: { some: {}, every: { Product: { OR: [{ userId: 'seller' }, { companyId: { not: null, in: ['managed'] } }] } } } } },
    }));
    expect(mock.employees).toHaveBeenCalledWith({ where: { userId: 'seller', role: { in: ['OWNER', 'MANAGER'] } }, select: { companyId: true } });
  });
  it('gives admins review coverage without making empty orders eligible', () => {
    expect(reviewableOrderWhere('admin', 'ADMIN', [])).toEqual({ OrderItem: { some: {} } });
  });
  it('retains the same authorization scope for a single-request refresh', async () => {
    await GET(request('?id=qa-request&status=ALL'));
    expect(mock.records.mock.calls[0][0].where).toEqual({ id: 'qa-request', Order: reviewableOrderWhere('seller', 'USER', ['managed']) });
  });
  it('returns at most twenty requests, minimum evidence, and no raw quote/customer data', async () => {
    mock.records.mockResolvedValue(Array.from({ length: 21 }, (_, index) => record(`qa-${index}`)));
    const body = await (await GET(request())).json();
    expect(body.hasMore).toBe(true); expect(body.requests).toHaveLength(20);
    expect(SellerRequestList.safeParse(body).success).toBe(true);
    expect(body.requests[0].order).toMatchObject({ downloadRequests: 2, agreement: null, paymentState: 'REFUNDED' });
    expect(JSON.stringify(body)).not.toContain('must-not-leak');
    expect(JSON.stringify(mock.records.mock.calls[0][0].select)).not.toContain('email');
  });
  it('does not call a failed query an empty inbox', async () => {
    mock.records.mockRejectedValue(new Error('private database detail'));
    const response = await GET(request()); expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private database detail');
  });
});
