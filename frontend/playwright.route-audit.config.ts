import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: ['route-audit.spec.ts', 'conversation-create.spec.ts'],
  workers: 1, retries: 0, timeout: 90_000, expect: { timeout: 15_000 },
  outputDir: './test-results/route-audit',
  reporter: [['list'], ['json', { outputFile: './test-results/route-audit-results.json' }]],
  use: { baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000', trace: 'off', screenshot: 'only-on-failure' },
});
