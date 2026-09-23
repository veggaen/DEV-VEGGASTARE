/** @fileOverview Adjusted payments never advertise paid delivery or hide credit offsets. @stability stable */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), receipt: vi.fn(), account: vi.fn(), cart: vi.fn() }));
vi.mock('@/auth', () => ({ auth: m.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { checkoutAttempt: { findUnique: m.receipt }, aiCreditAccount: { findUnique: m.account }, cart: { findUnique: m.cart } } }));
vi.mock('@/lib/payments/showcase-paypal', () => ({ paypalConfigured: () => true }));
vi.mock('@/components/checkout/reviewer-checkout-button', () => ({ default: () => React.createElement('button', null, 'Continue to PayPal') }));
vi.mock('next/image', () => ({ default: ({ alt }: { alt: string }) => React.createElement('img', { alt }) }));
import ReceiptPage from '@/app/checkout/receipt/[id]/page';
import CheckoutPage from '@/app/checkout/page';
import CreditRefundNotice from '@/components/checkout/credit-refund-notice';

beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('VERCEL', '0');
  m.auth.mockResolvedValue({ user: { id: 'buyer' } });
  m.account.mockResolvedValue({ balance: 0, refundAdjustment: 7 });
  m.receipt.mockResolvedValue({ orderId: 'order', userId: 'buyer', environment: 'SANDBOX', state: 'REFUNDED', totalOre: 3900,
    refundedOre: 3900, refundReference: 'REFUND1', captureId: 'CAPTURE1', Order: { OrderItem: [], DownloadToken: [
      { id: 'file', token: 'must-not-be-shown', usedCount: 0, maxUses: 3, DigitalAsset: { fileName: 'interview.jpg' } },
    ] } });
  m.cart.mockResolvedValue({ CartItem: [{ productId: 'cveggatinterviewcredits01', quantity: 1, Product: { image: ['/fixture.jpg'] } }] });
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
  expect(html).toContain('Verified refund amount'); expect(html).toContain('39.00 NOK');
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
    quote: { lines: [{ kind: 'AI_CREDITS', credits: 100 }] }, Order: { OrderItem: [], DownloadToken: [] } });
  m.account.mockResolvedValue({ balance: 100, refundAdjustment: 0 });
  const html = renderToStaticMarkup(await ReceiptPage({ params: Promise.resolve({ id: 'order' }) }));
  expect(html).toContain('100 test credits purchased');
  expect(html).toContain('Test credits are separate from your live balance');
  expect(html).toContain('Use credits in AI chat');
  expect(html).not.toContain('My downloads');
});
it('keeps receipt file transfers on the page with accessible download buttons', async () => {
  const fixture = await m.receipt();
  m.receipt.mockResolvedValue({ ...fixture, state: 'COMPLETED', quote: { lines: [{ kind: 'DIGITAL_FILES', credits: 0 }] } });
  const html = renderToStaticMarkup(await ReceiptPage({ params: Promise.resolve({ id: 'order' }) }));
  expect(html).toContain('Download interview.jpg');
  expect(html).not.toContain('href="/api/download/');
});
it('treats the cancellation query only as navigation feedback, never payment proof', async () => {
  const html = renderToStaticMarkup(await CheckoutPage({ searchParams: Promise.resolve({ cancelled: '1' }) }));
  expect(html).toContain('Returning here does not confirm a payment or add credits');
  expect(html).toContain('My orders');
  expect(html).toContain('Continue to PayPal');
});
