/** @fileOverview PayPal transport tests use mocked network only, never real charges. @stability stable */
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createPayPalOrder, capturePayPalOrder, readPayPalCapture, readPayPalRefund, paypalConfigured } from './showcase-paypal';
import { quoteShowcaseCart } from './showcase-policy';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function setup() {
  vi.stubEnv('PAYPAL_CLIENT_ID', 'unit-client'); vi.stubEnv('PAYPAL_CLIENT_SECRET', 'unit-secret');
  vi.stubEnv('VERCEL', ''); vi.stubEnv('VERCEL_ENV', ''); vi.stubEnv('AUTH_URL', 'http://localhost:3000');
  const network = vi.fn(); vi.stubGlobal('fetch', network); return network;
}
describe('PayPal transport', () => {
  it('keeps Live checkout closed until its webhook ID is present', async () => {
    const network = setup(); vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('PAYPAL_WEBHOOK_ID', '');
    expect(paypalConfigured()).toBe(false);
    await expect(capturePayPalOrder('ORDER1', 'stable')).rejects.toThrow('PAYPAL_NOT_CONFIGURED');
    expect(network).not.toHaveBeenCalled();
    vi.stubEnv('PAYPAL_WEBHOOK_ID', 'live-webhook'); expect(paypalConfigured()).toBe(true);
  });
  it('allows local Sandbox capture with only Sandbox credentials', () => {
    setup(); vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('PAYPAL_WEBHOOK_ID', '');
    expect(paypalConfigured()).toBe(true);
  });
  it('sends authoritative separate items, stable idempotency and trusted return URL', async () => {
    const network = setup();
    network.mockResolvedValueOnce(Response.json({ access_token: 'unit-token' })).mockResolvedValueOnce(Response.json({
      id: 'ORDER1', purchase_units: [{ payee: { merchant_id: 'MERCHANT1' } }], links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER1' }],
    }));
    const quote = quoteShowcaseCart(Object.values(SHOWCASE_PRODUCTS).map(sku => ({ productId: sku.id, quantity: 1 })));
    await createPayPalOrder('internal1', quote, 'stable-idempotency');
    const [url, options] = network.mock.calls[1];
    expect(url).toBe('https://api-m.sandbox.paypal.com/v2/checkout/orders');
    expect(options.headers['PayPal-Request-Id']).toBe('stable-idempotency');
    const payload = JSON.parse(options.body);
    expect(payload.purchase_units[0].items).toHaveLength(2);
    expect(payload.purchase_units[0].amount.value).toBe('68.00');
    expect(payload.payment_source.paypal.experience_context.return_url).toBe('http://localhost:3000/checkout/return?orderId=internal1');
  });
  it('reconciles completed payment without sending another capture', async () => {
    const network = setup(); network.mockResolvedValueOnce(Response.json({ access_token: 'unit-token' })).mockResolvedValueOnce(Response.json({ status: 'COMPLETED' }));
    expect(await capturePayPalOrder('ORDER1', 'stable')).toEqual({ status: 'COMPLETED' });
    expect(network).toHaveBeenCalledTimes(2);
  });
  it('fails closed without secrets before making network requests', async () => {
    const network = setup(); vi.stubEnv('PAYPAL_CLIENT_SECRET', '');
    await expect(capturePayPalOrder('ORDER1', 'stable')).rejects.toThrow('PAYPAL_NOT_CONFIGURED');
    expect(network).not.toHaveBeenCalled();
  });
  it.each([[readPayPalCapture, 'captures'], [readPayPalRefund, 'refunds']] as const)('uses a locked GET endpoint for adjustment proof %#', async (read, resource) => {
    const network = setup(); network.mockResolvedValueOnce(Response.json({ access_token: 'unit-token' })).mockResolvedValueOnce(Response.json({ id: 'ID1' }));
    await read('ID1');
    expect(network.mock.calls[1][0]).toBe(`https://api-m.sandbox.paypal.com/v2/payments/${resource}/ID1`);
    expect(network.mock.calls[1][1].method).toBe('GET');
    await expect(read('../wrong')).rejects.toThrow(); expect(network).toHaveBeenCalledTimes(2);
  });
});
