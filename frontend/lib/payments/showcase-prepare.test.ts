/** @fileOverview Daily exposure and stale-quote checks precede any provider call or order creation. @stability stable */
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ prior: vi.fn(), count: vi.fn(), exposure: vi.fn(), cart: vi.fn(), order: vi.fn(), attempt: vi.fn(), lock: vi.fn(), transaction: vi.fn() }));
vi.mock('@/lib/db', () => ({ dbPrisma: { $transaction: m.transaction } }));
vi.mock('./showcase-paypal', () => ({ paypalConfigured: () => true }));
import { prepareShowcaseCheckout } from './showcase-store';
import { quoteShowcaseCart } from './showcase-policy';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { AI_PRICING_REVIEW_BY } from '@/lib/ai-chat/credit-policy';
const selection = [{ productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1, creditAmount: 555 }];
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('VERCEL', ''); vi.stubEnv('VERCEL_ENV', '');
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-23T18:00:00Z'));
  m.prior.mockResolvedValue(null); m.count.mockResolvedValue(0); m.exposure.mockResolvedValue({ _sum: { totalOre: null } });
  m.cart.mockResolvedValue({ CartItem: selection.map(row => ({ ...row, Product: { visibility: 'PUBLIC', productType: 'DIGITAL', Files: [] } })) });
  m.order.mockResolvedValue({ id: 'order1' }); m.attempt.mockResolvedValue({ orderId: 'order1' });
  m.transaction.mockImplementation(callback => callback({ $executeRaw: m.lock,
    checkoutAttempt: { findUnique: m.prior, count: m.count, aggregate: m.exposure, create: m.attempt },
    cart: { findUnique: m.cart }, order: { create: m.order } }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
it('locks the buyer before atomically checking caps and saving the authoritative quote', async () => {
  await prepareShowcaseCheckout('buyer1', 'request1', JSON.stringify(quoteShowcaseCart(selection)));
  expect(m.lock.mock.invocationCallOrder[0]).toBeLessThan(m.exposure.mock.invocationCallOrder[0]);
  expect(m.attempt).toHaveBeenCalledWith({ data: expect.objectContaining({ totalOre: 20651, environment: 'SANDBOX',
    quote: expect.objectContaining({ lines: [expect.objectContaining({ credits: 555, amountOre: 20651 })] }) }) });
});
it('counts pending/failed attempts toward daily exposure and does not create an over-cap order', async () => {
  m.exposure.mockResolvedValue({ _sum: { totalOre: 30000 } });
  await expect(prepareShowcaseCheckout('buyer1', 'request1')).rejects.toThrow('DAILY_PURCHASE_AMOUNT_LIMIT');
  expect(m.order).not.toHaveBeenCalled();
  expect(m.exposure).toHaveBeenCalledWith({ where: { userId: 'buyer1', environment: 'SANDBOX', createdAt: { gte: new Date('2026-09-23T00:00:00Z') } }, _sum: { totalOre: true } });
});
it('preserves the two-attempt cap without treating it as a PayPal API limit', async () => {
  m.count.mockResolvedValue(2);
  await expect(prepareShowcaseCheckout('buyer1', 'request1')).rejects.toThrow('DAILY_PURCHASE_LIMIT');
  expect(m.order).not.toHaveBeenCalled();
});
it('rejects stale/browser-invented quotes without using them as prices', async () => {
  await expect(prepareShowcaseCheckout('buyer1', 'request1', '1 NOK')).rejects.toThrow('CART_CHANGED');
  expect(m.order).not.toHaveBeenCalled();
});
it('returns an existing attempt on retry without new exposure or repricing', async () => {
  m.prior.mockResolvedValue({ orderId: 'prior', environment: 'SANDBOX', totalOre: 3900 });
  expect(await prepareShowcaseCheckout('buyer1', 'request1')).toMatchObject({ orderId: 'prior', totalOre: 3900 });
  expect(m.count).not.toHaveBeenCalled(); expect(m.order).not.toHaveBeenCalled();
});
it('pauses new credit sales once the model-cost review expires', async () => {
  vi.setSystemTime(new Date(AI_PRICING_REVIEW_BY));
  await expect(prepareShowcaseCheckout('buyer1', 'request1')).rejects.toThrow('CREDIT_SALES_PAUSED');
  expect(m.order).not.toHaveBeenCalled();
});
