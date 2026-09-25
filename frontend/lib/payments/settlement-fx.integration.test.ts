/** @fileOverview Opt-in public ECB rate read; no PayPal, database, secret or customer request. */
import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { readSettlementFx } from './settlement-fx';
import { quoteSettlementCart } from './settlement-quote';
import { SettlementCurrency, formatMinor } from './settlement-money';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { FUNDED_AI_MODELS, AI_PRICING_REVIEW_BY } from '@/lib/ai-chat/credit-policy';
import { MEDIA_MODELS } from '@/lib/ai-media/policy';

it.skipIf(process.env.TEST_SETTLEMENT_FX_READ !== '1')('uses actual fresh public FX to quote exact spend in all six currencies', async () => {
  const quotes = [];
  for (const currency of SettlementCurrency.options) {
    const fx = await readSettlementFx(currency);
    const quote = quoteSettlementCart({ currency, items: [{ productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1,
      credits: { type: 'spend', amount: '100' } }] },
    { now: Date.now(), fx, models: [...FUNDED_AI_MODELS, ...Object.values(MEDIA_MODELS)], modelCostReviewBy: AI_PRICING_REVIEW_BY });
    expect(quote.totalMinor).toBe(10000);
    expect(quote.currency).toBe(currency);
    expect(quote.lines[0].credits).toBeGreaterThanOrEqual(100);
    expect(quote.lines[0].credits).toBeLessThanOrEqual(10000);
    quotes.push({ currency, amount: formatMinor(quote.totalMinor), credits: quote.lines[0].credits, rateDate: fx?.publishedOn ?? null });
  }
  console.info('Read-only settlement quote evidence:', JSON.stringify(quotes));
}, 15_000);
