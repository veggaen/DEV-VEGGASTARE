/** @fileOverview Replay, atomic grant and environment isolation regressions. @stability stable */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('./email-outbox', () => ({ queueTransactionEmail: m.email }));
const m = vi.hoisted(() => ({ find: vi.fn(), fresh: vi.fn(), update: vi.fn(), lock: vi.fn(), account: vi.fn(), entry: vi.fn(),
  files: vi.fn(), token: vi.fn(), order: vi.fn(), cart: vi.fn(), remove: vi.fn(), capture: vi.fn(), read: vi.fn(), transaction: vi.fn(), adjust: vi.fn(), email: vi.fn() }));
vi.mock('@/lib/ai-credit-adjustment', () => ({ applyAiCreditDelta: m.adjust }));
vi.mock('@/lib/db', () => ({ dbPrisma: {
  checkoutAttempt: { findUnique: m.find }, $transaction: m.transaction,
} }));
vi.mock('./showcase-paypal', () => ({ capturePayPalOrder: m.capture, readPayPalOrder: m.read, paypalConfigured: () => true, createPayPalOrder: vi.fn() }));
import { completeShowcaseCheckout } from './showcase-store';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { quoteShowcaseCart } from './showcase-policy';
import { CHECKOUT_AGREEMENT_VERSION, recordCheckoutAgreement } from './checkout-agreement';

const quote = quoteShowcaseCart([{ productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1 }]);
afterEach(() => vi.unstubAllEnvs());
const attempt = () => ({ orderId: 'order1', userId: 'buyer1', environment: 'SANDBOX', state: 'APPROVAL_PENDING',
  paypalOrderId: 'PAYPAL1', merchantId: 'MERCHANT1', captureRequestId: 'stable', totalOre: 3900, quote, createdAt: new Date(),
  Order: { OrderItem: [{ id: 'line1', productId: SHOWCASE_PRODUCTS.credits.id }] } });
const proof = () => ({ id: 'PAYPAL1', status: 'COMPLETED', purchase_units: [{ reference_id: 'order1', invoice_id: 'order1', custom_id: 'order1',
  amount: { currency_code: 'NOK', value: '39.00' }, payee: { merchant_id: 'MERCHANT1' },
  payments: { captures: [{ id: 'CAPTURE1', status: 'COMPLETED', final_capture: true, amount: { currency_code: 'NOK', value: '39.00' } }] },
}] });

