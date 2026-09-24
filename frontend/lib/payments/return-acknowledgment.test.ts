/** @fileOverview Original buyer acknowledgments stay private and do not certify refunds. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), allow: vi.fn(), find: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: mocks.allow }));
vi.mock('@/lib/db', () => ({ dbPrisma: { transactionalEmail: { findFirst: vi.fn().mockResolvedValue(null) }, returnRequest: { findFirst: mocks.find } } }));
import { GET } from '@/app/api/returns/[id]/acknowledgment/route';
import { returnAcknowledgment } from './return-request';
const record = { id: 'r1', orderId: 'o1', userId: 'buyer', reason: 'CHANGED_MIND' as const,
  description: 'Please withdraw this order.', createdAt: new Date('2026-09-24T10:20:30Z') };
const run = (id = 'r1') => GET(new Request('https://www.veggat.com/api/returns/r1/acknowledgment'), { params: Promise.resolve({ id }) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: 'buyer' } });
  mocks.allow.mockResolvedValue(true); mocks.find.mockResolvedValue(record);
});
it('uses only the purchasing account and immutable submitted fields', async () => {
  const response = await run();
  expect(response.status).toBe(200);
  expect(mocks.find).toHaveBeenCalledWith({ where: { id: 'r1', userId: 'buyer' }, select: {
    id: true, orderId: true, userId: true, reason: true, description: true, createdAt: true,
  } });
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('content-disposition')).toBe('attachment; filename="veggat-request-r1.txt"');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  const text = await response.text();
  expect(text).toContain('I withdraw from this purchase.');
  expect(text).toContain('2026-09-24T10:20:30.000Z');
  expect(text).toContain('not confirmation that money has been returned');
  expect(text).not.toContain('token=');
});
it('does not change after later seller decisions and never inserts a withdrawal for a defect report', () => {
  const reviewed = { ...record, status: 'APPROVED', sellerNote: 'some later decision' };
  expect(returnAcknowledgment(reviewed)).toBe(returnAcknowledgment(record));
  expect(returnAcknowledgment({ ...record, reason: 'DEFECTIVE' })).not.toContain('Notice: I withdraw');
});
it('fails closed for logged out, invalid ids, throttling, missing ownership and database failures', async () => {
  mocks.auth.mockResolvedValueOnce(null);
  expect((await run()).status).toBe(401);
  expect((await run('bad\r\nheader')).status).toBe(404);
  mocks.allow.mockResolvedValueOnce(false);
  expect((await run()).status).toBe(429);
  expect(mocks.find).not.toHaveBeenCalled();
  mocks.find.mockResolvedValueOnce(null);
  expect((await run()).status).toBe(404);
  mocks.find.mockRejectedValueOnce(new Error('private database error'));
  const failed = await run();
  expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain('private database');
});
