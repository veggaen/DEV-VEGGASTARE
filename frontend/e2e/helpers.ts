/**
 * @fileOverview  Single source of truth for E2E test infrastructure.
 *
 *                Design philosophy (2026–2030):
 *                ─────────────────────────────
 *                Playwright tests USER BEHAVIOR, not implementation details.
 *                These helpers mirror the app's own route definitions so tests
 *                break when routes change — which is exactly what we want.
 *
 *                Anti-patterns we avoid:
 *                • Testing CSS classes or internal React state
 *                • Asserting on `innerText.length` (fragile, locale-dependent)
 *                • Using `networkidle` (never settles with SSE/WebSocket/streaming)
 *                • Writing 100 tiny tests — we use layered flows instead
 *
 *                Patterns we follow:
 *                • Data-driven route arrays (single source, loop over them)
 *                • `domcontentloaded` + explicit waitForFunction for hydration
 *                • Soft assertions (try/catch) for optional content
 *                • API-level checks for speed; browser checks only for UX
 *
 * @stability stable
 */

/* ================================================================== */
/*  1. TIMEOUTS                                                       */
/* ================================================================== */

/** First-visit page compilation in dev (Next.js JIT). */
export const PAGE_TIMEOUT = 60_000;

/** Heavy pages: poll-test, products with streaming, etc. */
export const HEAVY_PAGE_TIMEOUT = 120_000;

/** Expect timeout for element visibility after page load. */
export const EXPECT_TIMEOUT = 30_000;

// Legacy aliases — kept so gate-bypass.ts / auth.setup.ts don't break
export const COMPILE_TIMEOUT = PAGE_TIMEOUT;
export const REGISTER_TIMEOUT = 90_000;

/* ================================================================== */
/*  2. FEATURE FLAGS                                                  */
/* ================================================================== */

/** True when E2E login credentials are provided. */
export const hasAuth = !!(
  process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD
);

/* ================================================================== */
/*  3. ROUTE DEFINITIONS — mirrors frontend/routes.ts                 */
/*     If you change routes.ts, update HERE, and tests will catch it. */
/* ================================================================== */

/** Public page routes — accessible without authentication. */
export const PUBLIC_PAGES = [
  "/",
  "/products",
  "/pulse",
  "/poll-test",
  "/info",
  "/privacy",
  "/terms",
  "/contact",
] as const;

/** Auth-flow routes — redirect authenticated users away. */
export const AUTH_PAGES = [
  "/auth/login",
  "/auth/register",
  "/auth/error",
  "/auth/reset",
  "/auth/new-password",
] as const;

/** Protected page routes — must redirect unauthenticated users. */
export const PROTECTED_PAGES = [
  "/dashboard",
  "/dashboard/trading",
  "/dashboard/paper-trading",
  "/dashboard/inventory",
  "/dashboard/settings",
  "/ai",
  "/cart",
  "/checkout",
  "/profile",
] as const;

/** Public API endpoints — should return 200 without auth. */
export const PUBLIC_APIS = [
  "/api/health",
  "/api/version",
  "/api/products?page=1&perPage=5",
  "/api/categories",
  "/api/companies/public",
] as const;

/** Protected API endpoints — must return 401/403 without auth. */
export const PROTECTED_APIS = [
  "/api/notifications",
  "/api/users",
  "/api/friend-requests",
  "/api/my-downloads",
  "/api/seller/orders",
  "/api/returns",
] as const;

/** Protected POST routes — must reject without auth. */
export const PROTECTED_POST_APIS = [
  { path: "/api/companies/create", data: { name: "e2e-test" } },
  { path: "/api/polls/vote", data: { pollId: "fake", optionId: "fake" } },
  { path: "/api/trades/record", data: { mode: "PAPER" } },
  { path: "/api/orders/confirm", data: { orderId: "fake" } },
] as const;

// Legacy aliases — old spec files may still reference these
export const PUBLIC_PAGE_ROUTES = PUBLIC_PAGES;
export const AUTH_ROUTES = AUTH_PAGES;
export const PROTECTED_ROUTES = PROTECTED_PAGES;

/* ================================================================== */
/*  4. UTILITIES                                                      */
/* ================================================================== */

/**
 * Wait for the page body to have real content after dev-mode hydration.
 * Immune to the "empty shell" problem where Next.js dev mode serves HTML
 * before React hydrates.
 */
export async function waitForHydration(
  page: import("@playwright/test").Page,
  minChars = 5,
  timeout = EXPECT_TIMEOUT,
): Promise<void> {
  await page.waitForFunction(
    (min) => (document.body?.innerText?.length ?? 0) > min,
    minChars,
    { timeout },
  );
}

/**
 * Navigate to a page and wait for it to be usable.
 * This is THE way to visit pages — never use page.goto + networkidle directly.
 */
export async function visitPage(
  page: import("@playwright/test").Page,
  path: string,
  opts: { timeout?: number; waitForContent?: boolean } = {},
): Promise<void> {
  const timeout = opts.timeout ?? PAGE_TIMEOUT;
  await page.goto(path, { timeout, waitUntil: "domcontentloaded" });
  if (opts.waitForContent !== false) {
    try {
      await waitForHydration(page, 5, EXPECT_TIMEOUT);
    } catch {
      // Some pages (auth error, empty states) may have minimal content — OK
    }
  }
}
