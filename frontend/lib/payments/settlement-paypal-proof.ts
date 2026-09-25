/** @fileOverview Currency-bound PayPal v2 proofs. Call only with authenticated server reads, never browser returns. @stability experimental */
import { z } from 'zod';
import { SettlementCurrency, SettlementError, SettlementMoney, formatMinor, parseProviderMinor } from './settlement-money';
import { readStoredSettlementQuote, type SettlementQuote } from './settlement-quote';

const Id = z.string().regex(/^[A-Z0-9]{1,36}$/);
const Amount = z.object({ currency_code: SettlementCurrency, value: z.string() });
const Merchant = z.object({ merchant_id: z.string().min(1).max(128) });
const CapturedOrder = z.object({ id: Id, status: z.literal('COMPLETED'), purchase_units: z.array(z.object({
  reference_id: z.string(), invoice_id: z.string(), custom_id: z.string(), amount: Amount,
  payee: Merchant, payments: z.object({ captures: z.array(z.object({ id: Id, status: z.literal('COMPLETED'),
    final_capture: z.literal(true), amount: Amount })).length(1) }),
})).length(1) });
const CaptureDetails = z.object({ id: Id, status: z.enum(['COMPLETED', 'DECLINED', 'PARTIALLY_REFUNDED', 'PENDING', 'REFUNDED', 'FAILED']),
  amount: Amount, invoice_id: z.string().min(1), payee: Merchant,
  supplementary_data: z.object({ related_ids: z.object({ order_id: Id }) }),
});
/** Used only to locate an attempt from a server-authenticated provider read.
 * This does not authorize a refund; verify the complete stored binding next. */
export function readSettlementCaptureDetails(input: unknown) {
  const parsed = CaptureDetails.safeParse(input);
  if (!parsed.success) throw new SettlementError('CAPTURE_PROOF_INVALID');
  return parsed.data;
}
const Refund = z.object({ id: Id, status: z.literal('COMPLETED'), amount: Amount,
  seller_payable_breakdown: z.object({ total_refunded_amount: Amount.optional() }).optional(),
  links: z.array(z.object({ rel: z.string(), method: z.string(), href: z.string().url() })).max(20),
});
export type SettlementBinding = {
  orderId: string; paypalOrderId: string; merchantId: string; money: SettlementMoney;
};
function equalMoney(actual: z.infer<typeof Amount>, expected: SettlementMoney) {
  return actual.currency_code === expected.currency && parseProviderMinor(actual.value) === expected.minor;
}
function validateBinding(expected: SettlementBinding) {
  if (!expected.orderId || !Id.safeParse(expected.paypalOrderId).success || !expected.merchantId ||
      !SettlementMoney.safeParse(expected.money).success || expected.money.minor <= 0) throw new SettlementError('INVALID_PAYMENT_BINDING');
}

/** Uses frozen charged money, NEVER the NOK exposure valuation or display FX.
 * Expiry is checked when accepting a new quote, not when reconciling a paid order. */
export function settlementPurchaseUnit(orderId: string, input: SettlementQuote) {
  const quote = readStoredSettlementQuote(input);
  if (!orderId || orderId.length > 127) throw new SettlementError('INVALID_PAYMENT_BINDING');
  const amount = (minor: number) => ({ currency_code: quote.currency, value: formatMinor(minor) });
  return { reference_id: orderId, invoice_id: orderId, custom_id: orderId, description: 'Veggat Studio digital order',
    amount: { ...amount(quote.totalMinor), breakdown: { item_total: amount(quote.totalMinor) } },
    items: quote.lines.map(line => ({ name: line.title, sku: line.productId, quantity: '1', category: 'DIGITAL_GOODS',
      unit_amount: amount(line.amountMinor) })),
  };
}

export function verifySettlementCapture(input: unknown, expected: SettlementBinding) {
  validateBinding(expected);
  const parsed = CapturedOrder.safeParse(input);
  if (!parsed.success) throw new SettlementError('PAYMENT_NOT_COMPLETED');
  const order = parsed.data, unit = order.purchase_units[0], capture = unit.payments.captures[0];
  if (order.id !== expected.paypalOrderId || unit.reference_id !== expected.orderId || unit.invoice_id !== expected.orderId ||
      unit.custom_id !== expected.orderId || unit.payee.merchant_id !== expected.merchantId ||
      !equalMoney(unit.amount, expected.money) || !equalMoney(capture.amount, expected.money)) throw new SettlementError('PAYMENT_BINDING_MISMATCH');
  return { captureId: capture.id, money: { ...expected.money } };
}

