import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * @fileOverview  Playwright E2E test configuration for VeggaStare frontend.
 *
 *                Architecture (2026–2030):
 *                ─────────────────────────
 *                2 infrastructure files:  gate-bypass.ts, auth.setup.ts
 *                1 consolidated suite:    suite.spec.ts  (all app tests)
 *                1 meta-test:             master.spec.ts (tests the tests)
 *
 *                Projects:
 *                  gate    → bypass site access gate
 *                  setup   → log in and save session (depends on gate)
 *                  no-auth → suite.spec.ts + master.spec.ts (no login needed)
 *                  authed  → suite.spec.ts (with saved auth session)
 *
 *                Config goals:
 *                  • Absolute storageState paths (no CWD drift)
 *                  • data-testid as the default test selector
 *                  • Explicit testMatch + testIgnore (no accidental pickup)
 *                  • JSON reporter for CI tooling / AI parsing
 *                  • Predictable snapshot paths via snapshotPathTemplate
 *                  • actionTimeout + navigationTimeout to fail stuck actions fast
 *                  • Full trace on CI for better debugging artifacts
 *
 * @stability stable
 */

/* ── Absolute paths — immune to CWD drift ─────────────────────── */
const AUTH_FILE = path.resolve(__dirname, "e2e/.auth/user.json");
const GATE_FILE = path.resolve(__dirname, "e2e/.auth/gate.json");

const HAS_AUTH_CREDS = !!(
  process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD
);
const IS_CI = !!process.env.CI;

/* ── Shared device — set once, used by all browser projects ──── */
const DESKTOP_CHROME = devices["Desktop Chrome"];

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  snapshotPathTemplate:
    "{testDir}/__snapshots__/{projectName}/{testFilePath}/{arg}{ext}",

  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 1,
  workers: 1, /* AI layers are stateful; 1 worker prevents dev-server overload */

  /* ── Timeouts ──────────────────────────────────────────────── */
  timeout: 90_000, /* Global test timeout — generous for dev-mode compilation */
  expect: { timeout: 15_000 },

  /* ── Reporters ─────────────────────────────────────────────── */
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
    ...(IS_CI ? [] : [["list"] as const]),
  ],

  use: {
    /* Global device baseline */
    ...DESKTOP_CHROME,
    baseURL: "http://localhost:3000",

    /* Selectors: prefer data-testid for stable locators */
    testIdAttribute: "data-testid",

    /* Fail stuck actions/navigations faster than the 90s global timeout */
    actionTimeout: 30_000,
    navigationTimeout: 45_000,

    /* Debugging artifacts */
    trace: IS_CI ? "on" : "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    /* --- Gate bypass (runs first, no browser needed) --- */
    {
      name: "gate",
      testMatch: ["gate-bypass.ts"],
      testIgnore: ["*.spec.ts"],
    },

    /* --- Auth setup (needs gate cookie, no browser needed) --- */
    {
      name: "setup",
      testMatch: ["auth.setup.ts"],
      testIgnore: ["*.spec.ts"],
      use: { storageState: GATE_FILE },
      dependencies: ["gate"],
    },

    /* --- Unauthenticated: suite + master (gate cookie, no login) --- */
    {
      name: "no-auth",
      testMatch: ["suite.spec.ts", "master.spec.ts"],
      testIgnore: ["gate-bypass.ts", "auth.setup.ts"],
      use: { storageState: GATE_FILE },
      dependencies: ["gate"],
    },

    /* --- Authenticated: suite only (runs when E2E creds are set) --- */
    ...(HAS_AUTH_CREDS
      ? [
          {
            name: "authed",
            testMatch: ["suite.spec.ts"],
            testIgnore: [
              "master.spec.ts",
              "gate-bypass.ts",
              "auth.setup.ts",
            ],
            use: { storageState: AUTH_FILE },
            dependencies: ["setup"],
          },
        ]
      : []),
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !IS_CI,
    timeout: 120_000,
    env: {
      GATE_STATUS: "false",
    },
  },
});
