/** @fileOverview Exact selected-currency money, whole-credit bounds and conservative margins. No provider requests. */
import { describe, expect, it } from 'vitest';
import { SHOWCASE_PRODUCTS as products } from '@/lib/showcase-catalog';
import { FUNDED_AI_MODELS, AI_PRICING_REVIEW_BY } from '@/lib/ai-chat/credit-policy';
import { MEDIA_MODELS } from '@/lib/ai-media/policy';
import { formatMinor, minorToNok, nokToMinor, parseProviderMinor, parseSpendMinor, type SettlementCurrency } from './settlement-money';
import { FX_MAX_AGE_MS, QUOTE_TTL_MS, assertSettlementQuoteCurrent, quoteSettlementCart, readStoredSettlementQuote, settlementCreditEconomics, settlementCreditPrice,
  type SettlementFx, type SettlementSelection } from './settlement-quote';

const now = Date.parse('2026-09-25T12:00:00Z');
// Fixed fixtures, not a live exchange-rate assumption.
const rates = { NOK: '1', USD: '0.10519', EUR: '0.09225', GBP: '0.07938', SEK: '1.0415', DKK: '0.68962' } as const;
const currencies = Object.keys(rates) as SettlementCurrency[];
const models = [...FUNDED_AI_MODELS, ...Object.values(MEDIA_MODELS)];
function fx(currency: SettlementCurrency, changes: Partial<SettlementFx> = {}): SettlementFx {
  return { source: 'ECB_VIA_FRANKFURTER', base: 'NOK', currency, rate: rates[currency], publishedOn: '2026-09-25', fetchedAt: new Date(now).toISOString(), ...changes };
}
function input(currency: SettlementCurrency = 'USD', selection: { type: 'credits'; credits: number } | { type: 'spend'; amount: string } = { type: 'spend', amount: '100' }): SettlementSelection {
  return { currency, items: [{ productId: products.credits.id, quantity: 1, credits: selection }] };
}
function context(currency: SettlementCurrency = 'USD') { return { now, fx: fx(currency), models, modelCostReviewBy: AI_PRICING_REVIEW_BY }; }

describe('integer settlement money', () => {
  it.each([['100', 10000], ['100.00', 10000], [' 100,01 ', 10001], ['0.01', 1], ['0.1', 10], ['999999.99', 99999999]])('parses %s without floating-point rounding', (text, expected) => {
    expect(parseSpendMinor(text)).toBe(expected);
    expect(parseProviderMinor(formatMinor(expected))).toBe(expected);
  });
  it.each(['', ' ', '0', '0.00', '-1', '+1', '01', '1e2', '0x10', 'NaN', 'Infinity', '1,000', '1 000', '100.', '1.001', '1.2.3', '1,20.00', '1000000.01', '9'.repeat(100), 100, null])('rejects an invalid spend %j', value => {
    expect(() => parseSpendMinor(value)).toThrow('INVALID_SPEND_AMOUNT');
  });
  it.each(['1', '1.0', '01.00', '1,00', ' 1.00', '+1.00', '1e2', '1.001', '1000000.01', null])('does not repair provider money %j', value => {
    expect(() => parseProviderMinor(value)).toThrow('INVALID_PROVIDER_AMOUNT');
  });
  it('handles repeating fractions conservatively using integer rational arithmetic', () => {
    expect(nokToMinor(39, '0.10519', 'up')).toBe(5);
    expect(nokToMinor(39, '0.10519', 'down')).toBe(4);
    expect(minorToNok(10000, '0.10519', 'down')).toBe(95066);
    expect(minorToNok(10000, '0.10519', 'up')).toBe(95067);
    expect(minorToNok(1, '0.1', 'up')).toBe(10);
  });
  it.each(['0', '-1', 'Infinity', '1e-1', '0.0001', '101', '0.1234567891234', 'bad'])('rejects invalid/unreviewed FX %s', rate => {
    expect(() => nokToMinor(100, rate)).toThrow();
    expect(() => minorToNok(100, rate, 'up')).toThrow();
  });
});

