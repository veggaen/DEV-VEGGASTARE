/** @fileOverview Versioned exact-spend quote policy. Not yet connected to production checkout. @stability experimental */
import { z } from 'zod';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { CREDIT_SALE_SAFETY, DAILY_PURCHASE_CAP_ORE, MAX_PURCHASE_CREDITS, MIN_PURCHASE_CREDITS, creditSaleEconomics, isPurchasableCreditAmount, quoteCreditPurchase } from '@/lib/ai-credit-purchase';
import { DecimalRate, MinorUnits, SettlementCurrency, SettlementError, addBasisPoints, minorToNok, nokToMinor, parseSpendMinor } from './settlement-money';

export const SETTLEMENT_VERSION = '2026-09-exact-v1';
export const SETTLEMENT_REVIEW_BY = '2026-10-24T00:00:00.000Z';
export const QUOTE_TTL_MS = 10 * 60_000;
export const FX_MAX_AGE_MS = 15 * 60_000;
export const FX_MAX_PUBLICATION_AGE_MS = 7 * 86_400_000;
// A merchant price allowance, not a separate payment-method surcharge. The
// reference FX stays unmodified. The displayed final quote must include this.
export const FOREIGN_CURRENCY_PRICE_ALLOWANCE_BPS = 500;
export const FOREIGN_CURRENCY_COST_ALLOWANCE_BPS = 400;
// PayPal Norway standard fixed fees in the RECEIVED currency, reviewed 2026-09-25.
// Percentage allowance remains 6%; actual agreements, tax and fees may differ.
const FIXED_PAYMENT_MINOR: Record<SettlementCurrency, number> = { NOK: 280, USD: 30, EUR: 35, GBP: 20, SEK: 325, DKK: 260 };

function foreignFixedAllowance(currency: SettlementCurrency, rate: string) {
  if (currency === 'NOK') return 0;
  const extra = Math.max(0, minorToNok(FIXED_PAYMENT_MINOR[currency], rate, 'up') - CREDIT_SALE_SAFETY.paymentFixedOre);
  // Gross up only the difference from the fixed fee already covered by the NOK
  // catalog. Small foreign-currency packs otherwise miss the margin floor.
  const retainedBps = 10_000 - CREDIT_SALE_SAFETY.paymentFeeBps - CREDIT_SALE_SAFETY.taxReserveBps -
    FOREIGN_CURRENCY_COST_ALLOWANCE_BPS - CREDIT_SALE_SAFETY.minimumContributionBps;
  return Math.ceil(extra * 10_000 / retainedBps);
}

export function settlementCreditPrice(credits: number, currency: SettlementCurrency, rate: string) {
  const base = quoteCreditPurchase(credits).amountOre;
  return nokToMinor(addBasisPoints(base, currency === 'NOK' ? 0 : FOREIGN_CURRENCY_PRICE_ALLOWANCE_BPS) + foreignFixedAllowance(currency, rate), rate);
}

const CreditSelection = z.discriminatedUnion('type', [
  z.object({ type: z.literal('credits'), credits: z.number().refine(isPurchasableCreditAmount) }).strict(),
  z.object({ type: z.literal('spend'), amount: z.string().max(32) }).strict(),
]);
export const SettlementSelection = z.object({
  currency: SettlementCurrency,
  items: z.array(z.object({ productId: z.string().min(1).max(128), quantity: z.literal(1), credits: CreditSelection.optional() }).strict()).min(1).max(2),
}).strict();
export type SettlementSelection = z.infer<typeof SettlementSelection>;

export const SettlementFx = z.object({
  source: z.literal('ECB_VIA_FRANKFURTER'), base: z.literal('NOK'), currency: SettlementCurrency,
  rate: DecimalRate, publishedOn: z.string().date(), fetchedAt: z.string().datetime(),
}).strict();
export type SettlementFx = z.infer<typeof SettlementFx>;

export function validateSettlementFx(input: unknown, currency: SettlementCurrency, now: number): SettlementFx {
  const parsed = SettlementFx.safeParse(input);
  if (!Number.isSafeInteger(now) || !parsed.success || parsed.data.currency !== currency || currency === 'NOK') throw new SettlementError('SETTLEMENT_FX_UNAVAILABLE');
  const fx = parsed.data, fetched = Date.parse(fx.fetchedAt), published = Date.parse(fx.publishedOn);
  const today = Math.floor(now / 86_400_000) * 86_400_000;
  // Published dates represent business days. A fresh network response carrying
  // last month's rates is NOT a fresh settlement quote. Future dates fail closed.
  if (fetched > now || now - fetched >= FX_MAX_AGE_MS || published > today ||
      now - published > FX_MAX_PUBLICATION_AGE_MS) throw new SettlementError('SETTLEMENT_FX_UNAVAILABLE');
  return fx;
}

