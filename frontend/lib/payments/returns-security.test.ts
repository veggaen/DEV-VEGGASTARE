/** @fileOverview Return review cannot fabricate refunds or cross seller boundaries. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/payments/email-outbox', () => ({ queueTransactionEmail: vi.fn() }));
vi.mock('@/lib/payments/email-after', () => ({ scheduleTransactionEmail: vi.fn() }));

const mock = vi.hoisted(() => ({
  auth: vi.fn(), allow: vi.fn(), readLimit: vi.fn(),
  find: vi.fn(), employees: vi.fn(), transaction: vi.fn(),
  update: vi.fn(), updated: vi.fn(), order: vi.fn(), existing: vi.fn(), create: vi.fn(), lock: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: mock.auth }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: mock.allow }));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mock.readLimit, getClientIdentifier: () => 'test',
  rateLimitedResponse: () => new Response(null, { status: 429 }),
}));
vi.mock('@/lib/db', () => ({ dbPrisma: {
  returnRequest: { findUnique: mock.find, findFirst: mock.existing, create: mock.create },
  employee: { findMany: mock.employees }, order: { findUnique: mock.order },
  $transaction: mock.transaction,
} }));
import { GET, PATCH } from '@/app/api/returns/[id]/route';
import { POST } from '@/app/api/returns/route';

const context = { params: Promise.resolve({ id: 'return-one' }) };
const revision = new Date('2026-09-24T10:00:00.000Z');
const item = (owner: string | null, company: string | null = null) => ({
  Product: { userId: owner, companyId: company },
});
const record = (items = [item('seller')]) => ({
  id: 'return-one', orderId: 'order-one', userId: 'buyer', status: 'PENDING',
  createdAt: new Date(), updatedAt: revision, sellerNote: null,
  Order: { OrderItem: items },
});
function request(action = 'APPROVE', origin: string | null = 'http://localhost:3000') {
  return new NextRequest('http://localhost:3000/api/returns/return-one', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify({ action, sellerNote: 'Reviewed for follow-up, not a payment.', expectedUpdatedAt: revision.toISOString() }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ user: { id: 'seller', role: 'USER' } });
  mock.allow.mockResolvedValue(true); mock.readLimit.mockResolvedValue({ success: true });
  mock.find.mockResolvedValue(record()); mock.employees.mockResolvedValue([]);
  mock.update.mockResolvedValue({ count: 1 });
  mock.updated.mockResolvedValue({ ...record(), status: 'APPROVED' });
  mock.transaction.mockImplementation(callback => callback({
    $executeRaw: mock.lock, order: { findUnique: mock.order },
    returnRequest: { updateMany: mock.update, findUniqueOrThrow: mock.updated, findFirst: mock.existing, create: mock.create },
  }));
});

describe('whole-order return review', () => {
  it.each([null, 'http://localhost:3100', 'https://unrelated.example'])('rejects invalid Origin %s', async origin => {
    expect((await PATCH(request('APPROVE', origin), context)).status).toBe(403);
    expect(mock.find).not.toHaveBeenCalled();
  });
  it('requires authentication and durable rate limiting', async () => {
    mock.auth.mockResolvedValueOnce(null);
    expect((await PATCH(request(), context)).status).toBe(401);
    mock.allow.mockResolvedValueOnce(false);
    expect((await PATCH(request(), context)).status).toBe(429);
    expect(mock.find).not.toHaveBeenCalled();
  });
  it('denies a seller processing or viewing another seller\'s line', async () => {
    mock.find.mockResolvedValue(record([item('seller'), item('other-seller')]));
    expect((await PATCH(request(), context)).status).toBe(403);
    expect((await GET(request(), context)).status).toBe(403);
    expect(mock.transaction).not.toHaveBeenCalled();
  });
  it('requires management coverage for every remaining company', async () => {
    mock.find.mockResolvedValue(record([item('other', 'one'), item('other', 'two')]));
    mock.employees.mockResolvedValueOnce([{ companyId: 'one' }]);
    expect((await PATCH(request(), context)).status).toBe(403);
    mock.employees.mockResolvedValueOnce([{ companyId: 'one' }, { companyId: 'two' }]);
    expect((await PATCH(request(), context)).status).toBe(200);
    expect(mock.employees).toHaveBeenLastCalledWith({ where: {
      userId: 'seller', companyId: { in: ['one', 'two'] }, role: { in: ['OWNER', 'MANAGER'] },
    }, select: { companyId: true } });
  });
  it('allows the buyer to read their full request but not process it', async () => {
    mock.auth.mockResolvedValue({ user: { id: 'buyer', role: 'USER' } });
    expect((await GET(request(), context)).status).toBe(200);
    expect((await PATCH(request(), context)).status).toBe(403);
  });
  it.each(['USER', 'ADMIN'])('never fabricates money returned for role %s', async role => {
    mock.auth.mockResolvedValue({ user: { id: 'seller', role } });
    mock.find.mockResolvedValue({ ...record(), status: 'APPROVED' });
    const response = await PATCH(request('REFUND'), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'REFUND_REQUIRES_VERIFIED_PAYMENT' });
    expect(mock.transaction).not.toHaveBeenCalled();
  });
  it('changes review status only, with a compare-and-swap guard', async () => {
    expect((await PATCH(request(), context)).status).toBe(200);
    expect(mock.update).toHaveBeenCalledWith({
      where: { id: 'return-one', status: 'PENDING', updatedAt: expect.any(Date) },
      data: { status: 'APPROVED', sellerNote: 'Reviewed for follow-up, not a payment.', processedBy: 'seller', processedAt: expect.any(Date) },
    });
  });
  it('rejects stale concurrent decisions and already-final statuses', async () => {
    mock.update.mockResolvedValueOnce({ count: 0 });
    expect((await PATCH(request(), context)).status).toBe(409);
    mock.find.mockResolvedValue({ ...record(), status: 'REFUNDED' });
    expect((await PATCH(request(), context)).status).toBe(400);
  });
  it('rejects empty orders and arbitrary refund amount input', async () => {
    mock.find.mockResolvedValue(record([]));
    expect((await PATCH(request(), context)).status).toBe(403);
    const input = new NextRequest('http://localhost:3000/api/returns/return-one', {
      method: 'PATCH', headers: { Origin: 'http://localhost:3000' },
      body: JSON.stringify({ action: 'APPROVE', refundAmount: 123 }),
    });
    expect((await PATCH(input, context)).status).toBe(400);
  });
});

it('accepts a defect claim after 14 days without treating a download as a waiver', async () => {
  mock.auth.mockResolvedValue({ user: { id: 'buyer', role: 'USER' } });
  mock.order.mockResolvedValue({ id: 'order-one', userId: 'buyer', status: 'COMPLETED',
    fulfilmentStatus: 'DELIVERED', createdAt: new Date('2026-01-01'), deliveredAt: new Date('2026-01-01') });
  mock.existing.mockResolvedValue(null);
  mock.create.mockResolvedValue({ ...record(), reason: 'DEFECTIVE' });
  const response = await POST(new NextRequest('http://localhost:3000/api/returns', {
    method: 'POST', headers: { Origin: 'http://localhost:3000' },
    body: JSON.stringify({ orderId: 'order-one', reason: 'DEFECTIVE', description: 'The downloaded file is damaged.' }),
  }));
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ status: 'PENDING', withinWithdrawalPeriod: false });
  expect(mock.create).toHaveBeenCalledOnce();
  expect(mock.lock).toHaveBeenCalledOnce();
});

describe('seller revision and demo guards', () => {
  it('keeps other buyer details private from demo identities even with an admin role', async () => {
    mock.auth.mockResolvedValue({ user: { id: 'demo_seller', role: 'ADMIN', isDemo: true } });
    expect((await GET(request(), context)).status).toBe(403);
    mock.find.mockResolvedValue({ ...record(), userId: 'demo_seller' });
    expect((await GET(request(), context)).status).toBe(200);
  });
  it('rejects an old browser revision before starting a review transaction', async () => {
    mock.find.mockResolvedValue({ ...record(), updatedAt: new Date('2026-09-24T11:00:00.000Z') });
    const response = await PATCH(request(), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'STALE_REVIEW' });
    expect(mock.transaction).not.toHaveBeenCalled();
  });
  it('blocks demo seller mutations at the route, even without middleware', async () => {
    mock.auth.mockResolvedValue({ user: { id: 'demo_seller', role: 'ADMIN', isDemo: true } });
    expect((await PATCH(request(), context)).status).toBe(403);
    expect(mock.find).not.toHaveBeenCalled();
  });
  it.each([{ action: 'APPROVE' }, { action: 'REJECT', sellerNote: ' ', expectedUpdatedAt: revision.toISOString() }])('requires a revision and buyer-visible explanation', async body => {
    expect((await PATCH(new NextRequest('http://localhost:3000/api/returns/return-one', {
      method: 'PATCH', headers: { Origin: 'http://localhost:3000' }, body: JSON.stringify(body),
    }), context)).status).toBe(400);
    expect(mock.transaction).not.toHaveBeenCalled();
  });
});

describe('buyer notices', () => {
  const input = (extra = {}, origin = 'http://localhost:3000') => new NextRequest('http://localhost:3000/api/returns', {
    method: 'POST', headers: { Origin: origin }, body: JSON.stringify({ orderId: 'order-one', reason: 'CHANGED_MIND', ...extra }),
  });
  beforeEach(() => {
    mock.auth.mockResolvedValue({ user: { id: 'buyer' } });
    mock.order.mockResolvedValue({ id: 'order-one', userId: 'buyer', status: 'COMPLETED',
      fulfilmentStatus: 'DELIVERED', createdAt: new Date(), deliveredAt: new Date() });
    mock.existing.mockResolvedValue(null);
    mock.create.mockResolvedValue({ ...record(), reason: 'CHANGED_MIND', description: null });
  });
  it('fails closed on origin, auth, throttling and unknown consent/amount fields', async () => {
    expect((await POST(input({}, 'https://evil.example'))).status).toBe(403);
    mock.auth.mockResolvedValueOnce(null);
    expect((await POST(input())).status).toBe(401);
    mock.allow.mockResolvedValueOnce(false);
    expect((await POST(input())).status).toBe(429);
    expect((await POST(input({ refundAmount: 1 }))).status).toBe(400);
    expect((await POST(input({ description: 'x'.repeat(2001) }))).status).toBe(400);
    expect(mock.transaction).not.toHaveBeenCalled();
  });
  it('does not disclose another buyer order or permit arbitrary grants', async () => {
    mock.order.mockResolvedValueOnce({ id: 'order-one', userId: 'other' });
    expect((await POST(input())).status).toBe(404);
    mock.order.mockResolvedValueOnce(null);
    expect((await POST(input())).status).toBe(404);
    expect(mock.create).not.toHaveBeenCalled();
  });
  it('accepts an optional empty withdrawal explanation and locks before reading', async () => {
    const response = await POST(input({ description: '  ' }));
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mock.create).toHaveBeenCalledWith({ data: { orderId: 'order-one', userId: 'buyer', reason: 'CHANGED_MIND', description: null } });
    expect(mock.lock.mock.invocationCallOrder[0]).toBeLessThan(mock.order.mock.invocationCallOrder[0]);
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('returns the original pending request on a lost-response retry, without creating twice', async () => {
    mock.existing.mockResolvedValue({ ...record(), reason: 'CHANGED_MIND', description: null });
    const response = await POST(input());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: 'return-one', duplicate: true });
    expect(mock.create).not.toHaveBeenCalled();
  });
  it('preserves the original notice instead of overwriting it on a conflicting retry', async () => {
    mock.existing.mockResolvedValue({ ...record(), reason: 'CHANGED_MIND', description: 'original' });
    expect((await POST(input({ description: 'replacement' }))).status).toBe(409);
    expect(mock.create).not.toHaveBeenCalled();
  });
  it('does not let a different pending problem block a withdrawal', async () => {
    await POST(input());
    expect(mock.existing).toHaveBeenCalledWith({ where: { orderId: 'order-one', userId: 'buyer',
      reason: 'CHANGED_MIND', status: { in: ['PENDING', 'APPROVED'] } }, orderBy: { createdAt: 'desc' } });
  });
  it('never opens a new request for an unpaid or already reversed order', async () => {
    mock.order.mockResolvedValueOnce({ id: 'order-one', userId: 'buyer', status: 'PENDING' });
    expect((await POST(input())).status).toBe(409);
    mock.order.mockResolvedValueOnce({ id: 'order-one', userId: 'buyer', status: 'CANCELLED' });
    expect((await POST(input())).status).toBe(409);
    expect(mock.create).not.toHaveBeenCalled();
  });
});
