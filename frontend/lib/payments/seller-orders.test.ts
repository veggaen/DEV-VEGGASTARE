/** @fileOverview Sales API authorization, minimization and failure contracts. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), employees: vi.fn(), orders: vi.fn(), groups: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mock.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { employee: { findMany: mock.employees }, order: { findMany: mock.orders, groupBy: mock.groups } } }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mock.limit, getClientIdentifier: () => 'qa', rateLimitedResponse: () => new Response(null, { status: 429 }) }));
import { GET } from '@/app/api/seller/orders/route';
import { SellerOrderList, safeShippingLink } from './seller-orders';
const request = (query = '') => new Request(`http://localhost:3000/api/seller/orders${query}`);
const record = () => ({
  id: 'qa-order', createdAt: new Date('2026-09-24T00:00:00Z'), currency: 'NOK', status: 'COMPLETED', fulfilmentStatus: 'UNFULFILLED',
  shippingName: 'Buyer', shippingAddress: 'Private address', shippingCity: 'Oslo', shippingPostalCode: '0001', shippingCountry: 'NO',
  trackingNumber: 'TRACK', trackingUrl: 'javascript:alert(1)', labelUrl: 'https://example.com/label',
  _count: { OrderItem: 1 }, OrderItem: [{ id: 'i1', productId: 'p1', title: 'QA file', quantity: 2, priceAtTime: 29, Product: { productType: 'DIGITAL' } }],
  User: { id: 'buyer', name: 'Buyer', email: 'private@example.invalid', emailDisplayMode: 'HIDE' },
  Payment: { method: 'PAYPAL', status: 'COMPLETED', receiverAddress: 'seller@example.invalid', senderAddress: null, transactionId: 'CAPTURE', chainFamily: null, chainId: null, tokenSymbol: null, nativeAmount: null },
  CheckoutAttempt: { environment: 'SANDBOX', state: 'REFUNDED' },
});
beforeEach(() => {
  vi.clearAllMocks(); mock.auth.mockResolvedValue({ user: { id: 'seller', role: 'USER' } });
  mock.limit.mockResolvedValue({ success: true }); mock.employees.mockResolvedValue([{ companyId: 'owned' }]);
  mock.orders.mockResolvedValue([record()]); mock.groups.mockResolvedValue([{ fulfilmentStatus: 'UNFULFILLED', _count: { _all: 2 } }, { fulfilmentStatus: 'SHIPPED', _count: { _all: 3 } }]);
});
describe('personal seller orders', () => {
  it('requires sign-in and throttles without querying orders', async () => {
    mock.auth.mockResolvedValueOnce(null); const denied = await GET(request()); expect(denied.status).toBe(401); expect(denied.headers.get('cache-control')).toBe('private, no-store');
    mock.limit.mockResolvedValueOnce({ success: false }); expect((await GET(request())).status).toBe(429); expect(mock.orders).not.toHaveBeenCalled();
  });
  it.each([{ id: 'demo_qa', role: 'ADMIN' }, { id: 'user', role: 'USER', isDemo: true }])('never loads real data for demo identity %j', async user => {
    mock.auth.mockResolvedValue({ user }); const body = await (await GET(request())).json();
    expect(body).toMatchObject({ readOnly: true, orders: [], counts: { ALL: 0 } }); expect(SellerOrderList.safeParse(body).success).toBe(true);
    expect(mock.employees).not.toHaveBeenCalled(); expect(mock.orders).not.toHaveBeenCalled(); expect(mock.groups).not.toHaveBeenCalled();
  });
  it.each(['?page=0', '?page=10001', '?page=1.2', '?limit=101', '?fulfilmentStatus=UNKNOWN', '?seller=other', '?page=1&page=2'])('rejects invalid query %s', async query => {
    expect((await GET(request(query))).status).toBe(400); expect(mock.orders).not.toHaveBeenCalled();
  });
  it('uses the same seller relation scope for page and all filter counts, with bounded selections', async () => {
    const response = await GET(request('?page=2&fulfilmentStatus=SHIPPED'));
    const body = await response.json(); expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(body.pagination).toEqual({ page: 2, limit: 20, total: 3, totalPages: 1 }); expect(body.counts).toMatchObject({ ALL: 5, UNFULFILLED: 2, SHIPPED: 3 });
    expect(mock.employees).toHaveBeenCalledWith({ where: { userId: 'seller', role: 'OWNER' }, select: { companyId: true } });
    const scope = { OrderItem: { some: { Product: { OR: [{ userId: 'seller' }, { companyId: { not: null, in: ['owned'] } }] } } } };
    expect(mock.orders.mock.calls[0][0]).toMatchObject({ skip: 20, take: 20, where: { ...scope, fulfilmentStatus: 'SHIPPED' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { OrderItem: { take: 50, where: scope.OrderItem.some } } });
    expect(mock.groups).toHaveBeenCalledExactlyOnceWith({ by: ['fulfilmentStatus'], where: scope, _count: { _all: true } });
  });
  it('preserves personal scoping even for an admin', async () => {
    mock.auth.mockResolvedValue({ user: { id: 'admin', role: 'ADMIN' } }); await GET(request());
    expect(mock.orders.mock.calls[0][0].where.OrderItem.some.Product.OR[0]).toEqual({ userId: 'admin' });
  });
  it('minimizes digital customer data and exposes authoritative refund state', async () => {
    const body = await (await GET(request())).json(); expect(SellerOrderList.safeParse(body).success).toBe(true);
    expect(body.orders[0]).toMatchObject({ sellerTotal: 58, shipping: null, tracking: null, customer: { email: null }, payment: { state: 'REFUNDED' } });
    expect(JSON.stringify(body)).not.toContain('private@example.invalid'); expect(JSON.stringify(body)).not.toContain('Private address');
  });
  it('withholds whole-order routing and tracking on mixed or truncated orders', async () => {
    const value = record(); value._count.OrderItem = 2; value.OrderItem[0].Product.productType = 'PHYSICAL'; mock.orders.mockResolvedValue([value]);
    const body = await (await GET(request())).json(); expect(body.orders[0]).toMatchObject({ sharedOrder: true, sellerTotal: 58, payment: null, tracking: null, shipping: { address: 'Private address' } });
    expect(JSON.stringify(body)).not.toContain('CAPTURE'); expect(JSON.stringify(body)).not.toContain('seller@example.invalid');
  });
  it('keeps legitimate physical shipment data but drops unsafe links', async () => {
    const value = record(); value.OrderItem[0].Product.productType = 'PHYSICAL'; mock.orders.mockResolvedValue([value]);
    expect((await (await GET(request())).json()).orders[0].tracking).toEqual({ number: 'TRACK', url: null, labelUrl: 'https://example.com/label' });
  });
  it('returns a retryable failure rather than an empty list or database details', async () => {
    mock.groups.mockRejectedValue(new Error('secret connection string')); const response = await GET(request());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret connection string');
  });
  it.each(['javascript:alert(1)', 'data:text/html,hello', 'http://example.com', 'https://user:password@example.com', '/relative'])('refuses unsafe external link %s', value => expect(safeShippingLink(value)).toBeNull());
  it('rejects incomplete count payloads and nonfinite money', () => {
    expect(SellerOrderList.safeParse({ orders: [], readOnly: false, counts: {}, pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }).success).toBe(false);
  });
});
