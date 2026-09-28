/** @fileOverview Development never disables webhook authentication. @stability stable */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { verifyPayPalWebhook, verifyWebhookSignature } from './webhook-verify';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
beforeEach(() => {
  vi.stubEnv('PAYPAL_WEBHOOK_ID', 'qa-webhook'); vi.stubEnv('PAYPAL_CLIENT_ID', 'qa-client'); vi.stubEnv('PAYPAL_CLIENT_SECRET', 'qa-secret');
  vi.stubEnv('VERCEL', ''); vi.stubEnv('VERCEL_ENV', '');
});
const signedHeaders = () => new Headers({ 'paypal-auth-algo': 'SHA256withRSA', 'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/qa', 'paypal-transmission-id': 'qa-transmission', 'paypal-transmission-sig': 'qa-signature', 'paypal-transmission-time': '2026-09-23T00:00:00Z' });
it('rejects unsigned local Sandbox events', async () => {
  vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('PAYPAL_WEBHOOK_ID', '');
  expect(await verifyWebhookSignature('paypal', '{}', new Headers())).toBe(false);
});
it('preserves the exact raw event inside the postback verification request', async () => {
  const raw = '{ "id": "qa-event", "resource": {"number": 1.00, "label": "\\u0041"} }';
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ access_token: 'qa-token' })).mockResolvedValueOnce(Response.json({ verification_status: 'SUCCESS' }));
  vi.stubGlobal('fetch', fetchMock);
  expect(await verifyPayPalWebhook(raw, signedHeaders())).toBe(true);
  const [url, request] = fetchMock.mock.calls[1];
  expect(url).toBe('https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature');
  expect(request.body).toContain('"webhook_event":' + raw + '}');
  expect(JSON.parse(request.body).webhook_event).toEqual(JSON.parse(raw));
  expect(request.redirect).toBe('error');
});
it('rejects missing signature headers and invalid event objects without provider requests', async () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  expect(await verifyPayPalWebhook('{}', new Headers())).toBe(false);
  for (const raw of ['{', '{} , "extra": true', '[]', 'null', '1']) expect(await verifyPayPalWebhook(raw, signedHeaders())).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});
it('requires a successful PayPal verification response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ access_token: 'qa-token' })).mockResolvedValueOnce(Response.json({ verification_status: 'FAILURE' })));
  expect(await verifyPayPalWebhook('{}', signedHeaders())).toBe(false);
});
