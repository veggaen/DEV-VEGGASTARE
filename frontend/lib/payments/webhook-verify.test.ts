/** @fileOverview Development never disables webhook authentication. @stability stable */
import { afterEach, expect, it, vi } from 'vitest';
import { verifyWebhookSignature } from './webhook-verify';
afterEach(() => vi.unstubAllEnvs());
it('rejects unsigned local Sandbox events', async () => {
  vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('PAYPAL_WEBHOOK_ID', '');
  expect(await verifyWebhookSignature('paypal', '{}', new Headers())).toBe(false);
});
