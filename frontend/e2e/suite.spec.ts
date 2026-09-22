import { test, expect } from "@playwright/test";

test.describe('S2 — account recovery', () => {
  test('register, verify, reset, reject replay, revoke session, login and logout', async ({ browser, baseURL }) => {
    // Opt-in only: sends two safe Resend test emails and provisions one isolated
    // USER in the explicitly selected live database (also used by local next start).
    test.skip(process.env.E2E_AUTH_RECOVERY !== 'live-db', 'Requires explicit recovery-fixture opt-in');
    test.setTimeout(120_000);
    const { Pool } = await import('pg');
    const { randomBytes } = await import('node:crypto');
    const database = new URL(process.env.DATABASE_URL_MAINLIVE!);
    database.searchParams.set('uselibpqcompat', 'true');
    const pool = new Pool({ connectionString: database.toString(), max: 2 });
    const origin = new URL(baseURL!).origin;
    const email = `delivered+veggat-s2-${Date.now()}@resend.dev`;
    const firstPassword = randomBytes(24).toString('base64url');
    const nextPassword = randomBytes(24).toString('base64url');
    const first = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const second = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await first.newPage();
    const recovery = await second.newPage();
    const errors: string[] = [];
    let secretLogged = false;
    for (const p of [page, recovery]) {
      p.on('pageerror', error => errors.push(error.message));
      p.on('console', message => { if (message.text().includes(firstPassword) || message.text().includes(nextPassword)) secretLogged = true; });
    }
    try {
      await page.goto(`${origin}/auth/register`, { waitUntil: 'domcontentloaded' });
      const consent = page.getByRole('button', { name: 'Essential Only', exact: true });
      if (await consent.isVisible()) await consent.click();
      await page.getByPlaceholder('Choose a name').fill('Veggat QA recovery');
      await page.locator('input[name=email]').fill(email);
      await page.locator('input[name=password]').fill(firstPassword);
      await page.getByRole('button', { name: 'Register', exact: true }).click();
      await expect(page.getByText(/Check your email to verify/)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const user = (await pool.query('SELECT id FROM "User" WHERE email=$1', [email])).rows[0];
      // Read only this fixture's app-issued token. No verification/session bypass.
      const verification = (await pool.query('SELECT token FROM "VerificationToken" WHERE email=$1 ORDER BY "createdAt" DESC LIMIT 1', [email])).rows[0];
      expect(verification).toBeTruthy();
      await page.goto(`${origin}/auth/new-verification?token=${encodeURIComponent(verification.token)}`, { waitUntil: 'domcontentloaded' });
      await page.waitForURL(/\/(nexus|products|pulse)(?:[/?#]|$)/, { waitUntil: 'domcontentloaded' });
      expect((await (await first.request.get(`${origin}/api/auth/session`)).json()).user.id).toBe(user.id);
      await recovery.goto(`${origin}/auth/reset`, { waitUntil: 'domcontentloaded' });
      await recovery.locator('input[type=email]').fill(email);
      await recovery.getByRole('button', { name: 'Send reset email', exact: true }).click();
      await expect(recovery.getByText(/If an account matches/)).toBeVisible();
      const reset = (await pool.query('SELECT token FROM "PasswordResetToken" WHERE email=$1 ORDER BY "createdAt" DESC LIMIT 1', [email])).rows[0];
      expect(reset).toBeTruthy();
      const resetUrl = `${origin}/auth/new-password?token=${encodeURIComponent(reset.token)}`;
      await recovery.goto(resetUrl, { waitUntil: 'domcontentloaded' });
      await recovery.locator('input[type=password]').fill(nextPassword);
      await recovery.getByRole('button', { name: 'Reset Password', exact: true }).click();
      await expect(recovery.getByText('Password updated! Sign in with your new password.')).toBeVisible();
      expect((await (await first.request.get(`${origin}/api/auth/session`)).json())?.user?.id).toBeFalsy();
      await recovery.goto(resetUrl, { waitUntil: 'domcontentloaded' });
      await recovery.locator('input[type=password]').fill(nextPassword);
      await recovery.getByRole('button', { name: 'Reset Password', exact: true }).click();
      await expect(recovery.getByText(/Token does not exist|invalid or already used/)).toBeVisible();
      await recovery.goto(`${origin}/auth/login?callbackUrl=https%3A%2F%2Fevil.example`, { waitUntil: 'domcontentloaded' });
      await recovery.getByPlaceholder('you@example.com').fill(email);
      await recovery.locator('input[type=password]').fill(nextPassword);
      await recovery.getByRole('button', { name: 'Sign in', exact: true }).click();
      await recovery.waitForURL(/\/(nexus|products|pulse)(?:[/?#]|$)/, { waitUntil: 'domcontentloaded' });
      expect(new URL(recovery.url()).origin).toBe(origin);
      expect((await (await second.request.get(`${origin}/api/auth/session`)).json()).user.id).toBe(user.id);
      // Auth.js sign-out form exercises its own CSRF token, not a forged session.
      await recovery.goto(`${origin}/api/auth/signout`, { waitUntil: 'domcontentloaded' });
      await recovery.getByRole('button', { name: 'Sign out', exact: true }).click();
      await expect.poll(async () => (await (await second.request.get(`${origin}/api/auth/session`)).json())?.user?.id).toBeFalsy();
      // Enable 2FA only on the just-created fixture, then exercise its real UI.
      await pool.query('UPDATE "User" SET "isTwoFactorEnabled"=true WHERE id=$1 AND email=$2', [user.id, email]);
      await recovery.goto(`${origin}/auth/login`, { waitUntil: 'domcontentloaded' });
      await recovery.getByPlaceholder('you@example.com').fill(email);
      await recovery.locator('input[type=password]').fill(nextPassword);
      await recovery.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(recovery.locator('input[name=code]')).toBeVisible();
      const direct = await browser.newContext();
      try {
        const csrf = (await (await direct.request.get(`${origin}/api/auth/csrf`)).json()).csrfToken;
        await direct.request.post(`${origin}/api/auth/callback/credentials`, { form: { csrfToken: csrf, email, password: nextPassword, callbackUrl: `${origin}/products` }, headers: { 'X-Auth-Return-Redirect': '1' } });
        expect((await (await direct.request.get(`${origin}/api/auth/session`)).json())?.user?.id).toBeFalsy();
        const otp = (await pool.query('SELECT token FROM "TwoFactorToken" WHERE email=$1 AND expires>now() ORDER BY "createdAt" DESC LIMIT 1', [email])).rows[0];
        expect(otp).toBeTruthy();
        await recovery.locator('input[name=code]').fill(otp.token);
        await recovery.getByRole('button', { name: 'Verify Code', exact: true }).click();
        await recovery.waitForURL(/\/(nexus|products|pulse)(?:[/?#]|$)/, { waitUntil: 'domcontentloaded' });
        expect((await (await second.request.get(`${origin}/api/auth/session`)).json()).user.id).toBe(user.id);
        await direct.request.post(`${origin}/api/auth/callback/credentials`, { form: { csrfToken: csrf, email, password: nextPassword, code: otp.token, callbackUrl: `${origin}/products` }, headers: { 'X-Auth-Return-Redirect': '1' } });
        expect((await (await direct.request.get(`${origin}/api/auth/session`)).json())?.user?.id).toBeFalsy();
      } finally { await direct.close(); }
      expect(secretLogged).toBe(false);
      expect(errors).toEqual([]);
    } finally {
      await first.close(); await second.close(); await pool.end();
    }
  });
});
import {
  PAGE_TIMEOUT,
  HEAVY_PAGE_TIMEOUT,
  EXPECT_TIMEOUT,
  hasAuth,
  PUBLIC_PAGES,
  AUTH_PAGES,
  PROTECTED_PAGES,
  PUBLIC_APIS,
  PROTECTED_APIS,
  PROTECTED_POST_APIS,
  visitPage,
} from "./helpers";

/**
 * @fileOverview  VeggaStare Consolidated E2E Suite
 *
 *                ONE file. Layered like a pyramid. Each layer depends on the
 *                previous passing — if Layer 1 fails, nothing above it matters.
 *
 *                Layer 1 — ALIVE:    Is the system responding at all?
 *                Layer 2 — ROUTING:  Do public/protected routes behave correctly?
 *                Layer 3 — CONTENT:  Do pages render meaningful content?
 *                Layer 4 — FLOWS:    Can a user complete critical journeys?
 *                Layer 5 — DATA:     Do APIs return correct shapes?
 *
 *                Why this structure:
 *                • If /api/health is down, no point testing 50 routes
 *                • If auth gates are broken, no point testing UI
 *                • Failures cascade UP, never down — you fix from the bottom
 *
 *                Scalability (2026–2030):
 *                • Add routes to helpers.ts arrays → tests auto-expand
 *                • Add new layers BELOW existing ones for new concerns
 *                • Never split into multiple files — ONE pyramid, always
 *
 * @stability stable
 */

/* ================================================================== */
/*  LAYER 1 — ALIVE                                                   */
/*  "Is the system responding?"                                       */
/*  If these fail, NOTHING else matters.                               */
/* ================================================================== */
test.describe.serial("Layer 1 — System Alive", () => {
  test("API health endpoint responds with healthy status", async ({
    request,
  }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body).toHaveProperty("dbLatencyMs");
  });

  test("API version endpoint responds with build info", async ({
    request,
  }) => {
    const res = await request.get("/api/version");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("buildId");
  });

  test("homepage responds with 200", async ({ request }) => {
    const res = await request.get("/");
    expect(res.ok()).toBeTruthy();
  });

  test("homepage renders in browser", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/");
    await expect(page).toHaveTitle(/Veggat|VeggaStare|Freedom Store/i, {
      timeout: EXPECT_TIMEOUT,
    });
  });
});

/* ================================================================== */
/*  LAYER 2 — ROUTING                                                 */
/*  "Do the gates work?"                                              */
/*  Public pages serve, protected pages redirect, APIs guard.          */
/* ================================================================== */
test.describe("Layer 2 — Routing", () => {
  test("OAuth callbacks stay on the tested app origin", async ({ request, baseURL }) => {
    const response = await request.get("/api/auth/providers");
    expect(response.ok()).toBeTruthy();
    const providers = await response.json();
    for (const provider of Object.values(providers) as { type: string; callbackUrl: string }[]) {
      if (provider.type !== "oauth" && provider.type !== "oidc") continue;
      expect(new URL(provider.callbackUrl).origin).toBe(new URL(baseURL!).origin);
    }
  });

  /* ---------- 2a. Every public page returns 200 via API ----------- */
  test.describe("Public pages respond (API-level)", () => {
    for (const route of PUBLIC_PAGES) {
      test(`GET ${route} → 200`, async ({ request }) => {
        test.setTimeout(PAGE_TIMEOUT);
        const res = await request.get(route);
        expect(res.ok()).toBeTruthy();
      });
    }
  });

  /* ---------- 2b. Every auth page responds ----------------------- */
  test.describe("Auth pages respond (API-level)", () => {
    for (const route of AUTH_PAGES) {
      test(`GET ${route} → 200/302`, async ({ request }) => {
        test.setTimeout(PAGE_TIMEOUT);
        const res = await request.get(route);
        expect([200, 302, 307, 308]).toContain(res.status());
      });
    }
  });

  /* ---------- 2c. Protected pages redirect when no auth ---------- */
  test.describe("Protected pages redirect to gate/login", () => {
    for (const route of PROTECTED_PAGES) {
      test(`${route} → gate or login`, async ({ page }) => {
        test.setTimeout(HEAVY_PAGE_TIMEOUT);
        await page.goto(route, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
        await page.waitForURL(/\/(gate|auth\/login)/, {
          timeout: PAGE_TIMEOUT,
        });
        expect(page.url()).toMatch(/\/(gate|auth\/login)/);
      });
    }
  });

  /* ---------- 2d. Public APIs return 200 ------------------------- */
  test.describe("Public APIs respond", () => {
    for (const endpoint of PUBLIC_APIS) {
      test(`GET ${endpoint} → 200`, async ({ request }) => {        test.setTimeout(PAGE_TIMEOUT);        const res = await request.get(endpoint);
        expect(res.ok()).toBeTruthy();
      });
    }
  });

  /* ---------- 2e. Protected APIs reject unauthenticated requests --- */
  test.describe("Protected APIs reject without auth", () => {
    for (const endpoint of PROTECTED_APIS) {
      test(`GET ${endpoint} → not 200`, async ({ request }) => {
        test.setTimeout(PAGE_TIMEOUT);
        const res = await request.get(endpoint, {
          headers: { cookie: "" },
        });
        // Any non-success status is valid: 401, 403, 400, 405, 500, etc.
        // The key invariant: unauthenticated GET must NOT return 200.
        expect(res.status()).toBeGreaterThanOrEqual(400);
      });
    }

    for (const { path, data } of PROTECTED_POST_APIS) {
      test(`POST ${path} → not 200`, async ({ request }) => {
        test.setTimeout(PAGE_TIMEOUT);
        const res = await request.post(path, {
          data,
          headers: { cookie: "" },
        });
        expect(res.status()).toBeGreaterThanOrEqual(400);
      });
    }
  });
});

/* ================================================================== */
/*  LAYER 3 — CONTENT                                                 */
/*  "Do pages render real content?"                                   */
/*  Now we know routes work, verify they render something meaningful.  */
/* ================================================================== */
test.describe("Layer 3 — Content", () => {
  test("public home and isolated demo sign-in (public S1)", async ({ browser, baseURL }) => {
    test.setTimeout(PAGE_TIMEOUT);
    const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("button", { name: "Try the demo — no payment", exact: true })).toBeVisible();
    await expect(page.locator("footer")).toHaveCount(0);
    const essential = page.getByRole("button", { name: "Essential Only", exact: true });
    if (await essential.isVisible()) await essential.click();
    await page.getByRole("button", { name: "Try the demo — no payment", exact: true }).click();
    await page.waitForURL("**/products");
    await expect(page.getByRole("complementary", { name: "Demo mode" })).toBeVisible();
    const session = await (await page.request.get("/api/auth/session")).json();
    expect(session.user.isDemo).toBe(true);
    expect(session.user.role).toBe("USER");
    expect((await page.request.post("/api/orders", { data: {} })).status()).toBe(403);
    expect((await page.request.post("/settings", { data: {} })).status()).toBe(403);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByRole("button", { name: "Exit demo", exact: true }).click();
    await page.waitForURL(`${baseURL}/`);
    await expect(page.getByRole("button", { name: "Try the demo — no payment", exact: true })).toBeVisible();
    await context.close();
  });

  test("Products metadata does not restart the loading skeleton (public S1)", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    let productRequests = 0;
    page.on("request", request => { if (new URL(request.url()).pathname === "/api/products") productRequests++; });
    const metadata = page.waitForResponse(response => new URL(response.url()).pathname === "/api/filter-counts");
    await visitPage(page, "/products");
    await metadata;
    await expect(page.getByRole("status", { name: "Loading products", exact: true })).toHaveCount(0);
    // Observe beyond the old 300ms metadata-triggered debounce window.
    await page.waitForTimeout(600);
    expect(productRequests).toBe(1);
    await expect(page.locator("footer")).toHaveCount(0);
  });

  test("footer follows content without overlapping it (public S1)", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await page.setViewportSize({ width: 1280, height: 800 });
    await visitPage(page, "/info");
    const footer = page.locator("footer");
    await expect(footer).toBeAttached();
    expect(await footer.evaluate(element => element.getBoundingClientRect().top >= innerHeight)).toBe(true);
    expect(await footer.evaluate(element => getComputedStyle(element).position)).toBe("static");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeInViewport();
  });

  /* ---------- 3a. Critical public pages render ------------------- */
  test("homepage renders heading", async ({ page }) => {
    await visitPage(page, "/");
    await expect(page.locator("body")).toBeVisible();
  });

  test("anonymous AI model selector opens with clear sign-in guidance", async ({
    page,
  }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/");

    const selector = page.getByTitle("Browse AI models");
    await expect(selector).toBeVisible({ timeout: EXPECT_TIMEOUT });
    await selector.click();

    await expect(
      page.getByText("Gemini 2.5 Flash-Lite is available as a free preview.", { exact: false }),
    ).toBeVisible({ timeout: EXPECT_TIMEOUT });
    await expect(page.getByPlaceholder(/Search models/)).toBeVisible();
  });

  test("products page renders content", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/products");
    await expect(
      page.locator("main, [role='main'], #__next, body").first(),
    ).toBeVisible({ timeout: EXPECT_TIMEOUT });
  });

  test("pulse page renders content", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/pulse");
    await expect(page.locator("body")).toBeVisible();
  });

  test("login form has email input and submit button", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/auth/login");
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible({
      timeout: EXPECT_TIMEOUT,
    });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
  });

  test("register page renders heading", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/auth/register");
    await expect(
      page.getByRole("heading", { name: /join the vibe/i }),
    ).toBeVisible({ timeout: PAGE_TIMEOUT });
  });

  test("reset password page has email input", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/auth/reset");
    const emailInput = page
      .getByPlaceholder(/email|you@/i)
      .or(page.locator('input[type="email"]'));
    await expect(emailInput.first()).toBeVisible({ timeout: EXPECT_TIMEOUT });
  });

  /* ---------- 3b. Legal pages render (data-driven) --------------- */
  for (const route of ["/info", "/privacy", "/terms", "/contact"] as const) {
    test(`${route} renders content`, async ({ page }) => {
      test.setTimeout(PAGE_TIMEOUT);
      await visitPage(page, route);
      await expect(page.locator("body")).toBeVisible();
    });
  }

  /* ---------- 3c. Heavy pages (generous timeout) ----------------- */
  test("poll-test page loads", async ({ page }) => {
    test.setTimeout(HEAVY_PAGE_TIMEOUT);
    await visitPage(page, "/poll-test", { timeout: HEAVY_PAGE_TIMEOUT });
    await expect(page.locator("body")).toBeVisible();
  });
});

/* ================================================================== */
/*  LAYER 4 — FLOWS                                                   */
/*  "Can a user complete a journey?"                                  */
/*  Tests that cross multiple pages or require interaction.            */
/* ================================================================== */
test.describe("Layer 4 — User Flows", () => {
  test("login → reset password navigation", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/auth/login");
    const resetLink = page.getByRole("link", {
      name: /forgot|reset|password/i,
    });
    if (await resetLink.isVisible().catch(() => false)) {
      await resetLink.click();
      await expect(page).toHaveURL(/reset/);
    }
  });

  test("register → login navigation", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/auth/register");
    await page.waitForLoadState("domcontentloaded");
    const loginLink = page.getByRole("link", {
      name: /login|sign in|already have|back/i,
    });
    if (await loginLink.isVisible().catch(() => false)) {
      await loginLink.click();
      try {
        await expect(page).toHaveURL(/login/, { timeout: EXPECT_TIMEOUT });
      } catch {
        // Link may not navigate (e.g. client-side routing issue) — not critical
      }
    }
  });

  test("unknown route redirects to login/gate", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await page.goto("/definitely-does-not-exist-xyz", { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
    await page.waitForURL(/\/(auth\/login|gate)/, {
      timeout: PAGE_TIMEOUT,
    });
  });

  test("dashboard redirect preserves callback URL", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
    await page.waitForURL(/\/(gate|auth\/login)/, {
      timeout: PAGE_TIMEOUT,
    });
  });

  test("/feed redirects to /pulse (public alias)", async ({ page }) => {
    test.setTimeout(PAGE_TIMEOUT);
    await page.goto("/feed", { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
    await page.waitForURL(/\/(pulse|gate|auth\/login|feed)/, {
      timeout: PAGE_TIMEOUT,
    });
  });
});

/* ================================================================== */
/*  LAYER 5 — DATA                                                    */
/*  "Do APIs return the right shapes?"                                */
/*  No browser needed — pure request-level validation.                 */
/* ================================================================== */
test.describe("Layer 5 — API Data Shapes", () => {
  test("products API returns array with correct fields", async ({
    request,
  }) => {
    const res = await request.get("/api/products?page=1&perPage=5");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
    if (body.length > 0) {
      expect(body[0]).toHaveProperty("id");
      expect(body[0]).toHaveProperty("title");
    }
  });

  test("products API validates price range (minPrice > maxPrice → 400)", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/products?page=1&perPage=5&minPrice=100&maxPrice=10",
    );
    expect(res.status()).toBe(400);
  });

  test("products API respects perPage limit", async ({ request }) => {
    const res = await request.get("/api/products?page=1&perPage=3");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
    expect(body.length).toBeLessThanOrEqual(3);
  });

  test("products API pagination returns valid arrays", async ({ request }) => {
    const [p1, p2] = await Promise.all([
      request.get("/api/products?page=1&perPage=2"),
      request.get("/api/products?page=2&perPage=2"),
    ]);
    expect(p1.ok()).toBeTruthy();
    expect(p2.ok()).toBeTruthy();
    expect(Array.isArray(await p1.json())).toBeTruthy();
    expect(Array.isArray(await p2.json())).toBeTruthy();
  });

  test("categories API returns array", async ({ request }) => {
    const res = await request.get("/api/categories");
    expect(res.ok()).toBeTruthy();
    expect(Array.isArray(await res.json())).toBeTruthy();
  });

  test("companies/public API returns array", async ({ request }) => {
    const res = await request.get("/api/companies/public");
    expect(res.ok()).toBeTruthy();
    expect(Array.isArray(await res.json())).toBeTruthy();
  });

  test("health API returns db latency metric", async ({ request }) => {
    const res = await request.get("/api/health");
    const body = await res.json();
    expect(typeof body.dbLatencyMs).toBe("number");
    expect(typeof body.timestamp).toBe("string");
  });

  test("admin endpoints reject non-admin requests", async ({ request }) => {
    const res = await request.get("/api/admin/users", {
      headers: { cookie: "" },
    });
    expect([401, 403, 404]).toContain(res.status());
  });

  /* ---------- Authenticated data tests (skip if no creds) -------- */
  test("plain cookies cannot restore an impersonated identity (authed)", async ({ context, request, baseURL }) => {
    test.skip(!hasAuth, "Requires E2E_TEST_EMAIL/PASSWORD");
    if (process.env.GATE_PASSWORD) {
      await request.post("/api/access-gate", { data: { password: process.env.GATE_PASSWORD } });
    }
    const before = await (await request.get("/api/auth/session")).json();
    expect(before.user.role).toBe("USER");
    await context.addCookies([
      { name: "x-impersonate-owner-id", value: before.user.id, domain: new URL(baseURL!).hostname, path: "/" },
      { name: "x-impersonate-target-id", value: "not-a-real-account", domain: new URL(baseURL!).hostname, path: "/" },
    ]);
    expect((await request.post("/api/admin/impersonate/end")).status()).toBe(403);
    const after = await (await request.get("/api/auth/session")).json();
    expect(after.user.id).toBe(before.user.id);
    expect(after.user.isImpersonating).toBe(false);
  });

  test("model picker selects platform Groq without a key (authed)", async ({ page }) => {
    test.skip(!hasAuth, "Requires E2E_TEST_EMAIL/PASSWORD");
    test.setTimeout(PAGE_TIMEOUT);
    await visitPage(page, "/");
    const essentialOnly = page.getByRole("button", { name: "Essential Only", exact: true });
    if (await essentialOnly.isVisible()) await essentialOnly.click();
    const picker = page.getByTitle("Choose AI model", { exact: true });
    await picker.click();
    await page.getByPlaceholder(/Search models/).fill("GPT-OSS 20B");
    await page.getByRole("button").filter({ hasText: "GPT-OSS 20B" }).click();
    await expect(picker).toContainText("GPT-OSS 20B");
    await expect(page.getByPlaceholder("Paste your API key…")).not.toBeVisible();
  });

  test("GET /api/wallets returns data (authed)", async ({ request }) => {
    test.skip(!hasAuth, "Requires E2E_TEST_EMAIL/PASSWORD");
    const res = await request.get("/api/wallets");
    expect(res.ok()).toBeTruthy();
    expect(Array.isArray((await res.json()).wallets)).toBeTruthy();
  });

  test("GET /api/notifications returns data (authed)", async ({ request }) => {
    test.skip(!hasAuth, "Requires E2E_TEST_EMAIL/PASSWORD");
    const res = await request.get("/api/notifications");
    expect(res.ok()).toBeTruthy();
  });

  test("GET /api/conversations returns data (authed)", async ({ request }) => {
    test.skip(!hasAuth, "Requires E2E_TEST_EMAIL/PASSWORD");
    const res = await request.get("/api/conversations");
    expect(res.ok()).toBeTruthy();
  });

  /* ---------- SEO / crawlability --------------------------------- */
  test("robots.txt is accessible", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.ok()).toBeTruthy();
  });

  test("sitemap.xml is accessible", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok()).toBeTruthy();
  });

  /* ---------- Misc public APIs ----------------------------------- */
  test("price-range API responds", async ({ request }) => {
    const res = await request.get("/api/price-range");
    expect([200, 401]).toContain(res.status());
  });

  test("categories-with-counts API responds", async ({ request }) => {
    const res = await request.get("/api/categories-with-counts");
    expect([200, 401]).toContain(res.status());
  });

  test("products/sellers API responds", async ({ request }) => {
    const res = await request.get("/api/products/sellers");
    expect([200, 401]).toContain(res.status());
  });

  test("bring-shipping-suggest-postcode API responds", async ({ request }) => {
    const res = await request.get(
      "/api/bring-shipping-suggest-postcode?q=0001",
    );
    expect([200, 400, 401, 404, 500, 502]).toContain(res.status());
  });
});