describe('transactional checkout fulfillment', () => {
  beforeEach(() => {
    vi.resetAllMocks(); vi.stubEnv('VERCEL', ''); vi.stubEnv('VERCEL_ENV', '');
    m.find.mockResolvedValue(attempt()); m.fresh.mockResolvedValue(attempt()); m.capture.mockResolvedValue(proof()); m.read.mockResolvedValue(proof());
    m.files.mockResolvedValue([]); m.cart.mockResolvedValue(null);
    m.transaction.mockImplementation(async callback => callback({
      $executeRaw: m.lock, checkoutAttempt: { findUniqueOrThrow: m.fresh, update: m.update },
      aiCreditAccount: { upsert: m.account }, aiCreditEntry: { create: m.entry }, digitalProductFile: { findMany: m.files },
      downloadToken: { create: m.token }, order: { update: m.order }, cart: { findUnique: m.cart }, cartItem: { deleteMany: m.remove },
    }));
  });
  it('queues an original confirmation in the verified fulfillment transaction, never on replay', async () => {
    const agreed = { ...attempt(), quote: { ...quote, agreement: recordCheckoutAgreement(quote,
      { version: CHECKOUT_AGREEMENT_VERSION, files: false, credits: true }, false) } };
    m.find.mockResolvedValue(agreed); m.fresh.mockResolvedValue(agreed);
    await completeShowcaseCheckout('order1', 'buyer1');
    expect(m.email).toHaveBeenCalledOnce();
    expect(m.email).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sourceKey: 'purchase:order1',
      userId: 'buyer1', paymentEnvironment: 'SANDBOX', original: expect.stringContaining('CAPTURE1') }));
    m.find.mockResolvedValue({ ...agreed, state: 'COMPLETED' });
    await completeShowcaseCheckout('order1', 'buyer1');
    expect(m.email).toHaveBeenCalledOnce();
  });
  it('grants sandbox credits only to a sandbox account in the completion transaction', async () => {
    await completeShowcaseCheckout('order1', 'buyer1');
    expect(m.transaction).toHaveBeenCalledOnce();
    expect(m.account).toHaveBeenCalledWith({ where: { id: 'SANDBOX:buyer1' }, create: { id: 'SANDBOX:buyer1', userId: 'buyer1', environment: 'SANDBOX', balance: 0 }, update: {} });
    expect(m.adjust).toHaveBeenCalledWith(expect.anything(), 'SANDBOX:buyer1', 100);
    expect(m.entry).toHaveBeenCalledWith({ data: { accountId: 'SANDBOX:buyer1', delta: 100, kind: 'PURCHASE', sourceKey: 'checkout:order1' } });
  });
  it('does not fulfill an underpaid capture', async () => {
    const p = proof(); p.purchase_units[0].payments.captures[0].amount.value = '0.01'; m.capture.mockResolvedValue(p);
    await expect(completeShowcaseCheckout('order1', 'buyer1')).rejects.toThrow('PAYMENT_BINDING_MISMATCH');
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it('grants the immutable custom amount after exact capture, not the current catalog pack', async () => {
    const customQuote = quoteShowcaseCart([{ productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1, creditAmount: 122 }]);
    const custom = { ...attempt(), totalOre: 4716, quote: customQuote };
    m.find.mockResolvedValue(custom); m.fresh.mockResolvedValue(custom);
    const p = proof(); p.purchase_units[0].amount.value = '47.16'; p.purchase_units[0].payments.captures[0].amount.value = '47.16';
    m.capture.mockResolvedValue(p); m.cart.mockResolvedValue({ id: 'cart1' });
    await completeShowcaseCheckout('order1', 'buyer1');
    expect(m.adjust).toHaveBeenCalledWith(expect.anything(), 'SANDBOX:buyer1', 122);
    expect(m.remove).toHaveBeenCalledWith({ where: { cartId: 'cart1', productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1, OR: [{ creditAmount: 122 }] } });
  });
  it('does not fulfill or capture another user’s order', async () => {
    await expect(completeShowcaseCheckout('order1', 'other')).rejects.toThrow('ORDER_NOT_FOUND');
    expect(m.capture).not.toHaveBeenCalled();
  });
  it('does not grant twice when another request completed while waiting for the lock', async () => {
    m.fresh.mockResolvedValue({ ...attempt(), state: 'COMPLETED' });
    expect(await completeShowcaseCheckout('order1', 'buyer1')).toHaveProperty('alreadyCompleted', true);
    expect(m.account).not.toHaveBeenCalled(); expect(m.token).not.toHaveBeenCalled();
  });
  it('propagates duplicate capture constraint failure before granting anything', async () => {
    m.update.mockRejectedValue(new Error('unique captureId'));
    await expect(completeShowcaseCheckout('order1', 'buyer1')).rejects.toThrow('unique captureId');
    expect(m.account).not.toHaveBeenCalled();
  });
  it('reconciles but never newly charges an expired attempt', async () => {
    m.find.mockResolvedValue({ ...attempt(), createdAt: new Date(Date.now() - 3_700_000) });
    await completeShowcaseCheckout('order1', 'buyer1');
    expect(m.capture).not.toHaveBeenCalled(); expect(m.read).toHaveBeenCalledWith('PAYPAL1');
  });
  it('does not mint paid credits for a demo preview', async () => {
    const demo = { ...attempt(), userId: 'demo_visitor', environment: 'DEMO' };
    m.find.mockResolvedValue(demo); m.fresh.mockResolvedValue(demo);
    await completeShowcaseCheckout('order1', 'demo_visitor');
    expect(m.capture).not.toHaveBeenCalled(); expect(m.account).not.toHaveBeenCalled();
  });
  it.each(['REFUNDED', 'REVERSED', 'PAYMENT_REVIEW'])('does not regrant an order in %s', async state => {
    m.fresh.mockResolvedValue({ ...attempt(), state });
    await expect(completeShowcaseCheckout('order1', 'buyer1')).rejects.toThrow('ORDER_PAYMENT_ADJUSTED');
    expect(m.account).not.toHaveBeenCalled(); expect(m.token).not.toHaveBeenCalled();
  });
});
