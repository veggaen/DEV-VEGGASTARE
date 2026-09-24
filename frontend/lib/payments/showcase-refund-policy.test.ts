/** @fileOverview Refund proof rejects cross-order, cross-environment and unverified amounts. @stability stable */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureAdjustmentDetails, completedRefundProof, verifyPaymentAdjustment } from './showcase-refund-policy';

const expected = { orderId: 'internal1', paypalOrderId: 'ORDER1', captureId: 'CAPTURE1', merchantId: 'MERCHANT1', totalOre: 3900 };
const capture = () => ({ id: 'CAPTURE1', status: 'REFUNDED', amount: { currency_code: 'NOK', value: '39.00' },
  invoice_id: 'internal1', payee: { merchant_id: 'MERCHANT1' }, supplementary_data: { related_ids: { order_id: 'ORDER1' } } });
const refund = () => ({ id: 'REFUND1', status: 'COMPLETED', amount: { currency_code: 'NOK', value: '39.00' },
  seller_payable_breakdown: { total_refunded_amount: { currency_code: 'NOK', value: '39.00' } },
  links: [{ rel: 'up', method: 'GET', href: 'https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE1' }] });
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => { vi.stubEnv('VERCEL', ''); vi.stubEnv('VERCEL_ENV', ''); });
describe('server-read PayPal adjustment proof', () => {
  it.each([
    ['SANDBOX', 'https://api.sandbox.paypal.com'],
    ['SANDBOX', 'https://api-m.sandbox.paypal.com'],
    ['LIVE', 'https://api.paypal.com'],
    ['LIVE', 'https://api-m.paypal.com'],
  ])('accepts the official %s refund reference host %s without fetching its URL', (environment, origin) => {
    vi.stubEnv('VERCEL', environment === 'LIVE' ? '1' : '');
    vi.stubEnv('VERCEL_ENV', environment === 'LIVE' ? 'production' : 'preview');
    const r = refund(); r.links[0].href = `${origin}/v2/payments/captures/CAPTURE1`;
    expect(completedRefundProof(r, 'REFUND1')).toMatchObject({ captureId: 'CAPTURE1', amountOre: 3900 });
  });
  it('verifies a completed refund against capture, invoice, amount, merchant and provider order', () => {
    expect(verifyPaymentAdjustment(captureAdjustmentDetails(capture()), expected, 'CAPTURE1', completedRefundProof(refund(), 'REFUND1')))
      .toEqual({ state: 'REFUNDED', refundedOre: 3900, reference: 'REFUND1' });
  });
  it.each(['http://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE1',
    'https://attacker.invalid/v2/payments/captures/CAPTURE1',
    'https://api-m.paypal.com/v2/payments/captures/CAPTURE1',
    'https://api.paypal.com/v2/payments/captures/CAPTURE1',
    'https://api.sandbox.paypal.com.attacker.invalid/v2/payments/captures/CAPTURE1',
    'https://api.sandbox.paypal.com:444/v2/payments/captures/CAPTURE1',
    'https://api.sandbox.paypal.com/v2/payments/captures/CAPTURE1#extra',
    'https://user:password@api.sandbox.paypal.com/v2/payments/captures/CAPTURE1',
    'https://user@api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE1',
    'https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE1?extra=1',
    'https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE1/refund',
  ])('rejects unsafe or wrong-environment capture reference %s', href => {
    const r = refund(); r.links[0].href = href;
    expect(() => completedRefundProof(r, 'REFUND1')).toThrow('REFUND_CAPTURE_REFERENCE_INVALID');
  });
  it.each(['https://api.sandbox.paypal.com', 'https://api-m.sandbox.paypal.com'])('rejects Sandbox host %s in production', origin => {
    vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_ENV', 'production');
    const r = refund(); r.links[0].href = `${origin}/v2/payments/captures/CAPTURE1`;
    expect(() => completedRefundProof(r, 'REFUND1')).toThrow('REFUND_CAPTURE_REFERENCE_INVALID');
  });
  it.each(['PENDING', 'FAILED', 'CANCELLED'])('does not revoke from a refund in %s', status => {
    expect(() => completedRefundProof({ ...refund(), status }, 'REFUND1')).toThrow('REFUND_PROOF_INVALID');
  });
  it.each(['orderId', 'paypalOrderId', 'captureId', 'merchantId'] as const)('rejects mismatched %s', field => {
    expect(() => verifyPaymentAdjustment(captureAdjustmentDetails(capture()), { ...expected, [field]: 'OTHER' }, 'CAPTURE1')).toThrow('PAYMENT_BINDING_MISMATCH');
  });
  it('rejects an over-refund, zero refund and non-NOK evidence', () => {
    const r = refund(); r.amount.value = '40.00'; r.seller_payable_breakdown.total_refunded_amount.value = '40.00';
    expect(() => verifyPaymentAdjustment(captureAdjustmentDetails(capture()), expected, 'CAPTURE1', completedRefundProof(r, 'REFUND1'))).toThrow('REFUND_AMOUNT_INVALID');
    r.amount.value = '0.00'; expect(() => completedRefundProof(r, 'REFUND1')).toThrow('REFUND_AMOUNT_INVALID');
    r.amount.currency_code = 'USD'; expect(() => completedRefundProof(r, 'REFUND1')).toThrow('REFUND_PROOF_INVALID');
  });
  it('holds a partial refund for review without guessing SKU allocation', () => {
    const r = refund(); r.amount.value = '10.00'; r.seller_payable_breakdown.total_refunded_amount.value = '10.00';
    const c = captureAdjustmentDetails({ ...capture(), status: 'PARTIALLY_REFUNDED' });
    expect(verifyPaymentAdjustment(c, expected, 'CAPTURE1', completedRefundProof(r, 'REFUND1')))
      .toEqual({ state: 'PAYMENT_REVIEW', refundedOre: 1000, reference: 'REFUND1' });
    expect(() => verifyPaymentAdjustment(c, expected, 'CAPTURE1', completedRefundProof({ ...r, seller_payable_breakdown: {} }, 'REFUND1')))
      .toThrow('REFUND_CAPTURE_NOT_RECONCILED');
  });
  it('retries eventually consistent capture proof rather than acknowledging an unreconciled refund', () => {
    expect(() => verifyPaymentAdjustment(captureAdjustmentDetails({ ...capture(), status: 'COMPLETED' }), expected, 'CAPTURE1', completedRefundProof(refund(), 'REFUND1')))
      .toThrow('REFUND_CAPTURE_NOT_RECONCILED');
  });
  it('uses the verified reversal event without inventing a REVERSED capture status', () => {
    expect(verifyPaymentAdjustment(captureAdjustmentDetails({ ...capture(), status: 'COMPLETED' }), expected, 'CAPTURE1'))
      .toEqual({ state: 'REVERSED', refundedOre: 3900, reference: 'CAPTURE1' });
  });
});
