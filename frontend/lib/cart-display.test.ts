/** @fileOverview Original-currency display and invalid-price guards. @stability stable */
import { expect, it } from 'vitest';
import { cartCurrencyTotals, formatCartMoney } from './cart-display';
const item = (price: number, priceCurrency: string, quantity = 1) => ({ id: priceCurrency, quantity, product: { id: priceCurrency, title: 'Example', price, priceCurrency, image: [] } });
it('keeps NOK exact without waiting for exchange rates', () => {
  expect(cartCurrencyTotals([item(29, 'NOK'), item(39, 'NOK')])).toEqual([{ currency: 'NOK', formatted: formatCartMoney(68, 'NOK') }]);
});
it('does not add unrelated currencies together', () => {
  expect(cartCurrencyTotals([item(29, 'NOK', 2), item(10, 'USD')])).toEqual([
    { currency: 'NOK', formatted: formatCartMoney(58, 'NOK') }, { currency: 'USD', formatted: formatCartMoney(10, 'USD') },
  ]);
});
it('fails closed for invalid prices, currency or overflowing totals', () => {
  for (const value of [item(-1, 'NOK'), item(Infinity, 'NOK'), item(NaN, 'NOK'), item(29, 'INVALID')]) expect(cartCurrencyTotals([value])).toBeNull();
  expect(cartCurrencyTotals([item(Number.MAX_VALUE, 'NOK'), item(Number.MAX_VALUE, 'NOK')])).toBeNull();
});
