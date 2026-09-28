/** @fileOverview Availability must describe released checkout, never just configured credentials. @stability stable */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ paused: vi.fn(), runtime: vi.fn(), methods: vi.fn(), gate: vi.fn(), provider: vi.fn(), auth: vi.fn(), release: vi.fn(), order: vi.fn() }));
vi.mock('@/lib/checkout-release', () => ({ legacyCheckoutPaused: mocks.paused }));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeConfig: mocks.runtime }));
vi.mock('@/lib/payments/providers', () => ({ getAvailablePaymentMethods: mocks.methods, getPaymentProvider: mocks.provider }));
vi.mock('@/lib/payments/provider-gating', () => ({ getProviderGate: mocks.gate }));
vi.mock('@/lib/payments/complete-fiat-order', () => ({ releaseReservedOrderStock: mocks.release }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: mocks.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { order: { findUnique: mocks.order } } }));
import { GET, POST } from '@/app/api/payments/route';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';

beforeEach(() => {
  vi.clearAllMocks(); mocks.paused.mockReturnValue(true); mocks.auth.mockResolvedValue({ id: 'test-buyer' });
  vi.stubEnv('VERCEL', ''); vi.stubEnv('VERCEL_ENV', ''); vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('PAYPAL_CLIENT_ID', 'test-client-not-a-real-credential');
  vi.stubEnv('PAYPAL_CLIENT_SECRET', 'test-secret-not-a-real-credential'); vi.stubEnv('PAYPAL_WEBHOOK_ID', '');
});
afterEach(() => vi.unstubAllEnvs());

it('reports local Sandbox reviewer PayPal separately, with no legacy or crypto checkout and no runtime DB read', async () => {
  const response = await GET(); expect(response.headers.get('cache-control')).toBe('no-store');
  const body = await response.json(); expect(body.methods).toEqual([]); expect(body.legacyCheckoutPaused).toBe(true);
  expect(body.reviewerCheckout).toEqual({ path: '/checkout', environment: 'SANDBOX',
    products: Object.values(SHOWCASE_PRODUCTS).map(({ id, title }) => ({ id, title })),
    methods: [{ type: 'paypal', displayName: 'PayPal', currencies: ['NOK'] }] });
  expect(body.unavailableMethods[0].type).toBe('crypto');
  expect(mocks.runtime).not.toHaveBeenCalled(); expect(mocks.methods).not.toHaveBeenCalled();
  expect(mocks.provider).not.toHaveBeenCalled(); expect(mocks.order).not.toHaveBeenCalled();
  expect(JSON.stringify(body)).not.toContain('test-secret');
});
it('keeps Vercel Preview on Sandbox despite production NODE_ENV', async () => {
  vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_ENV', 'preview');
  expect((await (await GET()).json()).reviewerCheckout.environment).toBe('SANDBOX');
});
it.each(['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'])('does not advertise PayPal when %s is absent', async key => {
  vi.stubEnv(key, ''); expect((await (await GET()).json()).reviewerCheckout.methods).toEqual([]);
});
it('does not advertise Live PayPal until webhook verification is configured', async () => {
  vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_ENV', 'production');
  let checkout = (await (await GET()).json()).reviewerCheckout;
  expect(checkout.environment).toBe('LIVE'); expect(checkout.methods).toEqual([]);
  vi.stubEnv('PAYPAL_WEBHOOK_ID', 'test-webhook');
  checkout = (await (await GET()).json()).reviewerCheckout;
  expect(checkout.methods.map((method: { type: string }) => method.type)).toEqual(['paypal']);
});
it('keeps future legacy provider gates, and never admits unimplemented crypto', async () => {
  mocks.paused.mockReturnValue(false); mocks.runtime.mockResolvedValue({ paymentsLiveEnabled: true });
  mocks.methods.mockReturnValue([{ type: 'crypto' }, { type: 'paypal' }, { type: 'klarna' }]);
  mocks.gate.mockImplementation(type => ({ enabled: type === 'paypal' }));
  const body = await (await GET()).json(); expect(body.methods).toEqual([{ type: 'paypal' }]);
  expect(mocks.gate).not.toHaveBeenCalledWith('crypto', expect.anything());
});
it('leaves legacy session creation paused without provider, order, or fulfillment calls', async () => {
  const response = await POST(new Request('http://localhost:3000/api/payments', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'paypal', orderId: 'test', amount: 100, returnUrl: 'http://localhost:3000/checkout' }) }));
  expect(response.status).toBe(503); expect((await response.json()).error).toBe('CHECKOUT_UPGRADING');
  expect(mocks.provider).not.toHaveBeenCalled(); expect(mocks.order).not.toHaveBeenCalled(); expect(mocks.release).not.toHaveBeenCalled();
});
