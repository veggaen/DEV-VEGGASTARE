/** @fileOverview No client-priced orders or unbound payment proof. @stability stable */
import { describe, expect, it } from 'vitest';
import { SHOWCASE_PRODUCTS as skus } from '@/lib/showcase-catalog';
import { moneyString, parseNokOre, paypalEnvironment, quoteShowcaseCart, validateApprovalUrl, verifyCapturedOrder } from './showcase-policy';

const expected = { orderId: 'internal-order', paypalOrderId: 'PAYPALORDER1', totalOre: 6800, merchantId: 'MERCHANT1' };
function proof() { return { id: 'PAYPALORDER1', status: 'COMPLETED', purchase_units: [{ reference_id: 'internal-order', invoice_id: 'internal-order', custom_id: 'internal-order',
  amount: { currency_code: 'NOK', value: '68.00' }, payee: { merchant_id: 'MERCHANT1' },
  payments: { captures: [{ id: 'CAPTURE1', status: 'COMPLETED', final_capture: true, amount: { currency_code: 'NOK', value: '68.00' } }] },
}] }; }

describe('reviewer checkout policy', () => {
  it.each([{}, { NODE_ENV: 'production' }, { VERCEL_ENV: 'production' }, { VERCEL: '1', VERCEL_ENV: 'preview' }])('never uses Live outside Vercel production: %j', env => {
    expect(paypalEnvironment(env).mode).toBe('SANDBOX');
  });
  it('uses Live only in the deployed production environment', () => {
    expect(paypalEnvironment({ VERCEL: '1', VERCEL_ENV: 'production' }).apiOrigin).toBe('https://api-m.paypal.com');
  });
  it('prices both lines in integer øre, ignoring browser price claims', () => {
    const quote = quoteShowcaseCart([{ productId: skus.credits.id, quantity: 1, amountOre: 1 }, { productId: skus.interviewPack.id, quantity: 1, price: 0 }]);
    expect(quote.totalOre).toBe(6800); expect(quote.lines).toHaveLength(2);
    expect(quote.lines.reduce((sum, line) => sum + line.credits, 0)).toBe(100);
  });
  it.each([[], [{ productId: 'unknown', quantity: 1 }], [{ productId: skus.credits.id, quantity: -1 }],
    [{ productId: skus.credits.id, quantity: 1000 }], [{ productId: skus.credits.id, quantity: 1 }, { productId: skus.credits.id, quantity: 1 }]].map(cart => ({ cart })))('rejects unsupported cart %j', ({ cart }) => {
    expect(() => quoteShowcaseCart(cart)).toThrow();
  });
  it.each(['NaN', '-1.00', '1e2', '68.001', '68', 'Infinity'])('rejects ambiguous amount %s', value => {
    expect(() => parseNokOre(value)).toThrow();
  });
  it('formats and parses exact øre', () => { expect(moneyString(2901)).toBe('29.01'); expect(parseNokOre('29.01')).toBe(2901); });
  it('accepts only bound completed capture proof', () => { expect(verifyCapturedOrder(proof(), expected).captureId).toBe('CAPTURE1'); });
  it.each(['paypalOrderId', 'orderId', 'merchantId', 'totalOre'] as const)('rejects a mismatched %s', key => {
    expect(() => verifyCapturedOrder(proof(), { ...expected, [key]: key === 'totalOre' ? 1 : 'other' })).toThrow();
  });
  it('rejects authorization without capture', () => { const p = proof(); p.status = 'APPROVED'; expect(() => verifyCapturedOrder(p, expected)).toThrow(); });
  it('rejects partial capture, wrong currency and extra captures', () => {
    const partial = proof(); partial.purchase_units[0].payments.captures[0].final_capture = false;
    expect(() => verifyCapturedOrder(partial, expected)).toThrow();
    const currency = proof(); currency.purchase_units[0].payments.captures[0].amount.currency_code = 'USD';
    expect(() => verifyCapturedOrder(currency, expected)).toThrow();
    const duplicate = proof(); duplicate.purchase_units[0].payments.captures.push(duplicate.purchase_units[0].payments.captures[0]);
    expect(() => verifyCapturedOrder(duplicate, expected)).toThrow();
  });
  it.each(['https://evil.example/approve', 'https://www.paypal.com.evil.example/', 'http://www.sandbox.paypal.com/', 'https://user@www.sandbox.paypal.com/'])('rejects unsafe approval URL %s', url => {
    expect(() => validateApprovalUrl(url, paypalEnvironment({}))).toThrow();
  });
});
