/** @fileOverview Adjusted payments never advertise paid delivery or hide credit offsets. @stability stable */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), receipt: vi.fn(), account: vi.fn(), cart: vi.fn(), cartQuote: vi.fn() }));
vi.mock('@/hooks/use-cart-settlement', () => ({ useCartSettlement: m.cartQuote }));
vi.mock('@/auth', () => ({ auth: m.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { transactionalEmail: { findMany: vi.fn().mockResolvedValue([]) }, checkoutAttempt: { findUnique: m.receipt }, aiCreditAccount: { findUnique: m.account }, cart: { findUnique: m.cart } } }));
vi.mock('@/lib/payments/showcase-paypal', () => ({ paypalConfigured: () => true }));
vi.mock('@/components/checkout/reviewer-checkout-button', () => ({
  // Preserve the server-provided slots: financial disclosures now live inside
  // the checkout layout, before its payment action.
  default: ({ order, summary }: { order: React.ReactNode; summary: React.ReactNode }) =>
    React.createElement(React.Fragment, null, order, summary, React.createElement('button', null, 'Continue to PayPal')),
}));
// These server-page tests provide the client shell dependencies that Next wraps
// around the page in production. Keep the real money formatter and edit provider.
vi.mock('@/components/providers/ui-preferences', () => ({ useUiPreferences: () => ({ prefs: { preferredFiatCurrency: 'USD', preferredCryptoCurrency: 'ETH' } }) }));
vi.mock('@/hooks/useCurrencyRates', () => ({ useCurrencyRates: () => ({ fiatRates: { USD: 1, NOK: 0.1 }, cryptoPrices: { ETH: 2000 }, isLoading: false, lastUpdated: 1 }) }));
vi.mock('@/contexts/cart-context', () => ({ useCart: () => ({ removeItem: vi.fn() }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), redirect: vi.fn() }));
vi.mock('next/image', () => ({ default: ({ alt }: { alt: string }) => React.createElement('img', { alt }) }));
import ReceiptPage from '@/app/checkout/receipt/[id]/page';
import CheckoutPage from '@/app/checkout/page';
import CreditRefundNotice from '@/components/checkout/credit-refund-notice';
import { randomUUID } from 'node:crypto';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { quoteShowcaseCart } from './showcase-policy';
import { quoteSettlementCart } from './settlement-quote';

const creditQuote = quoteShowcaseCart([{ productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1 }]);

beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('VERCEL', '0');
  m.cartQuote.mockReturnValue({ ready: true, loading: false, error: '', quote: { currency: 'NOK', totalMinor: 3900,
    lines: [{ productId: SHOWCASE_PRODUCTS.credits.id, credits: 100, amountMinor: 3900 }] } });
  m.auth.mockResolvedValue({ user: { id: 'buyer' } });
  m.account.mockResolvedValue({ balance: 0, refundAdjustment: 7 });
  m.receipt.mockResolvedValue({ orderId: 'order', userId: 'buyer', environment: 'SANDBOX', state: 'REFUNDED', totalOre: 3900,
    quote: creditQuote, refundedOre: 3900, refundReference: 'REFUND1', captureId: 'CAPTURE1', Order: { OrderItem: [], ReturnRequest: [], DownloadToken: [
      { id: 'file', token: 'must-not-be-shown', usedCount: 0, maxUses: 3, DigitalAsset: { fileName: 'interview.jpg' } },
    ] } });
  m.cart.mockResolvedValue({ CartItem: [{ id: 'cart-item', productId: 'cveggatinterviewcredits01', quantity: 1, Product: { id: 'cveggatinterviewcredits01', title: 'Interviewer AI Credits', productType: 'DIGITAL', visibility: 'PUBLIC', downloadsEnabled: true, image: ['/fixture.jpg'] } }] });
});
afterEach(() => vi.unstubAllEnvs());

