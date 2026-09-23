/** @fileOverview Server-only PayPal transport, environment-locked and idempotent. @stability experimental */
import 'server-only';
import { z } from 'zod';
import { authOrigin } from '@/lib/auth-navigation';
import { CheckoutError, moneyString, paypalEnvironment, validateApprovalUrl, type ShowcaseQuote } from './showcase-policy';

const Id = z.string().regex(/^[A-Z0-9]{1,36}$/);
const Token = z.object({ access_token: z.string().min(1) });

export function paypalConfigured() {
  // Do not open Live checkout before refund/reversal notifications can be
  // verified. Local Sandbox can exercise server capture before HTTPS setup.
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET &&
    (paypalEnvironment().mode === 'SANDBOX' || process.env.PAYPAL_WEBHOOK_ID));
}

async function request(path: string, options: { method?: 'GET' | 'POST'; body?: unknown; requestId?: string } = {}) {
  if (!paypalConfigured()) throw new CheckoutError('PAYPAL_NOT_CONFIGURED', 503);
  const { apiOrigin } = paypalEnvironment();
  const tokenResponse = await fetch(`${apiOrigin}/v1/oauth2/token`, {
    method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials',
  });
  if (!tokenResponse.ok) throw new CheckoutError('PAYPAL_AUTH_UNAVAILABLE', 503);
  const token = Token.parse(await tokenResponse.json());
  const response = await fetch(`${apiOrigin}${path}`, {
    method: options.method ?? 'GET', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation',
      ...(options.requestId ? { 'PayPal-Request-Id': options.requestId } : {}) },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  // Do not log provider payloads: they may include payer PII or access tokens.
  if (!response.ok) throw new CheckoutError('PAYPAL_REQUEST_FAILED', 502);
  return response.json();
}

export async function createPayPalOrder(orderId: string, quote: ShowcaseQuote, requestId: string) {
  const origin = authOrigin();
  const body = await request('/v2/checkout/orders', { method: 'POST', requestId, body: {
    intent: 'CAPTURE', purchase_units: [{ reference_id: orderId, invoice_id: orderId, custom_id: orderId,
      description: 'Veggat reviewer marketplace order',
      amount: { currency_code: 'NOK', value: moneyString(quote.totalOre), breakdown: {
        item_total: { currency_code: 'NOK', value: moneyString(quote.totalOre) },
      } },
      items: quote.lines.map(line => ({ name: line.title, sku: line.productId, quantity: '1', category: 'DIGITAL_GOODS',
        unit_amount: { currency_code: 'NOK', value: moneyString(line.amountOre) } })),
    }], payment_source: { paypal: { experience_context: {
      brand_name: 'Veggat', shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW',
      return_url: `${origin}/checkout/return?orderId=${encodeURIComponent(orderId)}`,
      cancel_url: `${origin}/checkout?cancelled=1`,
    } } },
  } });
  const result = z.object({ id: Id, purchase_units: z.array(z.object({ payee: z.object({ merchant_id: z.string().min(1) }) })).length(1),
    links: z.array(z.object({ rel: z.string(), href: z.string().url() })) }).parse(body);
  const approval = result.links.find(link => link.rel === 'payer-action' || link.rel === 'approve');
  if (!approval) throw new CheckoutError('PAYPAL_APPROVAL_MISSING', 502);
  return { paypalOrderId: result.id, merchantId: result.purchase_units[0].payee.merchant_id, approvalUrl: validateApprovalUrl(approval.href) };
}

export async function readPayPalOrder(id: string) { return request(`/v2/checkout/orders/${Id.parse(id)}`); }
export async function readPayPalCapture(id: string) { return request(`/v2/payments/captures/${Id.parse(id)}`); }
export async function readPayPalRefund(id: string) { return request(`/v2/payments/refunds/${Id.parse(id)}`); }
export async function capturePayPalOrder(id: string, requestId: string) {
  // If a previous response was lost, GET lets the caller reconcile COMPLETED.
  const existing = await readPayPalOrder(id);
  if (existing.status === 'COMPLETED') return existing;
  if (existing.status !== 'APPROVED') throw new CheckoutError('PAYMENT_NOT_APPROVED', 409);
  return request(`/v2/checkout/orders/${Id.parse(id)}/capture`, { method: 'POST', requestId, body: {} });
}
