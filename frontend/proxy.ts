import {
  DEFAULT_LOGIN_REDIRECT,
  apiAuthPrefix,
  authRoutes,
  publicRoutes,
} from "@/routes";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ACCESS_GATE_CONFIG } from "@/lib/site-config";
import { makeGateCookieValue } from "@/lib/access-gate-cookie";

// ─────────────────────────────────────────────────────────────────────────────
// ACCESS GATE - Production testing lock
// Uses config from lib/site-config.ts - change SITE_MODE to 'public' to disable
// ─────────────────────────────────────────────────────────────────────────────
const ACCESS_GATE_ENABLED = ACCESS_GATE_CONFIG.enabled;
const CORRECT_PASSWORD = ACCESS_GATE_CONFIG.password;
const COOKIE_NAME = ACCESS_GATE_CONFIG.cookieName;
const COOKIE_VALUE = makeGateCookieValue(CORRECT_PASSWORD);

// Routes that bypass the access gate (legal pages should be accessible)
const GATE_BYPASS_ROUTES = ACCESS_GATE_CONFIG.bypassRoutes;

function checkAccessGate(req: NextRequest): NextResponse | null {
  if (!ACCESS_GATE_ENABLED) return null;

  const { pathname } = req.nextUrl;

  // Never redirect API requests to an HTML gate page.
  // This avoids breaking client-side fetch() calls that expect JSON.
  if (pathname.startsWith('/api') || pathname.startsWith('/trpc')) {
    const accessCookie = req.cookies.get(COOKIE_NAME);
    if (accessCookie?.value === COOKIE_VALUE) {
      return null;
    }
    return NextResponse.json(
      { error: 'Access Gate: authentication required' },
      { status: 401 }
    );
  }

  // Never gate NextAuth/Auth.js endpoints. OAuth redirects and callbacks rely on these.
  if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) {
    return null;
  }

  // Skip gate for bypass routes (legal pages, gate itself, API)
  const shouldBypass = GATE_BYPASS_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );
  if (shouldBypass) {
    return null;
  }
  
  // Skip static files
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.includes('.')) {
    return null;
  }

  // Check for access cookie
  const accessCookie = req.cookies.get(COOKIE_NAME);

  if (accessCookie?.value === COOKIE_VALUE) {
    return null; // Authenticated
  }

  // Not authenticated - redirect to gate
  const gateUrl = new URL('/gate', req.url);
  gateUrl.searchParams.set('redirect', pathname);
  
  return NextResponse.redirect(gateUrl);
}
// ─────────────────────────────────────────────────────────────────────────────

function generateNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function buildCsp(nonce: string, isDev: boolean) {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    ...(isDev ? ["'unsafe-eval'"] : []),
    "https:",
  ].join(" ");

  const styleSrc = ["'self'", "'unsafe-inline'", "https:"].join(" ");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' https: data: blob:",
    "font-src 'self' https: data:",
    `style-src ${styleSrc}`,
    `script-src ${scriptSrc}`,
    "connect-src 'self' https: wss:",
    "upgrade-insecure-requests",
  ].join("; ");
}

function applySecurityHeaders(res: NextResponse, requestId: string, nonce: string, pathname: string = '') {
  const isDev = process.env.NODE_ENV !== "production";
  const isGatePage = pathname === '/gate';

  res.headers.set("x-request-id", requestId);
  res.headers.set("x-content-type-options", "nosniff");
  res.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  res.headers.set("x-frame-options", "DENY");
  res.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(self), payment=(), usb=(), magnetometer=(), gyroscope=()"
  );
  // Wallet SDKs (Coinbase Smart Wallet, etc.) often require popups that rely on
  // window.opener. In dev, allow popups; in prod keep stricter isolation.
  // Gate page also needs looser COOP to work properly
  res.headers.set("cross-origin-opener-policy", (isDev || isGatePage) ? "same-origin-allow-popups" : "same-origin");

  if (!isDev) {
    res.headers.set(
      "strict-transport-security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  // Skip CSP for gate page to avoid console noise
  if (isGatePage) {
    return res;
  }

  // In development, CSP (even report-only) produces a lot of console noise from
  // browser extensions and injected wallet scripts. Default to off in dev.
  const csp = buildCsp(nonce, isDev);
  const enforce = process.env.CSP_ENFORCE === "true";
  const report = process.env.CSP_REPORT === "true";
  if (!isDev || enforce || report) {
    if (enforce) res.headers.set("content-security-policy", csp);
    else res.headers.set("content-security-policy-report-only", csp);
  }

  return res;
}

const SESSION_COOKIE_NAMES = [
  // next-auth v4
  "__Secure-next-auth.session-token",
  "next-auth.session-token",

  // Auth.js / next-auth v5
  "__Secure-authjs.session-token",
  "authjs.session-token",
];

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => Boolean(req.cookies.get(name)?.value));
}

export default function proxy(req: NextRequest) {
  // ─── ACCESS GATE CHECK (first priority) ───
  const gateResponse = checkAccessGate(req);
  if (gateResponse) {
    return gateResponse;
  }

  const { nextUrl } = req;
  const { pathname } = nextUrl;
  const isLoggedIn = hasSessionCookie(req);

  const requestHeaders = new Headers(req.headers);
  const requestId = crypto.randomUUID();
  const nonce = generateNonce();
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-nonce", nonce);

  const isApiAuthRoute = apiAuthPrefix.some((prefix) => pathname.startsWith(prefix));
  const isAuthRoute = authRoutes.includes(pathname);
  const isApiRoute = pathname.startsWith("/api") || pathname.startsWith("/trpc");

  // Allow /products and /products/[id] to be public, but /products/create requires auth.
  const isPublicProductPage = 
    (pathname === "/products" || pathname.startsWith("/products/")) &&
    pathname !== "/products/create";

  const isPublicRoute = publicRoutes.includes(pathname) || isPublicProductPage;

  if (isApiAuthRoute) {
    return applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      requestId,
      nonce,
      pathname
    );
  }

  // Never redirect API routes to HTML pages. Let route handlers return JSON 401/403.
  if (isApiRoute) {
    return applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      requestId,
      nonce,
      pathname
    );
  }

  if (isAuthRoute) {
    if (isLoggedIn) {
      return applySecurityHeaders(
        NextResponse.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl)),
        requestId,
        nonce,
        pathname
      );
    }

    return applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      requestId,
      nonce,
      pathname
    );
  }

  if (!isLoggedIn && !isPublicRoute) {
    let callbackUrl = pathname;
    if (nextUrl.search) callbackUrl += nextUrl.search;

    const encodedCallbackUrl = encodeURIComponent(callbackUrl);
    return applySecurityHeaders(
      NextResponse.redirect(new URL(`/auth/login?callbackUrl=${encodedCallbackUrl}`, nextUrl)),
      requestId,
      nonce,
      pathname
    );
  }

  return applySecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    requestId,
    nonce,
    pathname
  );
}

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
