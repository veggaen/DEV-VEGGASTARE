/** @fileOverview Bind server-read refund/capture proof to the original NOK order. @stability experimental */
import { z } from 'zod';
import { CheckoutError, parseNokOre, paypalEnvironment } from './showcase-policy';

export const PayPalAdjustmentEvent = z.object({
  id: z.string().min(1).max(128),
  event_type: z.enum(['PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.CAPTURE.REVERSED']),
  resource: z.object({ id: z.string().regex(/^[A-Z0-9]{1,36}$/) }),
});
export type AdjustmentEvent = z.infer<typeof PayPalAdjustmentEvent>;
const Amount = z.object({ currency_code: z.literal('NOK'), value: z.string() });
const Capture = z.object({
  id: z.string().regex(/^[A-Z0-9]{1,36}$/),
  status: z.enum(['COMPLETED', 'DECLINED', 'PARTIALLY_REFUNDED', 'PENDING', 'REFUNDED', 'FAILED']),
  amount: Amount, invoice_id: z.string().min(1), payee: z.object({ merchant_id: z.string().min(1) }),
  supplementary_data: z.object({ related_ids: z.object({ order_id: z.string().regex(/^[A-Z0-9]{1,36}$/) }) }),
});
const Refund = z.object({
  id: z.string(), status: z.literal('COMPLETED'), amount: Amount,
  seller_payable_breakdown: z.object({ total_refunded_amount: Amount.optional() }).optional(),
  links: z.array(z.object({ rel: z.string(), method: z.string(), href: z.string().url() })),
});

/** Both inputs below must be authenticated server GET responses, never browser
 * JSON. Extract an ID from PayPal's link; never fetch a supplied HATEOAS URL. */
export function completedRefundProof(input: unknown, refundId: string) {
  const parsed = Refund.safeParse(input);
  if (!parsed.success || parsed.data.id !== refundId) throw new CheckoutError('REFUND_PROOF_INVALID', 502);
  const refund = parsed.data, links = refund.links.filter(link => link.rel === 'up' && link.method === 'GET');
  if (links.length !== 1) throw new CheckoutError('REFUND_CAPTURE_REFERENCE_INVALID', 502);
  const url = new URL(links[0].href);
  const match = /^\/v2\/payments\/captures\/([A-Z0-9]{1,36})$/.exec(url.pathname);
  if (url.origin !== paypalEnvironment().apiOrigin || url.username || url.password || url.search || url.hash || !match) {
    throw new CheckoutError('REFUND_CAPTURE_REFERENCE_INVALID', 502);
  }
  const amountOre = parseNokOre(refund.amount.value);
  const cumulative = refund.seller_payable_breakdown?.total_refunded_amount;
  const cumulativeOre = cumulative ? parseNokOre(cumulative.value) : undefined;
  if (amountOre <= 0 || (cumulativeOre !== undefined && cumulativeOre < amountOre)) throw new CheckoutError('REFUND_AMOUNT_INVALID', 502);
  return { refundId, captureId: match[1], amountOre, cumulativeOre };
}

export function captureAdjustmentDetails(input: unknown) {
  const parsed = Capture.safeParse(input);
  if (!parsed.success) throw new CheckoutError('CAPTURE_PROOF_INVALID', 502);
  return parsed.data;
}

export function verifyPaymentAdjustment(capture: z.infer<typeof Capture>, expected: {
  orderId: string; paypalOrderId: string | null; captureId: string | null; merchantId: string | null; totalOre: number;
}, requestedCaptureId: string, refund?: ReturnType<typeof completedRefundProof>) {
  if (capture.id !== requestedCaptureId || (expected.captureId && capture.id !== expected.captureId) ||
      capture.invoice_id !== expected.orderId || capture.supplementary_data.related_ids.order_id !== expected.paypalOrderId ||
      capture.payee.merchant_id !== expected.merchantId || parseNokOre(capture.amount.value) !== expected.totalOre) {
    throw new CheckoutError('PAYMENT_BINDING_MISMATCH', 409);
  }
  // PayPal's capture status enum has no REVERSED value. A VERIFIED reversal
  // webhook supplies that fact; GET independently verifies the capture binding.
  if (!refund) return { state: 'REVERSED' as const, refundedOre: expected.totalOre, reference: capture.id };
  if (refund.captureId !== capture.id || refund.amountOre > expected.totalOre ||
      (refund.cumulativeOre !== undefined && refund.cumulativeOre > expected.totalOre)) {
    throw new CheckoutError('REFUND_AMOUNT_INVALID', 502);
  }
  if (capture.status === 'REFUNDED') return { state: 'REFUNDED' as const, refundedOre: expected.totalOre, reference: refund.refundId };
  // Partial refunds do not identify cart lines. Hold access for owner review;
  // never guess which product or proportion of AI credits was refunded.
  if (capture.status === 'PARTIALLY_REFUNDED' && refund.cumulativeOre !== undefined && refund.cumulativeOre < expected.totalOre) {
    return { state: 'PAYMENT_REVIEW' as const, refundedOre: refund.cumulativeOre, reference: refund.refundId };
  }
  throw new CheckoutError('REFUND_CAPTURE_NOT_RECONCILED', 503);
}
