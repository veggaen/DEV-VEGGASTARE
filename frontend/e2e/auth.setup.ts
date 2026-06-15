import { test as setup } from "@playwright/test";

/**
 * @fileOverview  Playwright auth setup — logs in once and saves the session
 *                cookie to e2e/.auth/user.json so authenticated tests reuse it.
 *                Depends on the "gate" project which provides the gate cookie.
 *
 * Requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD env vars (or .env.local).
 * Create a test account in your local DB before running:
 *   npx prisma db seed   (or manually via Prisma Studio)
 *
 * @stability stable
 */

const AUTH_FILE = "./e2e/.auth/user.json";

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    console.warn(
      "[auth.setup] E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set — " +
        "skipping auth setup. Authenticated tests will be skipped at runtime.",
    );
    // Create an empty storage state so Playwright doesn't crash
    await page.goto("/");
    await page.context().storageState({ path: AUTH_FILE });
    return;
  }

  // Navigate to login page (gate cookie is already set via storageState from "gate" project)
  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  // Fill in the login form (shadcn FormControl wraps inputs in a <div>,
  // so getByLabel doesn't work — use placeholder/type selectors instead)
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.locator('input[type="password"]').fill(password);

  // Submit
  await page.getByRole("button", { name: /sign in|log in|continue/i }).click();

  // Wait for redirect to authenticated area (products page or dashboard)
  await page.waitForURL(/\/(products|dashboard|feed)/, { timeout: 30_000 });

  // Save signed-in state (includes both gate + auth cookies)
  await page.context().storageState({ path: AUTH_FILE });
});
