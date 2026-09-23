/** @fileOverview Unsigned events and processing failures cannot be acknowledged as fulfillment. @stability stable */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ verify: vi.fn(), find: vi.fn(), complete: vi.fn() }));
vi.mock('@/lib/db', () => ({ dbPrisma: { checkoutAttempt: { findUnique: m.find } } }));
vi.mock('@/lib/payments/webhook-verify', () => ({ verifyPayPalWebhook: m.verify }));
vi.mock('@/lib/payments/showcase-store', () => ({ completeShowcaseCheckout: m.complete }));
import { POST } from '@/app/api/webhooks/paypal/route';
function request(eventType = 'PAYMENT.CAPTURE.COMPLETED') { return new Request('https://www.veggat.com/api/webhooks/paypal', {
  method: 'POST', body: JSON.stringify({ id: 'EVENT1', event_type: eventType, resource: { supplementary_data: { related_ids: { order_id: 'PAYPAL1' } } } }),
}); }
afterEach(() => vi.unstubAllEnvs());
describe('verified checkout webhook', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('PAYPAL_WEBHOOK_ID', 'unit-webhook'); m.verify.mockResolvedValue(true); m.find.mockResolvedValue({ orderId: 'order1', userId: 'buyer1' }); });
  it('rejects unsigned input before looking up an order', async () => {
    m.verify.mockResolvedValue(false); expect((await POST(request())).status).toBe(401); expect(m.find).not.toHaveBeenCalled();
  });
  it('reconciles with fresh server proof and never requests a new charge', async () => {
    expect((await POST(request())).status).toBe(200); expect(m.complete).toHaveBeenCalledWith('order1', 'buyer1', false);
  });
  it('does not fulfill from an approval event', async () => {
    expect((await POST(request('CHECKOUT.ORDER.APPROVED'))).status).toBe(200); expect(m.complete).not.toHaveBeenCalled();
  });
  it('returns retryable failure instead of losing a captured payment', async () => {
    m.complete.mockRejectedValue(new Error('database unavailable')); expect((await POST(request())).status).toBe(503);
  });
  it('fails closed without the exact webhook configuration', async () => {
    vi.stubEnv('PAYPAL_WEBHOOK_ID', ''); expect((await POST(request())).status).toBe(503); expect(m.verify).not.toHaveBeenCalled();
  });
});
