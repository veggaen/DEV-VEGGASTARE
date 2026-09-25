/** @fileOverview PayPal transport tests use mocked network only, never real charges. @stability stable */
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createPayPalOrder, capturePayPalOrder, readPayPalCapture, readPayPalRefund, paypalConfigured } from './showcase-paypal';
import { quoteShowcaseCart } from './showcase-policy';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { quoteSettlementCart } from './settlement-quote';

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
  it('creates an exact USD order with native line/total money and the original idempotency key', async () => {
    const network = setup();
    network.mockResolvedValueOnce(Response.json({ access_token: 'unit-token' })).mockResolvedValueOnce(Response.json({
      id: 'ORDER1', purchase_units: [{ payee: { merchant_id: 'MERCHANT1' } }], links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER1' }],
    }));
    const now = Date.parse('2026-09-25T12:00:00Z');
    const quote = quoteSettlementCart({ currency: 'USD', items: [{ productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1, credits: { type: 'spend', amount: '100' } }] },
      { now, fx: { source: 'ECB_VIA_FRANKFURTER', base: 'NOK', currency: 'USD', rate: '0.105', publishedOn: '2026-09-25', fetchedAt: new Date(now).toISOString() },
        models: [{ credits: 1, reserveMicroUsd: 10000 }], modelCostReviewBy: '2026-10-24T00:00:00Z' });
    await createPayPalOrder('internal-usd', quote, 'same-native-idempotency');
    const [url, options] = network.mock.calls[1], unit = JSON.parse(options.body).purchase_units[0];
    expect(url).toBe('https://api-m.sandbox.paypal.com/v2/checkout/orders');
    expect(options.headers['PayPal-Request-Id']).toBe('same-native-idempotency');
    expect(unit.amount).toMatchObject({ value: '100.00', currency_code: 'USD' });
    expect(unit.items[0].unit_amount).toEqual({ value: '100.00', currency_code: 'USD' });
    expect(unit.amount.breakdown.item_total).toEqual(unit.items[0].unit_amount);
    expect(unit).not.toHaveProperty('exposureNokOre');
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
