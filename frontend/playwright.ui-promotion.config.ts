import { defineConfig } from '@playwright/test';

/** Focused UI release checks; no OAuth automation or real payment/post writes. */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'ui-promotion.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
});
