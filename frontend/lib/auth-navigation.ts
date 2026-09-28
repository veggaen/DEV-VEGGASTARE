/** @fileOverview Trusted auth origins and same-origin post-login navigation. @stability stable */
export function authOrigin(configured = process.env.AUTH_URL || process.env.NEXTAUTH_URL): string {
  const url = new URL(configured || 'https://www.veggat.com');
  const local = url.hostname === 'localhost' && url.port === '3000';
  if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
    throw new Error('AUTH_URL must use HTTPS or http://localhost:3000');
  }
  return url.origin;
}

export function safeAuthRedirect(value?: string | null, fallback = '/products'): string {
  // Reject protocol-relative URLs, browser backslash normalization and control characters.
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return fallback;
  const url = new URL(value, 'https://auth.invalid');
  if (url.origin !== 'https://auth.invalid' || url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/auth/')) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