/** Extract only the capture ID. Provider links are never fetched as URLs. */
export function readSettlementRefundProof(input: unknown, refundId: string, environment: 'LIVE' | 'SANDBOX') {
  const parsed = Refund.safeParse(input);
  if (!parsed.success || parsed.data.id !== refundId || !['LIVE', 'SANDBOX'].includes(environment)) throw new SettlementError('REFUND_PROOF_INVALID');
  const refund = parsed.data, up = refund.links.filter(link => link.rel === 'up' && link.method === 'GET');
  if (up.length !== 1) throw new SettlementError('REFUND_CAPTURE_REFERENCE_INVALID');
  const url = new URL(up[0].href);
  const origins = environment === 'LIVE' ? ['https://api-m.paypal.com', 'https://api.paypal.com'] :
    ['https://api-m.sandbox.paypal.com', 'https://api.sandbox.paypal.com'];
  const match = /^\/v2\/payments\/captures\/([A-Z0-9]{1,36})$/.exec(url.pathname);
  if (!origins.includes(url.origin) || url.username || url.password || url.search || url.hash || !match) throw new SettlementError('REFUND_CAPTURE_REFERENCE_INVALID');
  const money = { currency: refund.amount.currency_code, minor: parseProviderMinor(refund.amount.value) };
  const cumulative = refund.seller_payable_breakdown?.total_refunded_amount;
  const cumulativeMinor = cumulative ? parseProviderMinor(cumulative.value) : null;
  if (money.minor <= 0 || (cumulative && (cumulative.currency_code !== money.currency || cumulativeMinor! < money.minor))) throw new SettlementError('REFUND_AMOUNT_INVALID');
  return { refundId, captureId: match[1], money, cumulativeMinor };
}

export function verifySettlementAdjustment(captureInput: unknown, expected: SettlementBinding & { captureId: string | null },
  requestedCaptureId: string, refund?: ReturnType<typeof readSettlementRefundProof>) {
  validateBinding(expected);
  if (expected.captureId !== null && !Id.safeParse(expected.captureId).success) throw new SettlementError('INVALID_PAYMENT_BINDING');
  const parsed = CaptureDetails.safeParse(captureInput);
  if (!parsed.success) throw new SettlementError('CAPTURE_PROOF_INVALID');
  const capture = parsed.data;
  if (capture.id !== requestedCaptureId || (expected.captureId && capture.id !== expected.captureId) ||
      capture.invoice_id !== expected.orderId || capture.supplementary_data.related_ids.order_id !== expected.paypalOrderId ||
      capture.payee.merchant_id !== expected.merchantId || !equalMoney(capture.amount, expected.money)) throw new SettlementError('PAYMENT_BINDING_MISMATCH');
  // The caller must have independently verified PAYMENT.CAPTURE.REVERSED's
  // signature. PayPal's GET enum has no REVERSED status; it proves the binding.
  if (!refund) return { state: 'REVERSED' as const, money: { ...expected.money }, reference: capture.id };
  if (!SettlementMoney.safeParse(refund.money).success || !Id.safeParse(refund.refundId).success ||
      refund.captureId !== capture.id || refund.money.currency !== expected.money.currency ||
      refund.money.minor > expected.money.minor || refund.money.minor <= 0 ||
      (refund.cumulativeMinor !== null && (!Number.isSafeInteger(refund.cumulativeMinor) || refund.cumulativeMinor > expected.money.minor || refund.cumulativeMinor < refund.money.minor))) throw new SettlementError('REFUND_AMOUNT_INVALID');
  if (capture.status === 'REFUNDED') return { state: 'REFUNDED' as const, money: { ...expected.money }, reference: refund.refundId };
  // No guess about which item was refunded; existing review/revocation policy
  // must hold entitlements when a partial adjustment cannot be attributed.
  if (capture.status === 'PARTIALLY_REFUNDED' && refund.cumulativeMinor !== null && refund.cumulativeMinor < expected.money.minor) {
    return { state: 'PAYMENT_REVIEW' as const, money: { currency: expected.money.currency, minor: refund.cumulativeMinor }, reference: refund.refundId };
  }
  throw new SettlementError('REFUND_CAPTURE_NOT_RECONCILED');
}
