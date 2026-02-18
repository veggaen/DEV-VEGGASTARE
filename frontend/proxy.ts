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
// API RATE LIMITING — Edge-compatible, in-memory, per-instance
// Provides baseline protection for ALL API routes. Individual route handlers
// can enforce stricter per-user limits on top via @/lib/rate-limit.
// Two layers:
//   1. Global per-IP cap (300 req/min) — catches enumeration / spray attacks
//   2. Per-tier per-IP cap — tighter limits for expensive or sensitive endpoints
// ─────────────────────────────────────────────────────────────────────────────

const _rlStore = new Map<string, { count: number; reset: number }>();
let _rlLastCleanup = 0;

function _rlCleanup() {
  const now = Date.now();
  if (now - _rlLastCleanup < 60_000) return;
  _rlLastCleanup = now;
  for (const [k, v] of _rlStore) {
    if (v.reset < now) _rlStore.delete(k);
  }
}

function _rlCheck(
  key: string,
  max: number,
  windowMs: number
): { ok: boolean; remaining: number; resetIn: number } {
  _rlCleanup();
  const now = Date.now();
  const entry = _rlStore.get(key);
  if (!entry || entry.reset < now) {
    _rlStore.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: max - 1, resetIn: Math.ceil(windowMs / 1000) };
  }
  entry.count++;
  const remaining = Math.max(0, max - entry.count);
  const resetIn = Math.max(1, Math.ceil((entry.reset - now) / 1000));
  return { ok: entry.count <= max, remaining, resetIn };
}

// Generous baseline limits per IP per minute.
// Route handlers can enforce stricter per-user limits on top.
const RL_TIERS = {
  gate:       5,   // brute force targets (phone auth, access gate, validate-user)
  ai:         8,   // AI generation (expensive LLM calls)
  analytics: 15,   // heavy aggregation queries
  download:  15,   // file downloads / exports
  wallet:    10,   // on-chain / wallet operations
  trade:     20,   // trade operations
  admin:     30,   // admin & system routes (auth-gated anyway)
  message:   40,   // messaging / conversations
  write:     40,   // general write operations (POST/PUT/PATCH/DELETE)
  social:    60,   // social interactions (like, follow, repost)
  external:  60,   // external API proxies (Bring, geocode, etc.)
  read:     120,   // general read operations (GET)
} as const;

const RL_GLOBAL_MAX = 300;   // total API requests per IP per minute
const RL_WINDOW_MS = 60_000; // 1 minute rolling window

type RLTier = keyof typeof RL_TIERS;

/** Classify a route into a rate-limit tier, or null to skip. */
function _rlClassify(pathname: string, method: string): RLTier | null {
  // ── Skip: infrastructure routes that must never be rate-limited ──
  if (pathname.startsWith("/api/auth/"))      return null; // NextAuth callbacks
  if (pathname.startsWith("/api/webhooks/"))   return null; // external webhook delivery
  if (pathname.startsWith("/api/cron/"))       return null; // Vercel cron jobs
  if (pathname.startsWith("/api/edgestore/"))  return null; // EdgeStore SDK
  if (pathname === "/api/health")              return null;
  if (pathname === "/api/version")             return null;
  if (pathname === "/api/_perf/prisma")        return null;

  // ── Strict tiers (highest abuse risk) ──
  if (
    pathname.startsWith("/api/auth/phone/") ||
    pathname === "/api/validate-user" ||
    pathname === "/api/access-gate"
  )
    return "gate";

  if (pathname.startsWith("/api/polls/generate")) return "ai";

  // ── Financial tiers ──
  if (pathname.startsWith("/api/wallets/")) return "wallet";
  if (pathname.startsWith("/api/trades/"))  return "trade";

  // ── Admin / analytics ──
  if (pathname.startsWith("/api/admin/") || pathname.startsWith("/api/system/"))
    return "admin";
  if (pathname.startsWith("/api/analytics/") || pathname.includes("/analytics"))
    return "analytics";

  // ── External service proxies ──
  if (
    pathname.startsWith("/api/bring-") ||
    pathname.startsWith("/api/geocode/") ||
    pathname.startsWith("/api/currency-") ||
    pathname.startsWith("/api/youtube/")
  )
    return "external";

  // ── Downloads / exports ──
  if (pathname.startsWith("/api/download/") || pathname.includes("/export"))
    return "download";

  // ── Messaging & conversations ──
  if (pathname.startsWith("/api/messages/") || pathname.startsWith("/api/conversations/"))
    return "message";

  // ── Social actions ──
  if (
    pathname === "/api/interact" ||
    pathname.startsWith("/api/friend-requests") ||
    pathname.startsWith("/api/reach-feedback") ||
    pathname.includes("/follow") ||
    pathname.includes("/pulse") ||
    pathname.includes("/repost")
  )
    return "social";

  // ── Fallback by HTTP method ──
  if (method !== "GET") return "write";
  return "read";
}

function _getClientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function _rl429(max: number, resetIn: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests", retryAfter: resetIn },
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(resetIn),
        "X-RateLimit-Limit": String(max),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(resetIn),
      },
    }
  );
}

/** Check rate limits for an API request. Returns a 429 Response or null. */
function checkApiRateLimit(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/api")) return null;

  const ip = _getClientIp(req);

  // Layer 1: Global per-IP cap across ALL API routes
  const global = _rlCheck(`g:${ip}`, RL_GLOBAL_MAX, RL_WINDOW_MS);
  if (!global.ok) return _rl429(RL_GLOBAL_MAX, global.resetIn);

  // Layer 2: Per-tier per-IP cap
  const tier = _rlClassify(pathname, req.method);
  if (!tier) return null;

  const max = RL_TIERS[tier];
  const result = _rlCheck(`t:${tier}:${ip}`, max, RL_WINDOW_MS);
  if (!result.ok) return _rl429(max, result.resetIn);

  return null;
}

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

  // ─── BYPASS CHECKS FIRST (before any blocking) ───

  // Never gate NextAuth/Auth.js endpoints. OAuth redirects and callbacks rely on these.
  if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) {
    return null;
  }

  // Skip gate for bypass routes (legal pages, gate itself, access-gate API)
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

  // ─── NOW CHECK AUTHENTICATION ───

  // Check for access cookie
  const accessCookie = req.cookies.get(COOKIE_NAME);
  const isAuthenticated = accessCookie?.value === COOKIE_VALUE;

  if (isAuthenticated) {
    return null; // Authenticated - allow through
  }

  // Not authenticated - handle based on route type
  // API routes get JSON 401, HTML routes get redirected to gate
  if (pathname.startsWith('/api') || pathname.startsWith('/trpc')) {
    return NextResponse.json(
      { error: 'Access Gate: authentication required' },
      { status: 401 }
    );
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

  // ─── API RATE LIMIT CHECK ───
  const rlResponse = checkApiRateLimit(req);
  if (rlResponse) {
    return applySecurityHeaders(rlResponse, requestId, nonce, pathname);
  }

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
      // Keep logged-in users on the verification flow if OAuth linking fails.
      // Without this, /auth/error gets bounced to DEFAULT_LOGIN_REDIRECT (/nexus).
      if (pathname === "/auth/error") {
        const oauthError = nextUrl.searchParams.get("error") || "OAuthCallbackError";
        return applySecurityHeaders(
          NextResponse.redirect(
            new URL(`/settings?section=verification&oauthError=${encodeURIComponent(oauthError)}`, nextUrl)
          ),
          requestId,
          nonce,
          pathname
        );
      }

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
