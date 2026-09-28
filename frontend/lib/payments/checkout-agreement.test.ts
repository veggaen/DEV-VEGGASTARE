/** @fileOverview Consent cannot be forged by a price, timestamp, stale version or a previous download. @stability stable */
import { describe, expect, it } from 'vitest';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { quoteShowcaseCart } from './showcase-policy';
import { CHECKOUT_AGREEMENT_VERSION, DELIVERY_REQUESTS, DIGITAL_PURCHASE_RECORD, purchaseConfirmation, recordCheckoutAgreement, storedCheckoutAgreement } from './checkout-agreement';
import { SALES_TERMS_TEXT } from '@/lib/legal/sales-terms';
import { SALES_TERMS_VERSION } from '@/lib/legal/sales-terms-version';
import { transactionMessage } from './email-policy';
import { quoteSettlementCart } from './settlement-quote';

const files = quoteShowcaseCart([{ productId: SHOWCASE_PRODUCTS.interviewPack.id, quantity: 1 }]);
const credits = quoteShowcaseCart([{ productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1, creditAmount: 122 }]);
const mixed = quoteShowcaseCart([...files.lines, ...credits.lines].map(line => ({ productId: line.productId, quantity: 1 })));
const now = new Date('2026-09-24T10:00:00.000Z');
const consent = { version: CHECKOUT_AGREEMENT_VERSION, files: true, credits: false };
describe('server-owned delivery consent', () => {
  it('describes the permanent products and the supported media allowance without interview copy', () => {
    expect(DIGITAL_PURCHASE_RECORD).toContain(SHOWCASE_PRODUCTS.interviewPack.title);
    expect(DIGITAL_PURCHASE_RECORD).toContain(SHOWCASE_PRODUCTS.credits.title);
    expect(DIGITAL_PURCHASE_RECORD).toContain('image generations and short-video generations');
    expect(DIGITAL_PURCHASE_RECORD).not.toMatch(/reviewer listings|test\/showcase products|interview guide/i);
  });
  it.each(['2026-09-24.2', '2026-09-25.1'])('rejects previous version %s for a new agreement', version => {
    expect(() => recordCheckoutAgreement(files, { ...consent, version }, false)).toThrow('DELIVERY_CONSENT_REQUIRED');
  });
  it('describes the confirmed payment currency without promising NOK-only settlement', () => {
    expect(DIGITAL_PURCHASE_RECORD).toContain('amount and fiat currency confirmed at checkout');
    expect(DIGITAL_PURCHASE_RECORD).not.toContain('PayPal payments are charged in NOK');
  });
  it('stores exact visible wording and a server timestamp', () => {
    expect(recordCheckoutAgreement(files, consent, false, now)).toMatchObject({ version: CHECKOUT_AGREEMENT_VERSION,
      recordedAt: now.toISOString(), demo: false, requests: [DELIVERY_REQUESTS.files] });
  });
  it.each([undefined, {}, { ...consent, files: false }, { ...consent, version: 'stale' },
    { ...consent, recordedAt: 'yesterday' }, { ...consent, purchaseTerms: 'No refunds ever' }, { ...consent, publishedTerms: { text: 'fake' } }, { ...consent, files: 'true' }])('rejects missing, unselected or forged requests', input => {
    expect(() => recordCheckoutAgreement(files, input, false)).toThrow('DELIVERY_CONSENT_REQUIRED');
  });
  it('binds each request to the server cart, not the client-selected product kinds', () => {
    expect(() => recordCheckoutAgreement(mixed, consent, false)).toThrow('DELIVERY_CONSENT_REQUIRED');
    expect(() => recordCheckoutAgreement(credits, { ...consent, credits: true }, false)).toThrow('DELIVERY_CONSENT_REQUIRED');
    expect(recordCheckoutAgreement(mixed, { ...consent, credits: true }, false).requests).toEqual([DELIVERY_REQUESTS.files, DELIVERY_REQUESTS.credits]);
  });
  it('never manufactures consent for a demo', () => {
    expect(recordCheckoutAgreement(files, undefined, true, now)).toMatchObject({ demo: true, requests: [] });
  });
  it('does not retroactively claim consent for historical orders', () => {
    expect(storedCheckoutAgreement(files)).toBeNull();
  });
  it.each([true, false])('retains the complete published source on new orders (demo=%s)', demo => {
    expect(recordCheckoutAgreement(files, consent, demo, now).publishedTerms).toEqual({ version: SALES_TERMS_VERSION, language: 'nb', text: SALES_TERMS_TEXT });
  });
});
describe('original purchase confirmation', () => {
  const agreement = recordCheckoutAgreement(files, consent, false, now);
  const attempt = { orderId: 'order1', userId: 'buyer1', quote: { ...files, agreement },
    totalOre: files.totalOre, environment: 'SANDBOX', captureId: 'CAPTURE1', completedAt: now };
  it('contains the retained terms, charge and consent, without private download credentials', () => {
    const text = purchaseConfirmation(attempt)!;
    expect(text).toContain('29.00 NOK'); expect(text).toContain('CAPTURE1'); expect(text).toContain(DELIVERY_REQUESTS.files);
    expect(text).toContain('937 051 107'); expect(text).toContain('My name and address');
    expect(text).not.toContain('/api/download'); expect(text).not.toContain('token=');
  });
  it('keeps the original record after refund without pretending it is a refund certificate', () => {
    const refunded = { ...attempt, state: 'REFUNDED', refundedOre: files.totalOre };
    expect(purchaseConfirmation(refunded)).toBe(purchaseConfirmation(attempt));
  });
  it('uses stored terms, never replacing them with newly published wording', () => {
    const old = { ...attempt, quote: { ...files, agreement: { ...agreement, publishedTerms: undefined, purchaseTerms: 'Original retained policy', version: 'old-version' } } };
    expect(purchaseConfirmation(old)).toContain('Original retained policy');
    expect(purchaseConfirmation(old)).not.toContain(CHECKOUT_AGREEMENT_VERSION);
    expect(purchaseConfirmation(old)).not.toContain(SALES_TERMS_TEXT);
  });
  it('retains a previous full terms version without substituting current terms', () => {
    const prior = { ...attempt, quote: { ...files, agreement: { ...agreement, publishedTerms: { version: 'previous', language: 'nb', text: 'Previous full published terms' } } } };
    expect(purchaseConfirmation(prior)).toContain('Previous full published terms');
    expect(purchaseConfirmation(prior)).not.toContain(SALES_TERMS_TEXT);
  });
  it('retains original NOK wording for an old purchase after the selected-currency release', () => {
    const purchaseTerms = 'PayPal payments are charged in NOK. Original policy — 2026-09-25.1';
    const old = { ...attempt, quote: { ...files, agreement: { ...agreement, version: '2026-09-25.1', purchaseTerms,
      publishedTerms: { version: '2026-09-25.1', language: 'nb', text: 'Original published terms' } } } };
    const original = purchaseConfirmation(old)!;
    expect(original).toContain(purchaseTerms);
    expect(original).toContain('Confirmed total: 29.00 NOK');
    expect(original).not.toContain(CHECKOUT_AGREEMENT_VERSION);
    expect(original).not.toContain(DIGITAL_PURCHASE_RECORD);
    expect(purchaseConfirmation({ ...old, refundedOre: old.totalOre })).toBe(original);
  });
  it('confirms exact USD cash and the same versioned policy in the download and email', () => {
    const quoteNow = Date.parse('2026-09-25T12:00:00Z');
    const quote = quoteSettlementCart({ currency: 'USD', items: [{ productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1, credits: { type: 'spend', amount: '100' } }] },
      { now: quoteNow, fx: { source: 'ECB_VIA_FRANKFURTER', base: 'NOK', currency: 'USD', rate: '0.105', publishedOn: '2026-09-25', fetchedAt: new Date(quoteNow).toISOString() },
        models: [{ credits: 1, reserveMicroUsd: 10000 }], modelCostReviewBy: '2026-10-24T00:00:00Z' });
    const saved = { ...attempt, currency: 'USD', totalMinor: 10000, totalOre: quote.exposureNokOre, refundedMinor: 0,
      settlementQuoteId: '584ba6e8-6580-43ac-a6f2-1b93bc80d0b4',
      quote: { settlement: quote, agreement: recordCheckoutAgreement(quote, { version: CHECKOUT_AGREEMENT_VERSION, files: false, credits: true }, false, new Date(quoteNow)) } };
    const text = purchaseConfirmation(saved)!;
    expect(text).toContain('Confirmed total: 100.00 USD');
    expect(text).toContain(DIGITAL_PURCHASE_RECORD);
    expect(text).toContain(SALES_TERMS_TEXT);
    expect(text).not.toContain('PayPal payments are charged in NOK');
    const message = transactionMessage('buyer@example.org', 'Your order confirmation', 'veggat-order-order1.txt', text);
    expect(Buffer.from(message.attachments[0].content, 'base64').toString('utf8')).toBe(text);
  });
  it('emails exactly the downloadable full packet within payload limits', () => {
    const original = purchaseConfirmation(attempt)!;
    const message = transactionMessage('buyer@example.org', 'Your order confirmation', 'veggat-order-order1.txt', original);
    expect(original).toContain(SALES_TERMS_TEXT);
    expect(Buffer.from(message.attachments[0].content, 'base64').toString('utf8')).toBe(original);
    expect(message.text).toContain(original);
    expect(message.attachments[0].content.length).toBeLessThan(80000);
  });
  it('requires verified fulfillment and never invents legacy or pending consent', () => {
    expect(purchaseConfirmation({ ...attempt, completedAt: null })).toBeNull();
    expect(purchaseConfirmation({ ...attempt, captureId: null })).toBeNull();
    expect(purchaseConfirmation({ ...attempt, quote: files })).toBeNull();
  });
  it('labels demo as unpaid and never claims paid acceptance', () => {
    const demo = { ...attempt, environment: 'DEMO', captureId: null,
      quote: { ...files, agreement: recordCheckoutAgreement(files, undefined, true, now) } };
    expect(purchaseConfirmation(demo)).toContain('Actually charged: 0.00 NOK');
    expect(purchaseConfirmation(demo)).toContain('no paid delivery consent was collected');
  });
});
