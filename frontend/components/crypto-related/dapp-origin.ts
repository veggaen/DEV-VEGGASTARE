/**
 * Resolve the dapp's origin for WalletConnect / AppKit `metadata.url`.
 *
 * WalletConnect (Reown) compares `metadata.url` against the page's actual
 * origin and warns when they differ ("…can lead to issues"). The origin must be
 * the *runtime* one — a build-time env var like NEXT_PUBLIC_SITE_URL is baked in
 * and goes stale the moment the app runs on a different host/port (the :3005
 * test server, a Vercel preview, 127.0.0.1 vs localhost, …), producing exactly
 * that mismatch warning.
 *
 * So in the browser we use the live `window.location.origin`; only during SSR
 * (where `window` is undefined) do we fall back to the configured site URL.
 */
const FALLBACK_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.veggat.com";

export function getDappOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return FALLBACK_SITE_URL;
}
