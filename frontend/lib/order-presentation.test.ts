/** @fileOverview Truthful monetary labels and receipt-route regressions. @stability stable */
import { describe, expect, it } from 'vitest';
import { orderMoney, orderReceiptHref, orderStatusLabel } from './order-presentation';

describe('truthful order presentation', () => {
  it('does not call a completed demo order paid', () => {
    expect(orderStatusLabel({ status: 'COMPLETED', checkout: { environment: 'DEMO', state: 'COMPLETED', captureId: null } })).toBe('Demo ready');
  });
  it('requires server capture provenance for verified checkout labels', () => {
    expect(orderStatusLabel({ status: 'COMPLETED', checkout: { environment: 'LIVE', state: 'COMPLETED', captureId: null } })).toBe('Awaiting payment');
    expect(orderStatusLabel({ status: 'COMPLETED', checkout: { environment: 'LIVE', state: 'COMPLETED', captureId: 'verified-capture' } })).toBe('Payment verified');
    expect(orderStatusLabel({ status: 'COMPLETED', checkout: { environment: 'SANDBOX', state: 'COMPLETED', captureId: 'test-capture' } })).toBe('Sandbox verified');
  });
  it('does not infer money or currency from legacy completed orders', () => {
    expect(orderStatusLabel({ status: 'COMPLETED' })).toBe('Completed');
    expect(orderMoney(68)).toContain('currency not recorded');
    expect(orderMoney(68, 'NOK')).toContain('NOK');
    expect(orderMoney(0, 'NOK')).toContain('0.00');
  });
  it('links modern receipts without losing legacy order routes', () => {
    expect(orderReceiptHref({ id: 'order', checkout: { environment: 'DEMO', state: 'COMPLETED', captureId: null } })).toBe('/checkout/receipt/order');
    expect(orderReceiptHref({ id: 'order' })).toBe('/order-confirmation/order');
  });
  it('does not label a refunded capture as paid', () => {
    expect(orderStatusLabel({ status: 'COMPLETED', checkout: { environment: 'LIVE', state: 'REFUNDED', captureId: 'refunded-capture' } })).toBe('Refunded');
  });
  it.each([['REVERSED', 'Payment reversed'], ['PAYMENT_REVIEW', 'Payment under review']])('shows %s ahead of environment labels', (state, label) => {
    for (const environment of ['LIVE', 'SANDBOX'] as const) {
      expect(orderStatusLabel({ status: 'COMPLETED', checkout: { environment, state, captureId: 'capture' } })).toBe(label);
    }
  });
});
