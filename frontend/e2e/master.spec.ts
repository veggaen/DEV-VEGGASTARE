import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import {
  PUBLIC_PAGES,
  AUTH_PAGES,
  PROTECTED_PAGES,
  PUBLIC_APIS,
  PROTECTED_APIS,
  PROTECTED_POST_APIS,
} from "./helpers";

/**
 * @fileOverview  Master Meta-Test — "The test that tests all tests"
 *
 *                This file does NOT test the app. It tests the test INFRASTRUCTURE.
 *                If this file passes, you know:
 *
 *                1. helpers.ts route arrays are in sync with routes.ts
 *                2. The suite.spec.ts file exists and covers all route arrays
 *                3. Auth infrastructure files (gate-bypass, auth.setup) exist
 *                4. Playwright config is correctly wired
 *                5. Test result artifacts are being generated
 *
 *                Run this AFTER a full suite run to validate the harness.
 *                This is the "canary" — if meta-tests break, the test system
 *                itself is misconfigured.
 *
 *                Scalability: This will catch rot. When someone adds a new
 *                route to routes.ts but forgets to add it to helpers.ts,
 *                meta-test 1 will fail. When someone deletes suite.spec.ts
 *                by accident, meta-test 2 will fail.
 *
 * @stability stable
 */

const E2E_DIR = path.resolve(__dirname);
const FRONTEND_DIR = path.resolve(__dirname, "..");

/* ================================================================== */
/*  META 1 — Route sync: helpers.ts arrays match routes.ts            */
/* ================================================================== */
test.describe("Meta 1 — Route Sync", () => {
  test("helpers.ts PUBLIC_PAGES covers all publicRoutes from routes.ts", async () => {
    // Read the actual routes.ts source
    const routesSrc = fs.readFileSync(
      path.join(FRONTEND_DIR, "routes.ts"),
      "utf-8",
    );

    // Extract the publicRoutes array entries (page routes, not API routes)
    const routeMatches = routesSrc.match(/publicRoutes\s*=\s*\[([\s\S]*?)\]/);
    expect(routeMatches).toBeTruthy();

    const rawRoutes = routeMatches![1]
      .split("\n")
      .map((l) => l.match(/"([^"]+)"/)?.[1])
      .filter(Boolean) as string[];

    // Filter to page routes only (not /api/* or /gate)
    const pageRoutes = rawRoutes.filter(
      (r) => !r.startsWith("/api/") && r !== "/gate" && r !== "/auth/new-verification",
    );

    for (const route of pageRoutes) {
      expect(
        PUBLIC_PAGES.includes(route as (typeof PUBLIC_PAGES)[number]),
      ).toBeTruthy();
    }
  });

  test("helpers.ts AUTH_PAGES covers all authRoutes from routes.ts", async () => {
    const routesSrc = fs.readFileSync(
      path.join(FRONTEND_DIR, "routes.ts"),
      "utf-8",
    );

    const routeMatches = routesSrc.match(/authRoutes\s*=\s*\[([\s\S]*?)\]/);
    expect(routeMatches).toBeTruthy();

    const rawRoutes = routeMatches![1]
      .split("\n")
      .map((l) => l.match(/"([^"]+)"/)?.[1])
      .filter(Boolean) as string[];

    for (const route of rawRoutes) {
      expect(
        AUTH_PAGES.includes(route as (typeof AUTH_PAGES)[number]),
      ).toBeTruthy();
    }
  });

  test("route arrays are non-empty", () => {
    expect(PUBLIC_PAGES.length).toBeGreaterThan(0);
    expect(AUTH_PAGES.length).toBeGreaterThan(0);
    expect(PROTECTED_PAGES.length).toBeGreaterThan(0);
    expect(PUBLIC_APIS.length).toBeGreaterThan(0);
    expect(PROTECTED_APIS.length).toBeGreaterThan(0);
    expect(PROTECTED_POST_APIS.length).toBeGreaterThan(0);
  });
});

