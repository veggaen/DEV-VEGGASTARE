/** @fileOverview An order confirmation is private and cannot become a fulfillment shortcut. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ auth: vi.fn(), allow: vi.fn(), attempt: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mock.auth }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: mock.allow }));
vi.mock('@/lib/db', () => ({ dbPrisma: { checkoutAttempt: { findFirst: mock.attempt } } }));
import { GET } from '@/app/api/checkout/[id]/confirmation/route';
import { recordCheckoutAgreement, CHECKOUT_AGREEMENT_VERSION } from './checkout-agreement';
import { quoteShowcaseCart } from './showcase-policy';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
const quote = quoteShowcaseCart([{ productId: SHOWCASE_PRODUCTS.interviewPack.id, quantity: 1 }]);
const agreement = recordCheckoutAgreement(quote, { version: CHECKOUT_AGREEMENT_VERSION, files: true, credits: false }, false);
const fixture = { orderId: 'order1', userId: 'buyer1', environment: 'SANDBOX', totalOre: 2900,
  quote: { ...quote, agreement }, completedAt: new Date('2026-09-24T10:00:00Z'), captureId: 'CAPTURE1' };
const run = (id = 'order1') => GET(new Request('https://www.veggat.com/api/checkout/order1/confirmation'), { params: Promise.resolve({ id }) });
beforeEach(() => { vi.resetAllMocks(); mock.auth.mockResolvedValue({ user: { id: 'buyer1' } }); mock.allow.mockResolvedValue(true); mock.attempt.mockResolvedValue(fixture); });
it('requires sign-in and never reads a guessed order while logged out', async () => {
  mock.auth.mockResolvedValue(null); expect((await run()).status).toBe(401); expect(mock.attempt).not.toHaveBeenCalled();
});
it('queries only the signed-in buyer and returns no other buyer data', async () => {
  mock.attempt.mockResolvedValue(null); expect((await run()).status).toBe(404);
  expect(mock.attempt).toHaveBeenCalledWith({ where: { orderId: 'order1', userId: 'buyer1' } });
});
it('limits repeated reads before accessing the purchase', async () => {
  mock.allow.mockResolvedValue(false); expect((await run()).status).toBe(429); expect(mock.attempt).not.toHaveBeenCalled();
});
it('serves a private retainable attachment, even after refund', async () => {
  mock.attempt.mockResolvedValue({ ...fixture, state: 'REFUNDED' });
  const response = await run(); expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('content-disposition')).toBe('attachment; filename="veggat-order-order1.txt"');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(await response.text()).toContain('ORIGINAL ORDER CONFIRMATION');
});
it('does not fake consent or confirmation for legacy or unpaid orders', async () => {
  mock.attempt.mockResolvedValue({ ...fixture, quote }); expect((await run()).status).toBe(404);
  mock.attempt.mockResolvedValue({ ...fixture, completedAt: null }); expect((await run()).status).toBe(404);
});
it('rejects invalid filenames and redacts operational errors', async () => {
  expect((await run('../other\r\nInjected: yes')).status).toBe(404);
  mock.attempt.mockRejectedValue(new Error('private connection string'));
  const response = await run(); expect(response.status).toBe(503); expect(await response.text()).not.toContain('private connection');
});
