/** @fileOverview Unit-test resolution mirrors the application's TypeScript aliases. @stability stable */
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  // Deployment scripts use node:test and run separately from the Vitest suites.
  test: { exclude: ['**/node_modules/**', '**/.next*/**', '**/e2e/**', '**/%SystemDrive%/**', 'scripts/*.test.mjs'] },
});
