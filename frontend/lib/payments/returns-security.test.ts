/** @fileOverview Return review cannot fabricate refunds or cross seller boundaries. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mock = vi.hoisted(() => ({
  auth: vi.fn(), allow: vi.fn(), readLimit: vi.fn(),
  find: vi.fn(), employees: vi.fn(), transaction: vi.fn(),
  update: vi.fn(), updated: vi.fn(), order: vi.fn(), existing: vi.fn(), create: vi.fn(),
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
const item = (owner: string | null, company: string | null = null) => ({
  Product: { userId: owner, companyId: company },
});
const record = (items = [item('seller')]) => ({
  id: 'return-one', orderId: 'order-one', userId: 'buyer', status: 'PENDING',
  createdAt: new Date(), updatedAt: new Date(), sellerNote: null,
  Order: { OrderItem: items },
});
function request(action = 'APPROVE', origin: string | null = 'http://localhost:3000') {
  return new NextRequest('http://localhost:3000/api/returns/return-one', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify({ action }),
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
    returnRequest: { updateMany: mock.update, findUniqueOrThrow: mock.updated },
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
      data: { status: 'APPROVED', sellerNote: null, processedBy: 'seller', processedAt: expect.any(Date) },
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
});
