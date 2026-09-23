/** @fileOverview Private order and download read-boundary regressions. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), limit: vi.fn(), orders: vi.fn(), order: vi.fn(), tokens: vi.fn(), items: vi.fn(), products: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: mocks.user }));
vi.mock('@/lib/db', () => ({ dbPrisma: { order: { findMany: mocks.orders, findUnique: mocks.order }, downloadToken: { findMany: mocks.tokens }, orderItem: { findMany: mocks.items }, product: { findMany: mocks.products } } }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.limit, getClientIdentifier: () => 'qa', rateLimitedResponse: () => new Response(null, { status: 429 }) }));
import { GET as list } from '@/app/api/orders/user/[userId]/route';
import { GET as detail } from '@/app/api/orders/[id]/route';
import { GET as downloads } from '@/app/api/my-downloads/route';
const request = new NextRequest('http://localhost/api/orders');
const listContext = { params: Promise.resolve({ userId: 'buyer' }) }, detailContext = { params: Promise.resolve({ id: 'order' }) };
const time = new Date('2026-09-23T10:00:00Z');
const fixture = () => ({ id: 'order', userId: 'buyer', totalAmount: 68, currency: 'NOK', status: 'COMPLETED', fulfilmentStatus: 'DELIVERED', createdAt: time, updatedAt: time, Payment: null, User: { id: 'buyer' }, CheckoutAttempt: { environment: 'DEMO', state: 'COMPLETED', captureId: null }, OrderItem: [{ id: 'line', title: 'Review pack', quantity: 1, priceAtTime: 29 }] });
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { id: 'buyer', role: 'USER' } }); mocks.user.mockResolvedValue({ id: 'buyer', role: 'USER' }); mocks.limit.mockResolvedValue({ success: true }); mocks.orders.mockResolvedValue([fixture()]); mocks.order.mockResolvedValue(fixture()); mocks.tokens.mockResolvedValue([]); mocks.items.mockResolvedValue([]); mocks.products.mockResolvedValue([]); });
describe('private orders and downloads', () => {
  it('requires authentication and enforces buyer ownership', async () => {
    mocks.auth.mockResolvedValue(null); mocks.user.mockResolvedValue(null);
    expect((await list(request, listContext)).status).toBe(401); expect((await detail(request, detailContext)).status).toBe(401); expect((await downloads(request)).status).toBe(401);
    expect(mocks.orders).not.toHaveBeenCalled(); expect(mocks.tokens).not.toHaveBeenCalled();
    mocks.auth.mockResolvedValue({ user: { id: 'other', role: 'USER' } }); mocks.user.mockResolvedValue({ id: 'other', role: 'USER' });
    expect((await list(request, listContext)).status).toBe(403); expect((await detail(request, detailContext)).status).toBe(403);
  });
  it('returns currency, separate items and authoritative demo provenance, with no private cache', async () => {
    for (const response of [await list(request, listContext), await detail(request, detailContext)]) {
      expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      const payload = await response.json(), data = Array.isArray(payload) ? payload[0] : payload;
      expect(data).toMatchObject({ currency: 'NOK', totalAmount: 68, checkout: { environment: 'DEMO', state: 'COMPLETED', captureId: null }, items: [{ id: 'line', priceAtTime: 29 }] });
      expect(data.checkout).not.toHaveProperty('approvalUrl');
    }
    expect(mocks.orders).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'buyer' }, take: 100 }));
  });
  it('rate limits all private reads before database access', async () => {
    mocks.limit.mockResolvedValue({ success: false });
    expect((await list(request, listContext)).status).toBe(429); expect((await detail(request, detailContext)).status).toBe(429); expect((await downloads(request)).status).toBe(429);
    expect(mocks.orders).not.toHaveBeenCalled(); expect(mocks.order).not.toHaveBeenCalled(); expect(mocks.tokens).not.toHaveBeenCalled();
  });
  it('resolves additional product files through their own purchased line', async () => {
    mocks.tokens.mockResolvedValue([{ id: 'download', token: 'opaque-test-token', orderItemId: 'line', orderId: 'order', digitalAssetId: 'notes', maxUses: 10, usedCount: 1, isRevoked: false, createdAt: time, expiresAt: time, DigitalAsset: { id: 'notes', fileName: 'notes.txt', fileSize: 20, mimeType: 'text/plain' }, Order: { id: 'order', createdAt: time } }]);
    mocks.items.mockResolvedValue([{ id: 'line', orderId: 'order', Product: { id: 'pack', title: 'Review pack', image: ['/pack.jpg'] } }]);
    const response = await downloads(request), payload = await response.json();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store'); expect(payload.downloads[0].product.title).toBe('Review pack');
    expect(mocks.items).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['line'] }, Order: { userId: 'buyer' } } }));
    expect(mocks.tokens).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'buyer' }, take: 100 }));
    mocks.items.mockResolvedValue([{ id: 'line', orderId: 'different-order', Product: { id: 'private', title: 'Not this order', image: [] } }]);
    expect((await (await downloads(request)).json()).downloads[0].product).toBeNull();
  });
});
