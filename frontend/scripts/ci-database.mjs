/** @fileOverview Strict identity for the disposable loopback-only CI database. @stability stable */
/** @param {string | undefined} value @param {Record<string, string | undefined>} env */
export function isDisposableCiDatabase(value, env = process.env) {
  try {
    const url = new URL(value ?? '');
    return env.CI === 'true' && env.VERCEL_ENV === 'preview' && !env.VERCEL &&
      !env.DATABASE_URL_MAINLIVE && ['postgres:', 'postgresql:'].includes(url.protocol) &&
      ['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '5432' &&
      url.pathname === '/veggat_ci' && url.username === 'veggat_ci' &&
      url.searchParams.get('sslmode') === 'disable' && url.searchParams.size === 1;
  } catch { return false; }
}
