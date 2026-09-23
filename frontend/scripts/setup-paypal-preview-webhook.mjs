/** @fileOverview Idempotent Sandbox-only webhook registration for the isolated showcase Preview. @stability active */
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
const env = parse(readFileSync(new URL('../.private-showcase/paypal-development.env', import.meta.url)));
const origin = 'https://api-m.sandbox.paypal.com';
const url = 'https://dev-veggastare-git-showcase-ai-revival-v3ggas-projects.vercel.app/api/webhooks/paypal';
const events = ['PAYMENT.CAPTURE.COMPLETED', 'PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.CAPTURE.REVERSED'];
if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) throw new Error('Sandbox credentials missing');
const tokenResponse = await fetch(origin + '/v1/oauth2/token', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
  headers: { Authorization: 'Basic ' + Buffer.from(env.PAYPAL_CLIENT_ID + ':' + env.PAYPAL_CLIENT_SECRET).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
if (!tokenResponse.ok) throw new Error('Sandbox authentication failed');
const { access_token } = await tokenResponse.json();
if (typeof access_token !== 'string') throw new Error('No Sandbox token');
async function request(path, options = {}) {
  const response = await fetch(origin + path, { ...options, redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { Authorization: 'Bearer ' + access_token, 'Content-Type': 'application/json' } });
  if (!response.ok) throw new Error('Sandbox webhook API status ' + response.status);
  return response.json();
}
const listed = await request('/v1/notifications/webhooks');
const matches = (listed.webhooks ?? []).filter(item => item.url === url);
if (matches.length > 1) throw new Error('Duplicate target subscriptions require review');
let webhook = matches[0];
if (!webhook && !process.argv.includes('--apply')) {
  console.log(JSON.stringify({ configured: false, target: url, events, action: 'Run with --apply to register Sandbox only.' }));
} else {
  if (!webhook) webhook = await request('/v1/notifications/webhooks', { method: 'POST', body: JSON.stringify({ url, event_types: events.map(name => ({ name })) }) });
  const verified = await request('/v1/notifications/webhooks/' + encodeURIComponent(webhook.id));
  if (verified.url !== url || JSON.stringify(verified.event_types.map(item => item.name).sort()) !== JSON.stringify([...events].sort())) throw new Error('Webhook scope mismatch; no existing subscription modified');
  console.log(JSON.stringify({ configured: true, environment: 'SANDBOX', webhookId: verified.id, target: verified.url, events }));
}