it.each([
  ['REFUNDED', 'Your order was refunded'],
  ['REVERSED', 'Your payment was reversed'],
  ['PAYMENT_REVIEW', 'Your payment is under review'],
])('shows %s without download links or a confirmed-order heading', async (state, heading) => {
  const fixture = await m.receipt(); m.receipt.mockResolvedValue({ ...fixture, state });
  const html = renderToStaticMarkup(await ReceiptPage({ params: Promise.resolve({ id: 'order' }) }));
  expect(html).toContain(heading);
  expect(html).toContain('Verified refund amount');
  expect(html).toMatch(/USD\s*3\.90/); expect(html).toContain('(0.00195 ETH)');
  expect(html).not.toContain('(NOK');
  expect(html).toContain('Original payment details'); expect(html).toContain('39.00 NOK');
  expect(html).toContain('Recorded amounts do not change.');
  expect(html).toContain('Original recorded amounts are unchanged.');
  expect(html).toContain('REFUND1'); expect(html).toContain('Credit refund adjustment: 7 credits');
  expect(html).not.toContain('must-not-be-shown'); expect(html).not.toContain('Your order is confirmed');
});
it('explains exactly how a new pack offsets used refunded credits before payment', async () => {
  const html = renderToStaticMarkup(await CheckoutPage({}));
  expect(m.account).toHaveBeenCalledWith({ where: { id: 'SANDBOX:buyer' }, select: { refundAdjustment: true } });
  expect(html).toContain('7 cover the adjustment and 93 become available to use');
  expect(html.indexOf('7 cover the adjustment')).toBeLessThan(html.indexOf('Continue to PayPal'));
  expect(html).toContain('not a card charge or a cash bill');
});
it('never promises usable credits when the adjustment exceeds a pack', () => {
  const html = renderToStaticMarkup(React.createElement(CreditRefundNotice, { adjustment: 120, purchasedCredits: 100 }));
  expect(html).toContain('100 cover the adjustment and 0 become available to use');
});
it('does not display an adjustment notice for an unaffected account', () => {
  expect(renderToStaticMarkup(React.createElement(CreditRefundNotice, { adjustment: 0 }))).toBe('');
});
it('gives credit-only buyers a useful next action without suggesting a file download', async () => {
  const fixture = await m.receipt();
  m.receipt.mockResolvedValue({ ...fixture, state: 'COMPLETED', refundedOre: 0, refundReference: null,
    quote: creditQuote, Order: { OrderItem: [], ReturnRequest: [], DownloadToken: [] } });
  m.account.mockResolvedValue({ balance: 100, refundAdjustment: 0 });
  const html = renderToStaticMarkup(await ReceiptPage({ params: Promise.resolve({ id: 'order' }) }));
  expect(html).toContain('100 test credits purchased');
  expect(html).toContain('Test credits are separate from your live balance');
  expect(html).toContain('Use credits in AI chat');
  expect(html).not.toContain('My downloads');
  expect(html).toContain('Withdraw from this purchase');
  expect(html).toContain('Report a purchase problem');
});
it('keeps receipt file transfers on the page with accessible download buttons', async () => {
  const fixture = await m.receipt();
  const fileQuote = quoteShowcaseCart([{ productId: SHOWCASE_PRODUCTS.interviewPack.id, quantity: 1 }]);
  m.receipt.mockResolvedValue({ ...fixture, state: 'COMPLETED', quote: fileQuote, totalOre: fileQuote.totalOre, refundedOre: 0 });
  const html = renderToStaticMarkup(await ReceiptPage({ params: Promise.resolve({ id: 'order' }) }));
  expect(html).toContain('Download interview.jpg');
  expect(html).not.toContain('href="/api/download/');
});
it('treats the cancellation query only as navigation feedback, never payment proof', async () => {
  const html = renderToStaticMarkup(await CheckoutPage({ searchParams: Promise.resolve({ cancelled: '1' }) }));
  expect(html).toContain('Your basket is saved. Already approved payment? Check');
  expect(html).not.toContain('Your order is confirmed');
  expect(html).toContain('My orders');
  expect(html).toContain('Continue to PayPal');
});
it('does not claim a zero-credit pack while the new price is loading', async () => {
  m.cartQuote.mockReturnValue({ ready: false, loading: true, error: '', quote: null });
  const html = renderToStaticMarkup(await CheckoutPage({}));
  expect(html).toContain('Credit refund adjustment: 7 credits');
  expect(html).not.toContain('This pack adds 0 credits');
});
it('renders native USD money and crypto, never the NOK exposure as the paid total', async () => {
  const fixture = await m.receipt(), now = Date.parse('2026-09-25T12:00:00Z');
  const quote = quoteSettlementCart({ currency: 'USD', items: [{ productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1, credits: { type: 'spend', amount: '100' } }] },
    { now, fx: { source: 'ECB_VIA_FRANKFURTER', base: 'NOK', currency: 'USD', rate: '0.105', publishedOn: '2026-09-25', fetchedAt: new Date(now).toISOString() },
      models: [{ credits: 1, reserveMicroUsd: 10000 }], modelCostReviewBy: '2026-10-24T00:00:00Z' });
  m.receipt.mockResolvedValue({ ...fixture, quote: { settlement: quote }, currency: 'USD', totalMinor: 10000, totalOre: quote.exposureNokOre,
    refundedMinor: 2500, refundedOre: 0, settlementQuoteId: randomUUID() });
  const html = renderToStaticMarkup(await ReceiptPage({ params: Promise.resolve({ id: 'order' }) }));
  expect(html).toMatch(/USD\s*100\.00/); expect(html).toContain('(0.05 ETH)');
  expect(html).toMatch(/USD\s*25\.00/);
  expect(html).toContain('100.00'); expect(html).toContain('USD.');
  expect(html).not.toContain('952.39'); expect(html).not.toContain('952.38');
});
