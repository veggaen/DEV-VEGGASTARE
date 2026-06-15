import { test as setup } from "@playwright/test";

/**
 * @fileOverview  Gate setup — bypasses the site-wide access gate and saves
 *                storageState so all test projects can reuse the gate cookie.
 *
 *                For Playwright's own webServer, we also pass GATE_STATUS=false
 *                in Playwright config. This setup handles the case where
 *                a local dev server with the gate enabled is being reused.
 *
 * @stability stable
 */

export const GATE_FILE = "./e2e/.auth/gate.json";
const GATE_PASSWORD = process.env.GATE_PASSWORD ?? "MainAdc123";

setup("bypass access gate", async ({ page }) => {
  // Try loading the homepage and see if we get redirected to /gate
  await page.goto("/", { waitUntil: "commit", timeout: 60_000 });

  const url = page.url();
  if (!url.includes("/gate")) {
    // Gate not active — save current (empty) storageState and return
    console.log("[gate-setup] Gate not active — nothing to bypass.");
    await page.context().storageState({ path: GATE_FILE });
    return;
  }

  // Gate is active — submit the password via the API
  const response = await page.request.post("/api/access-gate", {
    data: { password: GATE_PASSWORD },
  });

  if (response.ok()) {
    console.log("[gate-setup] Access gate bypassed successfully.");
  } else {
    console.warn(
      `[gate-setup] Failed to bypass gate (status ${response.status()}). ` +
        "Set GATE_PASSWORD env var or GATE_STATUS=false.",
    );
  }

  // Save storageState with the gate cookie
  await page.context().storageState({ path: GATE_FILE });
});
