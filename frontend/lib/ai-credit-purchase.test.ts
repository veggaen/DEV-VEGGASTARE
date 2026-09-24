/** @fileOverview Custom quantities, marginal discounts and fail-closed commercial safety. @stability stable */
import { describe, expect, it } from 'vitest';
import { FUNDED_AI_MODELS } from './ai-chat/credit-policy';
import { quoteCreditPurchase, creditSaleEconomics, MIN_PURCHASE_CREDITS, MAX_PURCHASE_CREDITS, DAILY_PURCHASE_CAP_ORE } from './ai-credit-purchase';

describe('custom credit purchase pricing', () => {
  it('prices the small pack explicitly without changing normal pack prices', () => {
    expect(quoteCreditPurchase(10)).toEqual({ credits: 10, amountOre: 900, listAmountOre: 900,
      discountOre: 0, currency: 'NOK', pricingVersion: '2026-09-small-v1' });
    expect(quoteCreditPurchase(100)).toMatchObject({ amountOre: 3900, pricingVersion: '2026-09-custom-v1' });
  });
  it.each([[100, 3900], [122, 4716], [500, 18720], [555, 20651], [1000, 36270]])('quotes %i exact credits at %i ore', (credits, amountOre) => {
    expect(quoteCreditPurchase(credits)).toMatchObject({ credits, amountOre, currency: 'NOK', discountOre: credits * 39 - amountOre });
  });
  it.each([0, 1, 9, 11, 99, 1001, -100, 122.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, '10', '122', null, undefined])('rejects invalid amount %s rather than coercing it', credits => {
    expect(() => quoteCreditPurchase(credits as number)).toThrow('INVALID_CREDIT_AMOUNT');
  });
  it('is strictly increasing across every allowed amount with no discount cliff', () => {
    let previous = 0;
    for (let credits = MIN_PURCHASE_CREDITS; credits <= MAX_PURCHASE_CREDITS; credits++) {
      const quote = quoteCreditPurchase(credits);
      expect(Number.isSafeInteger(quote.amountOre)).toBe(true);
      expect(quote.amountOre).toBeGreaterThan(previous);
      expect(quote.amountOre).toBeLessThanOrEqual(credits * 39);
      expect(quote.discountOre).toBeLessThanOrEqual(Math.floor(quote.listAmountOre * 0.1));
      expect(quote.amountOre + 2900).toBeLessThanOrEqual(DAILY_PURCHASE_CAP_ORE);
      previous = quote.amountOre;
    }
  });
});

describe('credit sale margin guard', () => {
  it('keeps the small pack above the existing safety margin without bypassing cost checks', () => {
    expect(creditSaleEconomics(10, FUNDED_AI_MODELS)).toMatchObject({ amountOre: 900,
      providerAllowanceOre: 188, paymentAllowanceOre: 334, taxAllowanceOre: 180,
      contributionOre: 198, minimumContributionOre: 135, eligible: true });
    expect(creditSaleEconomics(10, [{ credits: 1, reserveMicroUsd: 100_000 }]).eligible).toBe(false);
  });
  it('covers every quantity under the current reviewed model ceilings and safety allowances', () => {
    for (let credits = MIN_PURCHASE_CREDITS; credits <= MAX_PURCHASE_CREDITS; credits++) {
      const economics = creditSaleEconomics(credits, FUNDED_AI_MODELS);
      expect(economics.maxMicroUsdPerCredit).toBe(10_000);
      expect(economics.eligible).toBe(true);
      expect(economics.contributionOre).toBeGreaterThanOrEqual(economics.minimumContributionOre);
    }
  });
  it('denies a sale if model cost ceilings rise beyond the contribution floor', () => {
    expect(creditSaleEconomics(1000, [{ credits: 1, reserveMicroUsd: 100_000 }]).eligible).toBe(false);
  });
  it.each([[], [{ credits: 0, reserveMicroUsd: 5000 }], [{ credits: 1, reserveMicroUsd: 0 }], [{ credits: 1, reserveMicroUsd: Infinity }], [{ credits: -1, reserveMicroUsd: 1000 }]].map(models => ({ models })))('fails closed for an unreviewable cost policy', ({ models }) => {
    expect(() => creditSaleEconomics(122, models)).toThrow('CREDIT_COST_POLICY_UNAVAILABLE');
  });
});
