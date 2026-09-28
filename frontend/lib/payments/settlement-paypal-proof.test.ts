/** @fileOverview Exact money and currency binding for capture/refund proof; no network or grants. */
import { describe, expect, it } from 'vitest';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { quoteSettlementCart } from './settlement-quote';
import { readSettlementRefundProof, settlementPurchaseUnit, verifySettlementAdjustment, verifySettlementCapture, type SettlementBinding } from './settlement-paypal-proof';
import { formatMinor, SettlementCurrency } from './settlement-money';

const expected: SettlementBinding = { orderId: 'order1', paypalOrderId: 'PAYPAL1', merchantId: 'MERCHANT1', money: { currency: 'USD', minor: 10000 } };
function captured() { return { id: 'PAYPAL1', status: 'COMPLETED', purchase_units: [{
  reference_id: 'order1', invoice_id: 'order1', custom_id: 'order1', payee: { merchant_id: 'MERCHANT1' },
  amount: { currency_code: 'USD', value: '100.00' }, payments: { captures: [{ id: 'CAPTURE1', status: 'COMPLETED', final_capture: true,
    amount: { currency_code: 'USD', value: '100.00' } }] },
}] }; }
function capture() { return { id: 'CAPTURE1', status: 'REFUNDED', invoice_id: 'order1', payee: { merchant_id: 'MERCHANT1' },
  supplementary_data: { related_ids: { order_id: 'PAYPAL1' } }, amount: { currency_code: 'USD', value: '100.00' } }; }
function refund() { return { id: 'REFUND1', status: 'COMPLETED', amount: { currency_code: 'USD', value: '100.00' },
  seller_payable_breakdown: { total_refunded_amount: { currency_code: 'USD', value: '100.00' } },
  links: [{ rel: 'up', method: 'GET', href: 'https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE1' }] }; }
const binding = { ...expected, captureId: 'CAPTURE1' };

