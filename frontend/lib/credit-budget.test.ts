/** @fileOverview Budget entry fails closed for invalid or stale reference FX. @stability stable */
import { expect, it } from 'vitest';
import { budgetInNokOre, quoteCreditBudget } from './credit-budget';
const rates = { USD: 1, NOK: 0.1, EUR: 1.2 };
it('accepts NOK budgets without any FX, including a decimal comma', () => {
  expect(budgetInNokOre('1 000,00', 'NOK', {}, true)).toBe(100000);
  expect(quoteCreditBudget('1000', 'NOK', {}, true)?.credits).toBe(2815);
});
it('converts a selected-currency budget into credits, never a client-set settlement price', () => {
  expect(budgetInNokOre('100', 'USD', rates, false)).toBe(100000);
  expect(quoteCreditBudget('100', 'USD', rates, false)?.amountOre).toBe(99977);
  expect(budgetInNokOre('100', 'EUR', rates, false)).toBe(120000);
});
it.each(['', '-1', 'Infinity', '1e5', '1.234', 'abc', '10000000000', '1,000.00'])('rejects malformed budget %s', text => {
  expect(budgetInNokOre(text, 'NOK', rates, false)).toBeNull();
});
it('does not invent FX or use stale conversion rates for a budget', () => {
  expect(quoteCreditBudget('100', 'USD', rates, true)).toBeNull();
  expect(quoteCreditBudget('100', 'USD', {}, false)).toBeNull();
  expect(quoteCreditBudget('100', 'EUR', { NOK: 0 }, false)).toBeNull();
});
