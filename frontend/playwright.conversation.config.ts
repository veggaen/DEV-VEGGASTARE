import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'conversation-recovery.spec.ts', workers: 1, retries: 0,
  use: { baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000', headless: true },
});
