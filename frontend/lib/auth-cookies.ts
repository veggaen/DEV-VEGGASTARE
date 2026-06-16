/**
 * Single source of truth for Auth.js cookie names.
 *
 * WHY THIS FILE EXISTS:
 * The edge middleware (proxy.ts) decides auth routing by checking for the
 * session cookie *by name*. auth.ts configures what that name is. If the two
 * drift apart, logged-in users are treated as logged-out — protected pages
 * bounce to login, /nexus shows an infinite "Loading…", OAuth completions look
 * like they did nothing. (That exact bug happened once; this module exists so
 * it can't happen again.)
 *
 * Import these from BOTH auth.ts and proxy.ts. Edge-safe: no Node-only imports.
 */

/** True when the deployment is served over https (Vercel prod/preview). */
const isHttps = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "").startsWith("https");

/** Secure-cookie prefix browsers require for `Secure` cookies on https. */
const securePrefix = isHttps ? "__Secure-" : "";

/** The configured Auth.js session-token cookie name (current). */
export const SESSION_COOKIE_NAME = `${securePrefix}authjs.session-token`;

/** Standard shared cookie options for the custom-named cookies. */
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: isHttps,
};

export const PKCE_COOKIE_NAME = `${securePrefix}authjs.pkce.code_verifier`;
export const STATE_COOKIE_NAME = `${securePrefix}authjs.state`;
export const NONCE_COOKIE_NAME = `${securePrefix}authjs.nonce`;

/**
 * Every session-token cookie name the middleware should accept as "has a
 * session". Includes the current name plus legacy names so in-flight cookies
 * from older deploys still resolve during a rollout. KEEP the current name in
 * sync via SESSION_COOKIE_NAME above.
 */
export const SESSION_COOKIE_NAMES = [
  SESSION_COOKIE_NAME,
  "authjs.session-token",
  "__Secure-authjs.session-token",
  // legacy (do not reuse): a brief versioned-name experiment
  "__Secure-veggat.session-token.v2",
  "veggat.session-token.v2",
  // next-auth v4 legacy
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];
