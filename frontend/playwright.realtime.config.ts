import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'realtime-loading.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  use: { baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000', headless: true, trace: 'off' },
});