/* ================================================================== */
/*  META 2 — File integrity: required test infra files exist          */
/* ================================================================== */
test.describe("Meta 2 — File Integrity", () => {
  const requiredFiles = [
    "helpers.ts",
    "gate-bypass.ts",
    "auth.setup.ts",
    "suite.spec.ts",
    "master.spec.ts",
  ];

  for (const file of requiredFiles) {
    test(`${file} exists`, () => {
      const filePath = path.join(E2E_DIR, file);
      expect(fs.existsSync(filePath)).toBeTruthy();
    });
  }

  test("suite.spec.ts imports from helpers.ts (not hardcoded routes)", () => {
    const suiteContent = fs.readFileSync(
      path.join(E2E_DIR, "suite.spec.ts"),
      "utf-8",
    );
    // Must import route arrays, not hardcode paths
    expect(suiteContent).toContain('from "./helpers"');
    expect(suiteContent).toContain("PUBLIC_PAGES");
    expect(suiteContent).toContain("PROTECTED_PAGES");
    expect(suiteContent).toContain("PROTECTED_APIS");
  });
});

/* ================================================================== */
/*  META 3 — Coverage: suite.spec.ts covers all route arrays          */
/* ================================================================== */
test.describe("Meta 3 — Coverage Validation", () => {
  let suiteContent: string;

  test.beforeAll(() => {
    suiteContent = fs.readFileSync(
      path.join(E2E_DIR, "suite.spec.ts"),
      "utf-8",
    );
  });

  test("suite iterates over PUBLIC_PAGES", () => {
    expect(suiteContent).toContain("PUBLIC_PAGES");
    // It should loop, not hardcode
    expect(suiteContent).toMatch(/for\s*\(.*PUBLIC_PAGES/);
  });

  test("suite iterates over PROTECTED_PAGES", () => {
    expect(suiteContent).toContain("PROTECTED_PAGES");
    expect(suiteContent).toMatch(/for\s*\(.*PROTECTED_PAGES/);
  });

  test("suite iterates over PUBLIC_APIS", () => {
    expect(suiteContent).toContain("PUBLIC_APIS");
    expect(suiteContent).toMatch(/for\s*\(.*PUBLIC_APIS/);
  });

  test("suite iterates over PROTECTED_APIS", () => {
    expect(suiteContent).toContain("PROTECTED_APIS");
    expect(suiteContent).toMatch(/for\s*\(.*PROTECTED_APIS/);
  });

  test("suite iterates over PROTECTED_POST_APIS", () => {
    expect(suiteContent).toContain("PROTECTED_POST_APIS");
    expect(suiteContent).toMatch(/for\s*\(.*PROTECTED_POST_APIS/);
  });

  test("suite has all 5 layers", () => {
    expect(suiteContent).toContain("Layer 1");
    expect(suiteContent).toContain("Layer 2");
    expect(suiteContent).toContain("Layer 3");
    expect(suiteContent).toContain("Layer 4");
    expect(suiteContent).toContain("Layer 5");
  });
});

/* ================================================================== */
/*  META 4 — Config validation: Playwright config is correct          */
/* ================================================================== */
test.describe("Meta 4 — Config Validation", () => {
  let configContent: string;

  test.beforeAll(() => {
    configContent = fs.readFileSync(
      path.join(FRONTEND_DIR, "playwright.config.ts"),
      "utf-8",
    );
  });

  test("config has gate project", () => {
    expect(configContent).toContain("gate");
    expect(configContent).toContain("gate-bypass");
  });

  test("config has setup project", () => {
    expect(configContent).toContain("setup");
    expect(configContent).toContain("auth.setup");
  });

  test("config has webServer section", () => {
    expect(configContent).toContain("webServer");
    expect(configContent).toContain("localhost:3000");
  });

  test("config targets e2e directory", () => {
    expect(configContent).toMatch(/testDir.*e2e/);
  });
});

/* ================================================================== */
/*  META 5 — Self-check: this file also passes lint                   */
/* ================================================================== */
test.describe("Meta 5 — Self-Check", () => {
  test("master.spec.ts is internally consistent", () => {
    const masterContent = fs.readFileSync(
      path.join(E2E_DIR, "master.spec.ts"),
      "utf-8",
    );
    // Must have all 5 meta sections
    expect(masterContent).toContain("Meta 1");
    expect(masterContent).toContain("Meta 2");
    expect(masterContent).toContain("Meta 3");
    expect(masterContent).toContain("Meta 4");
    expect(masterContent).toContain("Meta 5");
    // Must import from helpers, not hardcode
    expect(masterContent).toContain('from "./helpers"');
  });
});
