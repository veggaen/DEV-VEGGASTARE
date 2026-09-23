/**
 * @fileOverview Payment webhook signature verification for all providers.
 * @stability stable — critical security code, do not modify without review.
 *
 * Each provider has a different signature mechanism:
 * - Vipps: Authorization header matches webhook secret
 * - Klarna: HMAC-SHA256 of body verified against X-Klarna-Hmac-Sha256 header
 * - PayPal: Full certificate-based verification via PayPal API
 *
 * Verification is mandatory in every environment, including local Sandbox.
 */

import crypto from 'crypto';
import { paypalEnvironment } from './showcase-policy';

const LOG = '[webhook-verify]';

// ─── Vipps ────────────────────────────────────────────────────

/**
 * Vipps webhooks send an Authorization header containing the webhook secret.
 * @see https://developer.vippsmobilepay.com/docs/APIs/webhooks-api/
 */
export function verifyVippsWebhook(
  _rawBody: string,
  headers: Headers,
): boolean {
  const secret = process.env.VIPPS_WEBHOOK_SECRET;
  if (!secret) {
    console.error(LOG, 'VIPPS_WEBHOOK_SECRET not configured');
    return false;
  }

  const authorization = headers.get('authorization');
  if (!authorization) {
    console.error(LOG, 'Vipps webhook missing Authorization header');
    return false;
  }

  // Vipps sends the secret as the Authorization header value
  try {
    return crypto.timingSafeEqual(
      Buffer.from(authorization),
      Buffer.from(secret),
    );
  } catch {
    return false;
  }
}

// ─── Klarna ───────────────────────────────────────────────────

/**
 * Klarna webhooks include X-Klarna-Hmac-Sha256 header.
 * Compute HMAC-SHA256 of request body using Klarna API password, then base64-encode.
 * @see https://docs.klarna.com/api/webhooks/
 */
export function verifyKlarnaWebhook(
  rawBody: string,
  headers: Headers,
): boolean {
  const secret = process.env.KLARNA_WEBHOOK_SECRET ?? process.env.KLARNA_API_PASSWORD;
  if (!secret) {
    console.error(LOG, 'KLARNA_WEBHOOK_SECRET/KLARNA_API_PASSWORD not configured');
    return false;
  }

  const signature = headers.get('x-klarna-hmac-sha256');
  if (!signature) {
    console.error(LOG, 'Klarna webhook missing X-Klarna-Hmac-Sha256 header');
    return false;
  }

  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(signature),
    );
  } catch {
    return false;
  }
}

// ─── PayPal ───────────────────────────────────────────────────

/**
 * PayPal webhook verification via their v1/notifications/verify-webhook-signature API.
 * This is the recommended approach — PayPal signs with their cert and we ask their API to validate.
 * @see https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature_post
 */
export async function verifyPayPalWebhook(
  rawBody: string,
  headers: Headers,
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const baseUrl = paypalEnvironment().apiOrigin;

  if (!webhookId || !clientId || !clientSecret) {
    console.error(LOG, 'PayPal webhook env vars not configured (PAYPAL_WEBHOOK_ID, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)');
    return false;
  }

  // Get access token
  const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: {
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!tokenRes.ok) {
    console.error(LOG, 'PayPal auth failed for webhook verification');
    return false;
  }

  const { access_token } = await tokenRes.json();

  // Build verification request
  const verifyBody = {
    auth_algo: headers.get('paypal-auth-algo') ?? '',
    cert_url: headers.get('paypal-cert-url') ?? '',
    transmission_id: headers.get('paypal-transmission-id') ?? '',
    transmission_sig: headers.get('paypal-transmission-sig') ?? '',
    transmission_time: headers.get('paypal-transmission-time') ?? '',
    webhook_id: webhookId,
    webhook_event: JSON.parse(rawBody),
  };

  const verifyRes = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(verifyBody),
  });

  if (!verifyRes.ok) {
    console.error(LOG, 'PayPal webhook verification API call failed:', verifyRes.status);
    return false;
  }

  const result = await verifyRes.json();
  return result.verification_status === 'SUCCESS';
}

// ─── Dispatcher ───────────────────────────────────────────────

/**
 * Verify a webhook signature for the given payment provider.
 * Returns true if verified, false if rejected.
 * Never bypass verification for development or test environments.
 */
export async function verifyWebhookSignature(
  provider: string,
  rawBody: string,
  headers: Headers,
): Promise<boolean> {
  switch (provider) {
    case 'vipps':
      return verifyVippsWebhook(rawBody, headers);
    case 'klarna':
      return verifyKlarnaWebhook(rawBody, headers);
    case 'paypal':
      return verifyPayPalWebhook(rawBody, headers);
    default:
      console.error(LOG, `Unknown provider for webhook verification: ${provider}`);
      return false;
  }
}
