'use client';
import { getSession } from 'next-auth/react';

/** Only discard client state/navigate after the server confirms sign-out. */
export async function confirmedSignOut(callbackUrl = '/auth/login') {
  const target = new URL(callbackUrl, window.location.origin);
  if (target.origin !== window.location.origin) throw new Error('Use a local sign-in page.');
  const csrf = await fetch('/api/auth/csrf', { credentials: 'same-origin', signal: AbortSignal.timeout(10_000) });
  const csrfData = await csrf.json().catch(() => null);
  const csrfToken = csrfData?.csrfToken;
  if (!csrf.ok || typeof csrfToken !== 'string' || !csrfToken) throw new Error('Sign-out could not be confirmed. Please try again.');
  const response = await fetch('/api/auth/signout', {
    method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' },
    body: new URLSearchParams({ csrfToken, callbackUrl: target.href }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.url !== 'string' || data.error) throw new Error('Sign-out could not be confirmed. Please try again.');
  const destination = new URL(data.url, window.location.origin);
  if (destination.origin !== window.location.origin || destination.pathname !== target.pathname || destination.search !== target.search) {
    throw new Error('Sign-out could not be confirmed. Please try again.');
  }
  // Public Auth.js API broadcasts the new session to other tabs. Navigation
  // still clears this tab if that optional refresh fails after confirmed logout.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { await Promise.race([getSession({ broadcast: true }).catch(() => null), new Promise(resolve => { timer = setTimeout(resolve, 1000); })]); }
  finally { if (timer) clearTimeout(timer); }
  window.location.assign(destination.href);
}