describe('exact-spend settlement quotes', () => {
  it.each(currencies)('keeps the requested %s amount exact and grants the largest safe whole-credit pack', currency => {
    // 100 units is in range for all six fixture currencies.
    const quote = quoteSettlementCart(input(currency), context(currency));
    expect(quote).toMatchObject({ currency, totalMinor: 10000 });
    const line = quote.lines[0];
    expect(line).toMatchObject({ amountMinor: 10000, selection: 'spend', kind: 'AI_CREDITS', quantity: 1 });
    const equalCredits = quoteSettlementCart(input(currency, { type: 'credits', credits: line.credits }), context(currency));
    expect(equalCredits.totalMinor).toBeLessThanOrEqual(10000);
    const nextCredits = quoteSettlementCart(input(currency, { type: 'credits', credits: line.credits + 1 }), context(currency));
    expect(nextCredits.totalMinor).toBeGreaterThan(10000);
    expect(quote.exposureNokOre).toBe(minorToNok(10000, rates[currency], 'up'));
    expect(formatMinor(quote.totalMinor)).toBe('100.00');
  });
  it('quotes an exact 1,000 NOK purchase without changing the 9 NOK starter', () => {
    const quote = quoteSettlementCart(input('NOK', { type: 'spend', amount: '1000' }), context('NOK'));
    expect(quote).toMatchObject({ totalMinor: 100000, exposureNokOre: 100000, currency: 'NOK', fx: null,
      currencyPriceAllowanceBps: 0, lines: [expect.objectContaining({ credits: 2815, amountMinor: 100000, catalogNokOre: 99977 })] });
    expect(quoteSettlementCart(input('NOK', { type: 'credits', credits: 10 }), context('NOK')).totalMinor).toBe(900);
  });
  it.each(currencies)('keeps mixed %s line items separate and adds them exactly', currency => {
    const selection = input(currency);
    selection.items.push({ productId: products.interviewPack.id, quantity: 1 });
    const quote = quoteSettlementCart(selection, context(currency));
    expect(quote.lines).toHaveLength(2);
    const credits = quote.lines.find(line => line.kind === 'AI_CREDITS')!;
    const file = quote.lines.find(line => line.kind === 'DIGITAL_FILES')!;
    expect(credits.amountMinor).toBe(10000);
    expect(file).toMatchObject({ credits: 0, selection: 'file', catalogNokOre: 2900 });
    expect(quote.totalMinor).toBe(credits.amountMinor + file.amountMinor);
    expect(quoteSettlementCart({ ...selection, items: [...selection.items].reverse() }, context(currency))).toEqual(quote);
  });
  it.each(currencies)('covers every whole-credit amount with sufficient modeled margin in %s', currency => {
    for (const credits of [10, ...Array.from({ length: 9901 }, (_, i) => i + 100)]) {
      const amountMinor = settlementCreditPrice(credits, currency, rates[currency]);
      const economics = settlementCreditEconomics(credits, amountMinor, currency, rates[currency], models);
      if (!economics.eligible) throw new Error(`${currency} ${credits} misses margin: ${JSON.stringify(economics)}`);
      expect(economics.contributionNokOre).toBeGreaterThanOrEqual(economics.minimumContributionNokOre);
    }
  });
  it.each(currencies)('accepts the precise min/max prices but rejects an extra cent in %s', currency => {
    for (const credits of [100, 10000]) {
      const direct = quoteSettlementCart(input(currency, { type: 'credits', credits }), context(currency));
      const exact = quoteSettlementCart(input(currency, { type: 'spend', amount: formatMinor(direct.totalMinor) }), context(currency));
      expect(exact.lines[0].credits).toBe(credits);
      const outside = direct.totalMinor + (credits === 100 ? -1 : 1);
      expect(() => quoteSettlementCart(input(currency, { type: 'spend', amount: formatMinor(outside) }), context(currency)))
        .toThrow(credits === 100 ? 'SPEND_BELOW_CUSTOM_MINIMUM' : 'SPEND_ABOVE_CUSTOM_MAXIMUM');
    }
  });
  it('does not sell the 9 NOK starter for an arbitrary amount below the custom minimum', () => {
    for (const amount of ['9', '20', '38.99']) expect(() => quoteSettlementCart(input('NOK', { type: 'spend', amount }), context('NOK'))).toThrow('SPEND_BELOW_CUSTOM_MINIMUM');
  });
  it.each([{}, { totalMinor: 1 }, { fx: { rate: '100' } }, { currency: 'ETH' }, { currency: 'JPY' }, { currency: 'usd' }])('rejects unsupported request fields/currencies %j', override => {
    const candidate = Object.keys(override).length ? { ...input(), ...override } : {};
    expect(() => quoteSettlementCart(candidate, context())).toThrow('INVALID_SETTLEMENT_SELECTION');
  });
  it('rejects client prices, grants, quantity, duplicate and unrelated products', () => {
    const creditItem = input().items[0];
    for (const item of [{ ...creditItem, amountMinor: 1 }, { ...creditItem, grantedCredits: 999999 }, { ...creditItem, quantity: 2 },
      { ...creditItem, credits: { type: 'credits', credits: 122.5 } }]) {
      expect(() => quoteSettlementCart({ currency: 'USD', items: [item] }, context())).toThrow('INVALID_SETTLEMENT_SELECTION');
    }
    expect(() => quoteSettlementCart({ currency: 'USD', items: [creditItem, creditItem] }, context())).toThrow('UNSUPPORTED_CART_ITEM');
    expect(() => quoteSettlementCart({ currency: 'USD', items: [{ ...creditItem, productId: 'another-product' }] }, context())).toThrow('UNSUPPORTED_CART_ITEM');
    expect(() => quoteSettlementCart({ currency: 'USD', items: [{ ...creditItem, productId: products.interviewPack.id }] }, context())).toThrow('UNSUPPORTED_CREDIT_SELECTION');
  });
  it('fails closed on unavailable/expired cost policy or a loss-making model allowance', () => {
    expect(() => quoteSettlementCart(input(), { ...context(), models: [] })).toThrow('CREDIT_COST_POLICY_UNAVAILABLE');
    expect(() => quoteSettlementCart(input(), { ...context(), models: [{ credits: 1, reserveMicroUsd: 100000 }] })).toThrow('CREDIT_SALES_PAUSED');
    expect(() => quoteSettlementCart(input(), { ...context(), modelCostReviewBy: new Date(now).toISOString() })).toThrow('SETTLEMENT_PRICING_REVIEW_REQUIRED');
    expect(() => quoteSettlementCart(input(), { ...context(), modelCostReviewBy: 'invalid' })).toThrow('SETTLEMENT_PRICING_REVIEW_REQUIRED');
    expect(() => quoteSettlementCart(input(), { ...context(), now: NaN })).toThrow('SETTLEMENT_PRICING_REVIEW_REQUIRED');
  });
  it('rejects missing, stale, wrong-currency, future or old-publication FX', () => {
    for (const invalidFx of [null, fx('EUR'), fx('USD', { fetchedAt: new Date(now - FX_MAX_AGE_MS).toISOString() }),
      fx('USD', { fetchedAt: new Date(now + 1).toISOString() }), fx('USD', { publishedOn: '2026-09-26' }),
      fx('USD', { publishedOn: '2026-09-17' }), fx('USD', { rate: '0' })]) {
      expect(() => quoteSettlementCart(input(), { ...context(), fx: invalidFx })).toThrow('SETTLEMENT_FX_UNAVAILABLE');
    }
    expect(quoteSettlementCart(input('NOK'), { ...context('NOK'), fx: null }).totalMinor).toBe(10000);
  });
  it('allows weekend reference rates but limits new quotes to their own lifetime', () => {
    const monday = Date.parse('2026-09-28T09:00:00Z');
    const quote = quoteSettlementCart(input(), { ...context(), now: monday, fx: fx('USD', { fetchedAt: new Date(monday).toISOString() }) });
    expect(Date.parse(quote.expiresAt) - monday).toBe(QUOTE_TTL_MS);
    expect(assertSettlementQuoteCurrent(quote, monday + QUOTE_TTL_MS - 1)).toEqual(quote);
    expect(() => assertSettlementQuoteCurrent(quote, monday + QUOTE_TTL_MS)).toThrow('SETTLEMENT_QUOTE_EXPIRED');
    expect(() => assertSettlementQuoteCurrent(quote, monday - 1)).toThrow('SETTLEMENT_QUOTE_EXPIRED');
    expect(readStoredSettlementQuote(quote)).toEqual(quote); // Historical proof does not need fresh FX.
  });
  it('expires at UTC midnight, FX expiry or policy review, whichever comes first', () => {
    const late = Date.parse('2026-09-25T23:59:00Z');
    expect(quoteSettlementCart(input('NOK'), { ...context('NOK'), now: late }).expiresAt).toBe('2026-09-26T00:00:00.000Z');
    const old = fx('USD', { fetchedAt: new Date(now - FX_MAX_AGE_MS + 5000).toISOString() });
    expect(Date.parse(quoteSettlementCart(input(), { ...context(), fx: old }).expiresAt)).toBe(now + 5000);
    expect(Date.parse(quoteSettlementCart(input(), { ...context(), modelCostReviewBy: new Date(now + 1000).toISOString() }).expiresAt)).toBe(now + 1000);
  });
  it('rejects corrupted stored money, line sums, exposures and currency references', () => {
    const quote = quoteSettlementCart(input(), context());
    const variants = [{ ...quote, totalMinor: 9999 }, { ...quote, exposureNokOre: 1 }, { ...quote, totalMinor: -1 },
      { ...quote, fx: null }, { ...quote, currency: 'NOK' }, { ...quote, currencyPriceAllowanceBps: 0 },
      { ...quote, lines: [{ ...quote.lines[0], credits: 10.5 }] }, { ...quote, expiresAt: quote.issuedAt },
      { ...quote, expiresAt: new Date(now + QUOTE_TTL_MS + 1).toISOString() }];
    for (const variant of variants) expect(() => readStoredSettlementQuote(variant)).toThrow('INVALID_STORED_QUOTE');
  });
});
