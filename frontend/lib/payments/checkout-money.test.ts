import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { checkoutMoney, purchasedCartFilters, verifyCheckoutCapture } from './checkout-money';
import { quoteShowcaseCart } from './showcase-policy';
import { quoteSettlementCart } from './settlement-quote';
import { CHECKOUT_AGREEMENT_VERSION, purchaseConfirmation, recordCheckoutAgreement } from './checkout-agreement';

const now = Date.parse('2026-09-25T12:00:00Z'), productId = SHOWCASE_PRODUCTS.credits.id;
const nativeQuote = () => quoteSettlementCart({ currency: 'USD', items: [{ productId, quantity: 1, credits: { type: 'spend', amount: '100' } }] },
  { now, fx: { source: 'ECB_VIA_FRANKFURTER', base: 'NOK', currency: 'USD', rate: '0.105', publishedOn: '2026-09-25', fetchedAt: new Date(now).toISOString() },
    models: [{ credits: 1, reserveMicroUsd: 10000 }], modelCostReviewBy: '2026-10-24T00:00:00Z' });
function exact() {
  const settlement = nativeQuote();
  return { orderId: 'order1', userId: 'buyer1', currency: 'USD', environment: 'SANDBOX',
    totalOre: settlement.exposureNokOre, totalMinor: 10000, refundedMinor: 0, refundedOre: 0, settlementQuoteId: randomUUID(),
    paypalOrderId: 'PAYPAL1', merchantId: 'MERCHANT1', captureId: 'CAPTURE1', completedAt: new Date(now),
    quote: { settlement, agreement: recordCheckoutAgreement(settlement, { version: CHECKOUT_AGREEMENT_VERSION, files: false, credits: true }, false, new Date(now)),
      cartLines: [{ id: 'line1', productId, updatedAt: new Date(now).toISOString(), creditAmount: settlement.lines[0].credits, creditSpendMinor: 10000, creditSpendCurrency: 'USD' }] } };
}
const legacy = () => { const quote = quoteShowcaseCart([{ productId, quantity: 1 }]); return { quote, totalOre: quote.totalOre, currency: 'NOK', refundedOre: 0 }; };

describe('original payment money across checkout versions', () => {
  it('never substitutes NOK exposure for native cash', () => {
    const attempt = exact(), pricing = checkoutMoney(attempt);
    expect(pricing.money).toEqual({ currency: 'USD', minor: 10000 });
    expect(attempt.totalOre).not.toBe(10000);
    expect(pricing.lines[0].amountMinor).toBe(10000);
  });
  it('preserves old NOK totals and historical credit counts without repricing', () => {
    const attempt = legacy();
    attempt.quote.lines[0].title = 'Historical product title';
    attempt.quote.lines[0].amountOre = 4000; attempt.quote.totalOre = 4000; attempt.totalOre = 4000;
    expect(checkoutMoney(attempt)).toMatchObject({ version: 'legacy', money: { currency: 'NOK', minor: 4000 }, lines: [{ title: 'Historical product title', credits: 100 }] });
  });
  it.each([{ currency: 'EUR' }, { totalMinor: 1 }, { totalMinor: null }, { totalOre: 1 }, { settlementQuoteId: null },
    { refundedMinor: null }, { refundedMinor: 10001 }, { refundedOre: 1 }])('refuses corrupt or half-upgraded native records %j', patch => {
    expect(() => checkoutMoney({ ...exact(), ...patch })).toThrow('INVALID_STORED_QUOTE');
  });
  it.each([{ currency: 'USD' }, { totalMinor: 3900 }, { refundedMinor: 0 }, { totalOre: 1 }, { refundedOre: -1 }])('does not silently reinterpret a legacy record %j', patch => {
    expect(() => checkoutMoney({ ...legacy(), ...patch })).toThrow('INVALID_STORED_QUOTE');
  });
  it('captures only the original native amount and currency, never its equal-looking NOK amount', () => {
    const attempt = exact();
    const proof = { id: 'PAYPAL1', status: 'COMPLETED', purchase_units: [{ reference_id: 'order1', invoice_id: 'order1', custom_id: 'order1',
      amount: { currency_code: 'USD', value: '100.00' }, payee: { merchant_id: 'MERCHANT1' },
      payments: { captures: [{ id: 'CAPTURE1', status: 'COMPLETED', final_capture: true, amount: { currency_code: 'USD', value: '100.00' } }] } }] };
    expect(verifyCheckoutCapture(proof, attempt)).toEqual({ captureId: 'CAPTURE1', money: { currency: 'USD', minor: 10000 } });
    proof.purchase_units[0].payments.captures[0].amount.currency_code = 'NOK';
    expect(() => verifyCheckoutCapture(proof, attempt)).toThrow('PAYMENT_BINDING_MISMATCH');
    proof.purchase_units[0].payments.captures[0].amount = { currency_code: 'USD', value: '99.97' };
    expect(() => verifyCheckoutCapture(proof, attempt)).toThrow('PAYMENT_BINDING_MISMATCH');
  });
  it('keeps the exact original confirmation unchanged after refund or time/FX changes', () => {
    const attempt = exact(), text = purchaseConfirmation(attempt)!;
    expect(text).toContain('Confirmed total: 100.00 USD');
    expect(text).not.toContain('952.39 NOK'); expect(text).not.toContain('99.97');
    expect(purchaseConfirmation({ ...attempt, refundedMinor: 10000 })).toBe(text);
    expect(text).toContain(CHECKOUT_AGREEMENT_VERSION);
    expect(text).not.toContain('creditSpendMinor');
  });
  it('matches the original cart row/revision/budget, not merely the delivered credit count', () => {
    const attempt = exact();
    expect(purchasedCartFilters(attempt, 'cart1')).toEqual([{ ...attempt.quote.cartLines[0], updatedAt: new Date(now), cartId: 'cart1', quantity: 1 }]);
    expect(purchasedCartFilters(legacy(), 'cart1')[0]).toMatchObject({ creditSpendMinor: null, creditSpendCurrency: null });
    expect(() => purchasedCartFilters({ ...attempt, quote: { ...attempt.quote, cartLines: [] } }, 'cart1')).toThrow('INVALID_STORED_QUOTE');
  });
});
