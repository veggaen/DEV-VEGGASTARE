/** @fileOverview Bounded custom-credit prices and conservative sale economics; never accepts a client amount. @stability experimental */
export const MIN_PURCHASE_CREDITS = 100;
export const MAX_PURCHASE_CREDITS = 1000;
export const DEFAULT_PURCHASE_CREDITS = 100;
export const CREDIT_BASE_UNIT_ORE = 39;
export const CREDIT_PRICE_VERSION = '2026-09-custom-v1';
export const DAILY_PURCHASE_CAP_ORE = 50_000;

// Marginal discounts: adding a credit always increases the price. The first 100
// stay at the original 39 NOK, protecting small purchases from fixed fees.
export const CREDIT_PRICE_TIERS = [
  { upTo: 100, discountBps: 0 },
  { upTo: 500, discountBps: 500 },
  { upTo: MAX_PURCHASE_CREDITS, discountBps: 1000 },
] as const;

export function quoteCreditPurchase(credits: number) {
  if (!Number.isSafeInteger(credits) || credits < MIN_PURCHASE_CREDITS || credits > MAX_PURCHASE_CREDITS) {
    throw new Error('INVALID_CREDIT_AMOUNT');
  }
  let previous = 0, priceBasisPoints = 0;
  for (const tier of CREDIT_PRICE_TIERS) {
    const count = Math.max(0, Math.min(credits, tier.upTo) - previous);
    priceBasisPoints += count * CREDIT_BASE_UNIT_ORE * (10_000 - tier.discountBps);
    previous = tier.upTo;
  }
  // Round once, up to the nearest ore; never round a discounted unit to zero.
  const amountOre = Math.ceil(priceBasisPoints / 10_000);
  const listAmountOre = credits * CREDIT_BASE_UNIT_ORE;
  return { credits, amountOre, listAmountOre, discountOre: listAmountOre - amountOre,
    currency: 'NOK' as const, pricingVersion: CREDIT_PRICE_VERSION };
}
export type CreditPurchaseQuote = ReturnType<typeof quoteCreditPurchase>;

// Deliberately conservative planning allowances, NOT the merchant's actual
// statement, a tax determination, or a guarantee against fraud/chargebacks.
// PayPal NO standard 3.40% + 2.80 NOK, plus up to 1.99% international (reviewed
// 2026-09-23). Reserve 6%; no merchant-side FX is expected on NOK settlement.
// 20% of gross reserves the equivalent of 25% VAT-inclusive pricing if applicable.
export const CREDIT_SALE_SAFETY = {
  providerNokOrePerUsd: 1500,
  paymentFeeBps: 600,
  paymentFixedOre: 280,
  taxReserveBps: 2000,
  failedUsageAllowanceBps: 2500,
  minimumContributionBps: 1500,
} as const;

const ceilDivide = (numerator: bigint, denominator: bigint) => Number((numerator + denominator - BigInt(1)) / denominator);

/** Cost ceilings come only from the server's reviewed model policy. Free/demo
 * traffic remains covered by the independent daily platform fuse, not this sale.
 * Fail closed if the model list is missing or its paid entries are malformed. */
export function creditSaleEconomics(credits: number, models: readonly { credits: number; reserveMicroUsd: number }[]) {
  const quote = quoteCreditPurchase(credits);
  const paid = models.filter(model => model.credits > 0);
  if (!paid.length || models.some(model => !Number.isSafeInteger(model.credits) || model.credits < 0 ||
      !Number.isSafeInteger(model.reserveMicroUsd) || model.reserveMicroUsd < 0)) throw new Error('CREDIT_COST_POLICY_UNAVAILABLE');
  const maxMicroUsdPerCredit = Math.max(...paid.map(model => Math.ceil(model.reserveMicroUsd / model.credits)));
  if (maxMicroUsdPerCredit < 1) throw new Error('CREDIT_COST_POLICY_UNAVAILABLE');
  const safety = CREDIT_SALE_SAFETY;
  const providerAllowanceOre = ceilDivide(BigInt(credits) * BigInt(maxMicroUsdPerCredit) * BigInt(safety.providerNokOrePerUsd) * BigInt(10_000 + safety.failedUsageAllowanceBps), BigInt(1_000_000) * BigInt(10_000));
  const paymentAllowanceOre = Math.ceil(quote.amountOre * safety.paymentFeeBps / 10_000) + safety.paymentFixedOre;
  const taxAllowanceOre = Math.ceil(quote.amountOre * safety.taxReserveBps / 10_000);
  const contributionOre = quote.amountOre - providerAllowanceOre - paymentAllowanceOre - taxAllowanceOre;
  const minimumContributionOre = Math.ceil(quote.amountOre * safety.minimumContributionBps / 10_000);
  return { ...quote, maxMicroUsdPerCredit, providerAllowanceOre, paymentAllowanceOre, taxAllowanceOre,
    contributionOre, minimumContributionOre, eligible: contributionOre >= minimumContributionOre };
}
