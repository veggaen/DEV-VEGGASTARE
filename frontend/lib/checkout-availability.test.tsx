/** @fileOverview Server-rendered checkout identifies unavailable cart lines without offering a payment action. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ cart: vi.fn(), configured: vi.fn() }));
vi.mock('@/auth', () => ({ auth: async () => ({ user: { id: 'availability-test-user' } }) }));
vi.mock('@/lib/db', () => ({ dbPrisma: { cart: { findUnique: mocks.cart } } }));
vi.mock('@/lib/payments/showcase-paypal', () => ({ paypalConfigured: mocks.configured }));
vi.mock('@/components/checkout/preferred-money', () => ({ default: () => null }));
vi.mock('@/components/checkout/checkout-edit-context', () => ({ CheckoutEditProvider: () => null, RemoveCheckoutItem: () => null, CheckoutCreditAmount: () => null }));
vi.mock('@/components/checkout/reviewer-checkout-button', () => ({ default: () => null }));
vi.mock('@/components/checkout/credit-refund-notice', () => ({ default: () => null }));
import CheckoutPage from '@/app/checkout/page';
import { SHOWCASE_PRODUCTS } from './showcase-catalog';

beforeEach(() => vi.clearAllMocks());
it.each([
  { id: 'browse-only-item', downloadsEnabled: true, label: 'Browse-only listing' },
  { id: SHOWCASE_PRODUCTS.interviewPack.id, downloadsEnabled: false, label: 'Purchases paused' },
])('identifies $label before showing the payment controls', async product => {
  mocks.cart.mockResolvedValue({ CartItem: [{ id: 'line', productId: product.id, quantity: 1,
    Product: { ...product, title: 'Selected digital product', productType: 'DIGITAL', visibility: 'PUBLIC', image: [] } }] });
  const html = renderToStaticMarkup(await CheckoutPage({}));
  expect(html).toContain('Some items need attention'); expect(html).toContain('Selected digital product');
  expect(html).toContain(product.label); expect(html).toContain('Review your cart');
  expect(html).not.toContain('Payment summary'); expect(mocks.configured).not.toHaveBeenCalled();
});