const Line = z.object({
  productId: z.string().min(1).max(128), title: z.string().min(1).max(200), quantity: z.literal(1),
  kind: z.enum(['AI_CREDITS', 'DIGITAL_FILES']), credits: z.number().int().min(0).max(MAX_PURCHASE_CREDITS),
  selection: z.enum(['credits', 'spend', 'file']), amountMinor: MinorUnits,
  catalogNokOre: MinorUnits, priceVersion: z.string().min(1).max(60),
}).strict();
const Quote = z.object({
  version: z.literal(SETTLEMENT_VERSION), currency: SettlementCurrency,
  totalMinor: MinorUnits, exposureNokOre: MinorUnits,
  issuedAt: z.string().datetime(), expiresAt: z.string().datetime(),
  fx: SettlementFx.nullable(), currencyPriceAllowanceBps: z.number().int().min(0).max(500), currencyFixedAllowanceNokOre: MinorUnits,
  lines: z.array(Line).min(1).max(2),
}).strict();
export type SettlementQuote = z.infer<typeof Quote>;
type ModelCost = { credits: number; reserveMicroUsd: number };

/** Structural validation of an immutable SERVER-STORED quote. This does not
 * authenticate browser JSON or authorize a grant. Deliberately no fresh FX or
 * expiry check here: a historical capture/refund must retain its original money. */
export function readStoredSettlementQuote(input: unknown): SettlementQuote {
  const parsed = Quote.safeParse(input);
  if (!parsed.success) throw new SettlementError('INVALID_STORED_QUOTE');
  const quote = parsed.data, seen = new Set<string>();
  const issued = Date.parse(quote.issuedAt), expires = Date.parse(quote.expiresAt);
  if (expires <= issued || expires - issued > QUOTE_TTL_MS ||
      quote.totalMinor !== quote.lines.reduce((sum, line) => sum + line.amountMinor, 0) ||
      quote.exposureNokOre <= 0 || quote.exposureNokOre > DAILY_PURCHASE_CAP_ORE ||
      (quote.currency === 'NOK' ? quote.fx !== null || quote.currencyPriceAllowanceBps !== 0 || quote.currencyFixedAllowanceNokOre !== 0 :
        !quote.fx || quote.fx.currency !== quote.currency || quote.currencyPriceAllowanceBps !== FOREIGN_CURRENCY_PRICE_ALLOWANCE_BPS)) throw new SettlementError('INVALID_STORED_QUOTE');
  const rate = quote.fx?.rate ?? '1';
  if (quote.fx) {
    try { validateSettlementFx(quote.fx, quote.currency, issued); }
    catch { throw new SettlementError('INVALID_STORED_QUOTE'); }
  }
  if (quote.exposureNokOre !== minorToNok(quote.totalMinor, rate, 'up')) throw new SettlementError('INVALID_STORED_QUOTE');
  for (const line of quote.lines) {
    const sku = Object.values(SHOWCASE_PRODUCTS).find(item => item.id === line.productId);
    if (!sku || seen.has(line.productId) || line.kind !== sku.kind || line.amountMinor <= 0 || line.catalogNokOre <= 0 ||
        (line.kind === 'AI_CREDITS' ? !isPurchasableCreditAmount(line.credits) || line.selection === 'file' : line.credits !== 0 || line.selection !== 'file')) throw new SettlementError('INVALID_STORED_QUOTE');
    seen.add(line.productId);
  }
  return quote;
}

export function assertSettlementQuoteCurrent(quote: SettlementQuote, now = Date.now()) {
  const stored = readStoredSettlementQuote(quote);
  if (!Number.isSafeInteger(now) || now < Date.parse(stored.issuedAt) || now >= Date.parse(stored.expiresAt)) throw new SettlementError('SETTLEMENT_QUOTE_EXPIRED');
  return stored;
}

/** Conservative contribution check, NOT actual net profit. The whole fixed
 * transaction fee is assigned to the credits even for a mixed cart. No subsidy
 * from the file line can make an unsafe credit sale pass. */
export function settlementCreditEconomics(credits: number, amountMinor: number, currency: SettlementCurrency, rate: string, models: readonly ModelCost[]) {
  const base = creditSaleEconomics(credits, models);
  const grossNokOre = minorToNok(amountMinor, rate, 'down');
  const feeFixedNokOre = minorToNok(FIXED_PAYMENT_MINOR[currency], rate, 'up');
  const paymentAllowanceNokOre = Math.ceil(grossNokOre * CREDIT_SALE_SAFETY.paymentFeeBps / 10_000) + feeFixedNokOre;
  const taxAllowanceNokOre = Math.ceil(grossNokOre * CREDIT_SALE_SAFETY.taxReserveBps / 10_000);
  const fxAllowanceNokOre = currency === 'NOK' ? 0 : Math.ceil(grossNokOre * FOREIGN_CURRENCY_COST_ALLOWANCE_BPS / 10_000);
  const contributionNokOre = grossNokOre - base.providerAllowanceOre - paymentAllowanceNokOre - taxAllowanceNokOre - fxAllowanceNokOre;
  const minimumContributionNokOre = Math.ceil(grossNokOre * CREDIT_SALE_SAFETY.minimumContributionBps / 10_000);
  return { grossNokOre, providerAllowanceNokOre: base.providerAllowanceOre, paymentAllowanceNokOre,
    taxAllowanceNokOre, fxAllowanceNokOre, contributionNokOre, minimumContributionNokOre,
    eligible: contributionNokOre >= minimumContributionNokOre };
}