describe('currency-aware PayPal proof', () => {
  it('creates separate PayPal lines from charged money, never the NOK valuation', () => {
    const now = Date.parse('2026-09-25T12:00:00Z');
    const quote = quoteSettlementCart({ currency: 'USD', items: [
      { productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1, credits: { type: 'spend', amount: '100' } },
      { productId: SHOWCASE_PRODUCTS.interviewPack.id, quantity: 1 },
    ] }, { now, modelCostReviewBy: '2026-10-24T00:00:00Z', models: [{ credits: 1, reserveMicroUsd: 10000 }],
      fx: { base: 'NOK', currency: 'USD', source: 'ECB_VIA_FRANKFURTER', rate: '0.10519', publishedOn: '2026-09-25', fetchedAt: new Date(now).toISOString() } });
    const body = settlementPurchaseUnit('order1', quote);
    expect(body.amount).toEqual({ currency_code: 'USD', value: formatMinor(quote.totalMinor),
      breakdown: { item_total: { currency_code: 'USD', value: formatMinor(quote.totalMinor) } } });
    expect(body.items).toHaveLength(2);
    expect(body.items.find(line => line.sku === SHOWCASE_PRODUCTS.credits.id)!.unit_amount).toEqual({ currency_code: 'USD', value: '100.00' });
    expect(body.amount.value).not.toBe(formatMinor(quote.exposureNokOre));
    expect(() => settlementPurchaseUnit('order1', { ...quote, totalMinor: 1 })).toThrow();
  });
  it.each(SettlementCurrency.options)('accepts an exact bound capture in %s only', currency => {
    const proof = captured(); proof.purchase_units[0].amount.currency_code = currency;
    proof.purchase_units[0].payments.captures[0].amount.currency_code = currency;
    expect(verifySettlementCapture(proof, { ...expected, money: { currency, minor: 10000 } })).toEqual({ captureId: 'CAPTURE1', money: { currency, minor: 10000 } });
  });
  it.each(['unit', 'capture', 'both'])('rejects a %s currency mismatch even when the numeric amount matches', part => {
    const proof = captured();
    if (part !== 'capture') proof.purchase_units[0].amount.currency_code = 'NOK';
    if (part !== 'unit') proof.purchase_units[0].payments.captures[0].amount.currency_code = 'NOK';
    expect(() => verifySettlementCapture(proof, expected)).toThrow('PAYMENT_BINDING_MISMATCH');
  });
  it.each(['order', 'invoice', 'reference', 'custom', 'merchant', 'unitTotal', 'captureTotal'])('rejects a mismatched %s', part => {
    const proof = captured(), unit = proof.purchase_units[0];
    if (part === 'order') proof.id = 'OTHER';
    if (part === 'invoice') unit.invoice_id = 'other';
    if (part === 'reference') unit.reference_id = 'other';
    if (part === 'custom') unit.custom_id = 'other';
    if (part === 'merchant') unit.payee.merchant_id = 'OTHER';
    if (part === 'unitTotal') unit.amount.value = '99.97';
    if (part === 'captureTotal') unit.payments.captures[0].amount.value = '99.97';
    expect(() => verifySettlementCapture(proof, expected)).toThrow('PAYMENT_BINDING_MISMATCH');
  });
  it('never treats an approved/pending, split or partial capture as completed', () => {
    const approved = captured(); approved.status = 'APPROVED';
    const pending = captured(); pending.purchase_units[0].payments.captures[0].status = 'PENDING';
    const partial = captured(); partial.purchase_units[0].payments.captures[0].final_capture = false;
    const double = captured(); double.purchase_units[0].payments.captures.push({ ...double.purchase_units[0].payments.captures[0], id: 'CAPTURE2' });
    const multi = captured(); multi.purchase_units.push(multi.purchase_units[0]);
    for (const proof of [approved, pending, partial, double, multi, { token: 'PAYPAL1', PayerID: 'payer', orderId: 'order1' }]) {
      expect(() => verifySettlementCapture(proof, expected)).toThrow('PAYMENT_NOT_COMPLETED');
    }
  });
  it('validates the server binding itself', () => {
    for (const other of [{ ...expected, money: { currency: 'USD', minor: NaN } }, { ...expected, money: { currency: 'USD', minor: 0 } },
      { ...expected, paypalOrderId: '../../wrong' }, { ...expected, merchantId: '' }]) {
      expect(() => verifySettlementCapture(captured(), other as SettlementBinding)).toThrow('INVALID_PAYMENT_BINDING');
    }
  });
  it.each(SettlementCurrency.options)('reconciles full refunds in original %s without current FX', currency => {
    const r = refund(); r.amount.currency_code = currency; r.seller_payable_breakdown.total_refunded_amount.currency_code = currency;
    const c = capture(); c.amount.currency_code = currency;
    const proof = readSettlementRefundProof(r, 'REFUND1', 'SANDBOX');
    expect(verifySettlementAdjustment(c, { ...binding, money: { currency, minor: 10000 } }, 'CAPTURE1', proof))
      .toEqual({ state: 'REFUNDED', money: { currency, minor: 10000 }, reference: 'REFUND1' });
  });
  it('holds an attributable amount but not guessed item entitlements on partial refunds', () => {
    const r = refund(); r.amount.value = '10.00'; r.seller_payable_breakdown.total_refunded_amount.value = '20.00';
    const c = capture(); c.status = 'PARTIALLY_REFUNDED';
    const proof = readSettlementRefundProof(r, 'REFUND1', 'SANDBOX');
    expect(verifySettlementAdjustment(c, binding, 'CAPTURE1', proof)).toEqual({ state: 'PAYMENT_REVIEW', money: { currency: 'USD', minor: 2000 }, reference: 'REFUND1' });
    expect(() => verifySettlementAdjustment(c, binding, 'CAPTURE1', { ...proof, cumulativeMinor: null })).toThrow('REFUND_CAPTURE_NOT_RECONCILED');
  });
  it('requires amount and cumulative refund currency to match the original capture', () => {
    const r = refund(); r.amount.currency_code = 'NOK';
    expect(() => readSettlementRefundProof(r, 'REFUND1', 'SANDBOX')).toThrow('REFUND_AMOUNT_INVALID');
    r.seller_payable_breakdown.total_refunded_amount.currency_code = 'NOK';
    const proof = readSettlementRefundProof(r, 'REFUND1', 'SANDBOX');
    expect(() => verifySettlementAdjustment(capture(), binding, 'CAPTURE1', proof)).toThrow('REFUND_AMOUNT_INVALID');
    const c = capture(); c.amount.currency_code = 'NOK';
    expect(() => verifySettlementAdjustment(c, binding, 'CAPTURE1', proof)).toThrow('PAYMENT_BINDING_MISMATCH');
  });
  it.each(['https://api-m.paypal.com/v2/payments/captures/CAPTURE1', 'https://api-m.sandbox.paypal.com.evil.example/v2/payments/captures/CAPTURE1',
    'http://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE1', 'https://user@api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE1',
    'https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE1?x=1', 'https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE1#x',
    'https://api-m.sandbox.paypal.com/v2/payments/refunds/CAPTURE1'])('rejects refund reference %s', href => {
    const r = refund(); r.links[0].href = href;
    expect(() => readSettlementRefundProof(r, 'REFUND1', 'SANDBOX')).toThrow('REFUND_CAPTURE_REFERENCE_INVALID');
  });
  it('rejects extra refund references, wrong refund IDs, pending status and invalid totals', () => {
    const duplicate = refund(); duplicate.links.push(duplicate.links[0]);
    expect(() => readSettlementRefundProof(duplicate, 'REFUND1', 'SANDBOX')).toThrow('REFUND_CAPTURE_REFERENCE_INVALID');
    expect(() => readSettlementRefundProof(refund(), 'OTHER', 'SANDBOX')).toThrow('REFUND_PROOF_INVALID');
    const pending = refund(); pending.status = 'PENDING';
    expect(() => readSettlementRefundProof(pending, 'REFUND1', 'SANDBOX')).toThrow('REFUND_PROOF_INVALID');
    const zero = refund(); zero.amount.value = '0.00';
    expect(() => readSettlementRefundProof(zero, 'REFUND1', 'SANDBOX')).toThrow('REFUND_AMOUNT_INVALID');
    const r = readSettlementRefundProof(refund(), 'REFUND1', 'SANDBOX');
    for (const wrong of [{ ...r, captureId: 'OTHER' }, { ...r, money: { currency: 'USD' as const, minor: 10001 } }, { ...r, cumulativeMinor: 10001 }]) {
      expect(() => verifySettlementAdjustment(capture(), binding, 'CAPTURE1', wrong)).toThrow('REFUND_AMOUNT_INVALID');
    }
  });
  it('binds a verified reversal to the capture even before local completion', () => {
    const c = capture(); c.status = 'COMPLETED';
    expect(verifySettlementAdjustment(c, { ...binding, captureId: null }, 'CAPTURE1'))
      .toEqual({ state: 'REVERSED', money: { currency: 'USD', minor: 10000 }, reference: 'CAPTURE1' });
    expect(() => verifySettlementAdjustment(c, binding, 'OTHER')).toThrow('PAYMENT_BINDING_MISMATCH');
  });
});
