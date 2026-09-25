import { afterEach, describe, expect, it, vi } from 'vitest';
import { quoteSettlementCart } from './settlement-quote';
import { readCreditPreview, settlementMessage, settlementRequest } from './settlement-client';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { FUNDED_AI_MODELS } from '@/lib/ai-chat/credit-policy';
import { MEDIA_MODELS } from '@/lib/ai-media/policy';
const now = Date.parse('2026-09-25T12:00:00Z');
const intent = { type: 'spend' as const, currency: 'USD' as const, amount: '100' };
const quote = () => quoteSettlementCart({ currency: 'USD', items: [{ productId: SHOWCASE_PRODUCTS.credits.id,
  quantity: 1, credits: { type: 'spend', amount: '100' } }] }, { now, models: [...FUNDED_AI_MODELS, ...Object.values(MEDIA_MODELS)],
  modelCostReviewBy: '2026-10-24T00:00:00Z', fx: { source: 'ECB_VIA_FRANKFURTER', base: 'NOK', currency: 'USD',
    rate: '0.10519', publishedOn: '2026-09-25', fetchedAt: new Date(now).toISOString() } });
describe('browser quote binding', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('retains exact typed spend and validates the server pack', () => {
    const choice = readCreditPreview(quote(), intent, now);
    expect(choice.intent.type === 'spend' && choice.intent.amount).toBe('100'); expect(choice.quote.totalMinor).toBe(10000);
  });
  it('rejects expired, wrong currency, wrong amount, and wrong selection quotes', () => {
    expect(() => readCreditPreview(quote(), intent, now + 600000)).toThrow();
    expect(() => readCreditPreview(quote(), { ...intent, currency: 'EUR' }, now)).toThrow();
    expect(() => readCreditPreview(quote(), { ...intent, amount: '101' }, now)).toThrow();
    expect(() => readCreditPreview(quote(), { type: 'credits', currency: 'USD', credits: 100 }, now)).toThrow();
  });
  it('never forwards unrecognized error text to the buyer', () => {
    expect(settlementMessage('private database details')).not.toContain('private database');
    expect(settlementMessage('CART_CHANGED')).toContain('another tab');
  });
  it('redacts malformed JSON and network errors while retaining approved recovery messages', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    fetch.mockRejectedValueOnce(new Error('private network diagnostic'));
    await expect(settlementRequest('/api/checkout/quote', {})).rejects.toThrow('Could not confirm this price');
    fetch.mockResolvedValueOnce(new Response('<private debug>', { status: 502 }));
    await expect(settlementRequest('/api/checkout/quote', {})).rejects.toThrow('Could not confirm this price');
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'CART_CHANGED' }), { status: 409 }));
    await expect(settlementRequest('/api/checkout/quote', {})).rejects.toThrow('another tab');
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 }));
    await expect(settlementRequest('/api/checkout/quote', {})).rejects.toThrow('Wait a few minutes');
  });
});
