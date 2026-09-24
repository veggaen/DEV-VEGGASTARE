/** @fileOverview Refuse unsafe hosted Preview configuration before migrations. @stability stable */
export function validatePreviewDeployment(env) {
  // Local production-style QA intentionally uses localhost and Sandbox without
  // an externally reachable webhook. Only hosted Preview builds use this gate.
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'preview') return;
  let origin;
  try { origin = new URL(env.AUTH_URL || env.NEXTAUTH_URL || ''); } catch {
    throw new Error('Preview deployment requires an explicit HTTPS AUTH_URL. Values are redacted.');
  }
  const productionHosts = new Set(['veggat.com', 'www.veggat.com', 'dev-veggastare.vercel.app',
    'dev-veggastare-v3ggas-projects.vercel.app']);
  if (env.VERCEL_PROJECT_PRODUCTION_URL) productionHosts.add(env.VERCEL_PROJECT_PRODUCTION_URL.toLowerCase().replace(/\.$/, ''));
  const hostname = origin.hostname.replace(/\.$/, '');
  if (origin.protocol !== 'https:' || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash ||
      ['localhost', '127.0.0.1', '[::1]'].includes(hostname) || productionHosts.has(hostname)) {
    throw new Error('Preview AUTH_URL must be a Preview HTTPS origin, never a production or local callback. Values are redacted.');
  }
  const paymentKeys = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'];
  if (paymentKeys.some(key => env[key]?.trim()) && !paymentKeys.every(key => env[key]?.trim())) {
    throw new Error('Hosted Preview payments require PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and PAYPAL_WEBHOOK_ID together. Use Sandbox values only.');
  }
}