/** Only trusted server configuration may supply FX, time and model-cost policy.
 * A request supplies a SKU and either credits or desired spend, never a rate,
 * price, credit grant, cost ceiling or tax/fee override. */
export function quoteSettlementCart(input: unknown, context: {
  now: number; fx?: SettlementFx | null; models: readonly ModelCost[]; modelCostReviewBy: string;
}): SettlementQuote {
  const parsed = SettlementSelection.safeParse(input);
  if (!parsed.success) throw new SettlementError('INVALID_SETTLEMENT_SELECTION');
  const { currency, items } = parsed.data, { now } = context;
  const policyExpiry = Math.min(Date.parse(SETTLEMENT_REVIEW_BY), Date.parse(context.modelCostReviewBy));
  if (!Number.isSafeInteger(now) || !Number.isFinite(policyExpiry) || now >= policyExpiry) throw new SettlementError('SETTLEMENT_PRICING_REVIEW_REQUIRED');
  const fx = currency === 'NOK' ? null : validateSettlementFx(context.fx, currency, now);
  const rate = fx?.rate ?? '1', allowanceBps = currency === 'NOK' ? 0 : FOREIGN_CURRENCY_PRICE_ALLOWANCE_BPS;
  const price = (ore: number) => nokToMinor(addBasisPoints(ore, allowanceBps), rate);
  const seen = new Set<string>();
  const lines = items.map((item): SettlementQuote['lines'][number] => {
    const sku = Object.values(SHOWCASE_PRODUCTS).find(product => product.id === item.productId);
    if (!sku || seen.has(item.productId)) throw new SettlementError('UNSUPPORTED_CART_ITEM');
    seen.add(item.productId);
    if (sku.kind === 'DIGITAL_FILES') {
      if (item.credits) throw new SettlementError('UNSUPPORTED_CREDIT_SELECTION');
      return { productId: sku.id, title: sku.title, quantity: 1, kind: sku.kind, credits: 0, selection: 'file',
        amountMinor: price(sku.amountOre), catalogNokOre: sku.amountOre, priceVersion: SETTLEMENT_VERSION };
    }
    if (!item.credits) throw new SettlementError('CREDIT_SELECTION_REQUIRED');
    let credits: number, amountMinor: number;
    if (item.credits.type === 'credits') {
      credits = item.credits.credits;
      amountMinor = settlementCreditPrice(credits, currency, rate);
    } else {
      amountMinor = parseSpendMinor(item.credits.amount);
      // Exact-spend mode never silently charges 38 NOK for the 9 NOK starter,
      // nor keeps money above the maximum pack. The starter is a direct preset.
      if (amountMinor < settlementCreditPrice(MIN_PURCHASE_CREDITS, currency, rate)) throw new SettlementError('SPEND_BELOW_CUSTOM_MINIMUM');
      if (amountMinor > settlementCreditPrice(MAX_PURCHASE_CREDITS, currency, rate)) throw new SettlementError('SPEND_ABOVE_CUSTOM_MAXIMUM');
      let low = MIN_PURCHASE_CREDITS, high = MAX_PURCHASE_CREDITS;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (settlementCreditPrice(middle, currency, rate) <= amountMinor) low = middle; else high = middle - 1;
      }
      credits = low;
    }
    const creditPrice = quoteCreditPurchase(credits);
    if (!settlementCreditEconomics(credits, amountMinor, currency, rate, context.models).eligible) throw new SettlementError('CREDIT_SALES_PAUSED');
    return { productId: sku.id, title: `${sku.title} · ${credits} credits`, quantity: 1, kind: sku.kind,
      credits, selection: item.credits.type, amountMinor, catalogNokOre: creditPrice.amountOre, priceVersion: creditPrice.pricingVersion };
  }).sort((a, b) => a.productId.localeCompare(b.productId));
  const totalMinor = lines.reduce((sum, line) => sum + line.amountMinor, 0);
  const exposureNokOre = minorToNok(totalMinor, rate, 'up');
  if (exposureNokOre > DAILY_PURCHASE_CAP_ORE) throw new SettlementError('PURCHASE_AMOUNT_LIMIT');
  // UTC midnight remains a hard boundary for the existing per-day exposure cap.
  const expires = Math.min(now + QUOTE_TTL_MS, policyExpiry, (Math.floor(now / 86_400_000) + 1) * 86_400_000,
    fx ? Date.parse(fx.fetchedAt) + FX_MAX_AGE_MS : Infinity);
  return readStoredSettlementQuote({ version: SETTLEMENT_VERSION, currency, totalMinor, exposureNokOre,
    issuedAt: new Date(now).toISOString(), expiresAt: new Date(expires).toISOString(), fx,
    currencyPriceAllowanceBps: allowanceBps, currencyFixedAllowanceNokOre: foreignFixedAllowance(currency, rate), lines });
}
