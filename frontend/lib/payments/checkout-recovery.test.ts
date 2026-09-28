/** @fileOverview Unpaid-order ownership, environment, expiry and cancellation race regressions. @stability stable */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ find: vi.fn(), claim: vi.fn(), cancel: vi.fn(), order: vi.fn(), read: vi.fn(), begin: vi.fn(), complete: vi.fn(), lock: vi.fn() }));
vi.mock('@/lib/db', () => ({ dbPrisma: { checkoutAttempt: { findUnique: m.find, updateMany: m.claim },
  $transaction: async (f: (tx: unknown) => unknown) => f({ $executeRaw: m.lock, checkoutAttempt: { updateMany: m.cancel }, order: { update: m.order } }),
} }));
vi.mock('./showcase-store', () => ({ beginShowcaseCheckout: m.begin, completeShowcaseCheckout: m.complete }));
vi.mock('./showcase-paypal', () => ({ readPayPalOrder: m.read }));
import { cancelUnpaidCheckout, resumeCheckout } from './checkout-recovery';
import { checkoutRecovery, checkoutExpiresAt } from './checkout-recovery-policy';
const fixture = () => ({ orderId: 'order1', userId: 'buyer', environment: 'SANDBOX', state: 'APPROVAL_PENDING', captureId: null,
  createdAt: new Date(), requestKey: 'existing-key', paypalOrderId: 'PAYPAL1', approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL1' });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('VERCEL', ''); vi.stubEnv('VERCEL_ENV', '');
  m.find.mockResolvedValue(fixture()); m.claim.mockResolvedValue({ count: 1 }); m.cancel.mockResolvedValue({ count: 1 });
  m.read.mockResolvedValue({ id: 'PAYPAL1', status: 'CREATED' });
  m.begin.mockResolvedValue({ orderId: 'order1', approvalUrl: fixture().approvalUrl });
});
afterEach(() => vi.unstubAllEnvs());
describe('order recovery', () => {
  it('resumes the immutable original request, not a new cart checkout', async () => {
    expect(await resumeCheckout('order1', 'buyer')).toEqual({ nextUrl: fixture().approvalUrl });
    expect(m.begin).toHaveBeenCalledWith('buyer', 'existing-key'); expect(m.claim).not.toHaveBeenCalled();
  });
  it.each([resumeCheckout, cancelUnpaidCheckout])('enforces ownership before provider access', async fn => {
    await expect(fn('order1', 'stranger')).rejects.toThrow('ORDER_NOT_FOUND'); expect(m.read).not.toHaveBeenCalled(); expect(m.begin).not.toHaveBeenCalled();
  });
  it.each(['LIVE', 'DEMO'])('rejects the wrong environment %s', async environment => {
    m.find.mockResolvedValue({ ...fixture(), environment });
    await expect(cancelUnpaidCheckout('order1', 'buyer')).rejects.toThrow('WRONG_PAYMENT_ENVIRONMENT'); expect(m.claim).not.toHaveBeenCalled();
  });
  it('cannot resume cancelled or expired attempts', async () => {
    m.find.mockResolvedValue({ ...fixture(), state: 'CANCELLED' }); await expect(resumeCheckout('order1', 'buyer')).rejects.toThrow('ORDER_CANCELLED');
    m.find.mockResolvedValue({ ...fixture(), createdAt: new Date(Date.now() - 3_600_001) }); await expect(resumeCheckout('order1', 'buyer')).rejects.toThrow('CHECKOUT_EXPIRED');
    expect(m.begin).not.toHaveBeenCalled();
  });
  it('bounds the payment window by the original UTC purchase day', () => {
    expect(checkoutExpiresAt(new Date('2026-09-25T23:50:00Z')).toISOString()).toBe('2026-09-26T00:00:00.000Z');
    expect(checkoutRecovery({ ...fixture(), createdAt: new Date('2026-09-25T23:50:00Z') }, 'SANDBOX', new Date('2026-09-26T00:00:00Z'))).toMatchObject({ canResume: false, canCancel: true, expired: true });
  });
  it('cancels only after claiming state and checking the provider; preserves the record', async () => {
    expect(await cancelUnpaidCheckout('order1', 'buyer')).toEqual({ cancelled: true });
    expect(m.claim.mock.invocationCallOrder[0]).toBeLessThan(m.read.mock.invocationCallOrder[0]);
    expect(m.cancel.mock.calls[0][0]).toMatchObject({ where: { state: 'CANCEL_PENDING', captureId: null }, data: { state: 'CANCELLED' } });
    expect(m.order).toHaveBeenCalledWith({ where: { id: 'order1' }, data: { status: 'CANCELLED' } });
  });
  it('is idempotent after cancellation', async () => {
    m.find.mockResolvedValue({ ...fixture(), state: 'CANCELLED' }); expect(await cancelUnpaidCheckout('order1', 'buyer')).toEqual({ cancelled: true });
    expect(m.claim).not.toHaveBeenCalled(); expect(m.read).not.toHaveBeenCalled();
  });
  it('reconciles a paid expired link instead of sending the buyer to pay again', async () => {
    m.find.mockResolvedValue({ ...fixture(), createdAt: new Date(Date.now() - 3_600_001) });
    m.read.mockResolvedValue({ id: 'PAYPAL1', status: 'COMPLETED' });
    expect(await resumeCheckout('order1', 'buyer')).toEqual({ nextUrl: '/checkout/receipt/order1' });
    expect(m.complete).toHaveBeenCalledWith('order1', 'buyer', false);
    expect(m.begin).not.toHaveBeenCalled();
  });
  it('does not reconcile a different provider order', async () => {
    m.read.mockResolvedValue({ id: 'OTHER', status: 'COMPLETED' });
    await expect(resumeCheckout('order1', 'buyer')).rejects.toThrow('PAYMENT_BINDING_MISMATCH');
    expect(m.complete).not.toHaveBeenCalled(); expect(m.begin).not.toHaveBeenCalled();
  });
  it.each(['CAPTURE_PENDING', 'COMPLETED', 'REFUNDED', 'REVERSED', 'PAYMENT_REVIEW'])('cannot cancel %s', async state => {
    m.find.mockResolvedValue({ ...fixture(), state }); await expect(cancelUnpaidCheckout('order1', 'buyer')).rejects.toThrow('ORDER_NOT_CANCELLABLE'); expect(m.read).not.toHaveBeenCalled();
  });
  it('does not cancel if capture wins the compare-and-set', async () => {
    m.claim.mockResolvedValue({ count: 0 }); await expect(cancelUnpaidCheckout('order1', 'buyer')).rejects.toThrow('ORDER_CHANGED');
    expect(m.read).not.toHaveBeenCalled(); expect(m.order).not.toHaveBeenCalled();
  });
  it('reconciles already-paid orders instead of falsely cancelling them', async () => {
    m.read.mockResolvedValue({ id: 'PAYPAL1', status: 'COMPLETED' });
    await expect(cancelUnpaidCheckout('order1', 'buyer')).rejects.toThrow('ORDER_ALREADY_PAID');
    expect(m.complete).toHaveBeenCalledWith('order1', 'buyer', false); expect(m.cancel).not.toHaveBeenCalled();
  });
  it('does not cancel an order with a pending capture', async () => {
    m.read.mockResolvedValue({ id: 'PAYPAL1', status: 'APPROVED', purchase_units: [{ payments: { captures: [{ status: 'PENDING' }] } }] });
    await expect(cancelUnpaidCheckout('order1', 'buyer')).rejects.toThrow('PAYMENT_STATUS_UNCERTAIN'); expect(m.cancel).not.toHaveBeenCalled();
  });
  it('preserves a pending cancellation after a provider outage for safe retry', async () => {
    m.read.mockRejectedValue(new Error('unavailable'));
    await expect(cancelUnpaidCheckout('order1', 'buyer')).rejects.toThrow('unavailable'); expect(m.cancel).not.toHaveBeenCalled();
    m.find.mockResolvedValue({ ...fixture(), state: 'CANCEL_PENDING' }); m.read.mockResolvedValue({ id: 'PAYPAL1', status: 'CREATED' });
    await expect(cancelUnpaidCheckout('order1', 'buyer')).resolves.toEqual({ cancelled: true });
  });
  it('does not overwrite fulfillment winning the final cancellation race', async () => {
    m.cancel.mockResolvedValue({ count: 0 }); await expect(cancelUnpaidCheckout('order1', 'buyer')).rejects.toThrow('ORDER_CHANGED'); expect(m.order).not.toHaveBeenCalled();
  });
  it('checks an uncertain existing capture with its original identity', async () => {
    m.find.mockResolvedValue({ ...fixture(), state: 'CAPTURE_PENDING' });
    expect(await resumeCheckout('order1', 'buyer')).toEqual({ nextUrl: '/checkout/receipt/order1' });
    expect(m.complete).toHaveBeenCalledWith('order1', 'buyer'); expect(m.begin).not.toHaveBeenCalled();
  });
  it('rejects a provider URL for the wrong payment environment', async () => {
    m.begin.mockResolvedValue({ approvalUrl: 'https://www.paypal.com/checkoutnow?token=PAYPAL1' });
    await expect(resumeCheckout('order1', 'buyer')).rejects.toThrow('INVALID_APPROVAL_URL');
  });
});
