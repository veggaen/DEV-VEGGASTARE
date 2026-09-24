/** @fileOverview Consent cannot be forged by a price, timestamp, stale version or a previous download. @stability stable */
import { describe, expect, it } from 'vitest';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { quoteShowcaseCart } from './showcase-policy';
import { CHECKOUT_AGREEMENT_VERSION, DELIVERY_REQUESTS, purchaseConfirmation, recordCheckoutAgreement, storedCheckoutAgreement } from './checkout-agreement';

const files = quoteShowcaseCart([{ productId: SHOWCASE_PRODUCTS.interviewPack.id, quantity: 1 }]);
const credits = quoteShowcaseCart([{ productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1, creditAmount: 122 }]);
const mixed = quoteShowcaseCart([...files.lines, ...credits.lines].map(line => ({ productId: line.productId, quantity: 1 })));
const now = new Date('2026-09-24T10:00:00.000Z');
const consent = { version: CHECKOUT_AGREEMENT_VERSION, files: true, credits: false };
describe('server-owned delivery consent', () => {
  it('stores exact visible wording and a server timestamp', () => {
    expect(recordCheckoutAgreement(files, consent, false, now)).toMatchObject({ version: CHECKOUT_AGREEMENT_VERSION,
      recordedAt: now.toISOString(), demo: false, requests: [DELIVERY_REQUESTS.files] });
  });
  it.each([undefined, {}, { ...consent, files: false }, { ...consent, version: 'stale' },
    { ...consent, recordedAt: 'yesterday' }, { ...consent, purchaseTerms: 'No refunds ever' }, { ...consent, files: 'true' }])('rejects missing, unselected or forged requests', input => {
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
    const old = { ...attempt, quote: { ...files, agreement: { ...agreement, purchaseTerms: 'Original retained policy', version: 'old-version' } } };
    expect(purchaseConfirmation(old)).toContain('Original retained policy');
    expect(purchaseConfirmation(old)).not.toContain(CHECKOUT_AGREEMENT_VERSION);
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
