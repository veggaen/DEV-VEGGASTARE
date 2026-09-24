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
import { CHECKOUT_AGREEMENT_VERSION, DELIVERY_REQUESTS } from './checkout-agreement';
const consent = { version: CHECKOUT_AGREEMENT_VERSION, files: false, credits: true } as const;
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
  await prepareShowcaseCheckout('buyer1', 'request1', JSON.stringify(quoteShowcaseCart(selection)), consent);
  expect(m.lock.mock.invocationCallOrder[0]).toBeLessThan(m.exposure.mock.invocationCallOrder[0]);
  expect(m.attempt).toHaveBeenCalledWith({ data: expect.objectContaining({ totalOre: 20651, environment: 'SANDBOX',
    quote: expect.objectContaining({ lines: [expect.objectContaining({ credits: 555, amountOre: 20651 })],
      agreement: expect.objectContaining({ recordedAt: '2026-09-23T18:00:00.000Z', requests: [DELIVERY_REQUESTS.credits] }) }) }) });
});
it('counts pending/failed attempts toward daily exposure and does not create an over-cap order', async () => {
  m.exposure.mockResolvedValue({ _sum: { totalOre: 30000 } });
  await expect(prepareShowcaseCheckout('buyer1', 'request1', undefined, consent)).rejects.toThrow('DAILY_PURCHASE_AMOUNT_LIMIT');
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
  await expect(prepareShowcaseCheckout('buyer1', 'request1', undefined, consent)).rejects.toThrow('CREDIT_SALES_PAUSED');
  expect(m.order).not.toHaveBeenCalled();
});
it('never prepares a new paid order without the current explicit delivery request', async () => {
  await expect(prepareShowcaseCheckout('buyer1', 'request1')).rejects.toThrow('DELIVERY_CONSENT_REQUIRED');
  expect(m.order).not.toHaveBeenCalled(); expect(m.attempt).not.toHaveBeenCalled();
});
it('keeps the first consent snapshot on an idempotent retry, including legacy orders', async () => {
  const prior = { orderId: 'prior', environment: 'SANDBOX', quote: { agreement: { version: 'older', requests: ['original'] } } };
  m.prior.mockResolvedValue(prior);
  expect(await prepareShowcaseCheckout('buyer1', 'request1', undefined, consent)).toBe(prior);
  expect(m.order).not.toHaveBeenCalled(); expect(m.attempt).not.toHaveBeenCalled();
});
it('prepares the small pack at 9 NOK without weakening delivery consent or repricing old attempts', async () => {
  const small = [{ productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1, creditAmount: 10 }];
  m.cart.mockResolvedValue({ CartItem: small.map(row => ({ ...row, Product: { visibility: 'PUBLIC', productType: 'DIGITAL', Files: [] } })) });
  await expect(prepareShowcaseCheckout('buyer1', 'small1')).rejects.toThrow('DELIVERY_CONSENT_REQUIRED');
  expect(m.order).not.toHaveBeenCalled();
  await prepareShowcaseCheckout('buyer1', 'small1', JSON.stringify(quoteShowcaseCart(small)), consent);
  expect(m.attempt).toHaveBeenCalledWith({ data: expect.objectContaining({ totalOre: 900,
    quote: expect.objectContaining({ lines: [expect.objectContaining({ credits: 10, amountOre: 900 })] }) }) });
});

it.each(Object.values(SHOWCASE_PRODUCTS))('blocks paused $id on the server before an order or provider session exists', async sku => {
  const paused = [{ productId: sku.id, quantity: 1 }];
  m.cart.mockResolvedValue({ CartItem: paused.map(row => ({ ...row, Product: {
    id: sku.id, productType: 'DIGITAL', visibility: 'PUBLIC', downloadsEnabled: false,
    Files: [{ DigitalAsset: { isActive: true, mimeType: 'image/jpeg' } }, { DigitalAsset: { isActive: true, mimeType: 'text/plain' } }],
  } })) });
  await expect(prepareShowcaseCheckout('buyer1', 'paused', JSON.stringify(quoteShowcaseCart(paused)), {
    ...consent, files: sku.kind === 'DIGITAL_FILES', credits: sku.kind === 'AI_CREDITS',
  })).rejects.toThrow('ITEM_UNAVAILABLE');
  expect(m.order).not.toHaveBeenCalled(); expect(m.attempt).not.toHaveBeenCalled();
});
