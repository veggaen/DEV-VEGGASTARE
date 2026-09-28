/** @fileOverview Reports released checkout capabilities without opening a payment session. @stability stable */
import 'server-only';
import { legacyCheckoutPaused } from '@/lib/checkout-release';
import { getRuntimeConfig } from '@/lib/runtime-config';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { getAvailablePaymentMethods } from './providers';
import { getProviderGate } from './provider-gating';
import { paypalConfigured } from './showcase-paypal';
import { paypalEnvironment } from './showcase-policy';

export async function getPaymentCapabilities() {
  const paused = legacyCheckoutPaused();
  // The legacy provider switch does not govern the authoritative reviewer
  // checkout. Keep the two scopes explicit; credentials alone are not release.
  const runtime = paused ? null : await getRuntimeConfig();
  const methods = runtime ? getAvailablePaymentMethods().filter(method =>
    method.type !== 'crypto' && getProviderGate(method.type, runtime).enabled,
  ) : [];
  return {
    methods,
    legacyCheckoutPaused: paused,
    reviewerCheckout: {
      path: '/checkout',
      environment: paypalEnvironment().mode,
      products: Object.values(SHOWCASE_PRODUCTS).map(({ id, title }) => ({ id, title })),
      methods: paypalConfigured() ? [{ type: 'paypal', displayName: 'PayPal', currencies: ['NOK'] }] : [],
    },
    unavailableMethods: [{ type: 'crypto', reason: 'Verified Web3 checkout is not released. Connecting a wallet does not enable payment.' }],
  };
}
