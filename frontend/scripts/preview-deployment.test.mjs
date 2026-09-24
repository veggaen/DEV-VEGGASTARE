/** @fileOverview Preview deploy failures precede any migration or provider calls. @stability stable */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validatePreviewDeployment } from './preview-deployment.mjs';

const preview = { VERCEL: '1', VERCEL_ENV: 'preview', AUTH_URL: 'https://test-veggat.vercel.app' };
test('allows explicit Preview origin with either complete Sandbox configuration or payments disabled', () => {
  assert.doesNotThrow(() => validatePreviewDeployment(preview));
  assert.doesNotThrow(() => validatePreviewDeployment({ ...preview,
    PAYPAL_CLIENT_ID: 'test-client', PAYPAL_CLIENT_SECRET: 'test-secret', PAYPAL_WEBHOOK_ID: 'test-webhook' }));
});
test('rejects production, missing, local, credential-bearing and non-origin callback values without echoing them', () => {
  for (const AUTH_URL of ['', 'https://www.veggat.com', 'https://veggat.com', 'https://dev-veggastare.vercel.app',
    'https://dev-veggastare-v3ggas-projects.vercel.app', 'https://www.veggat.com.',
    'http://localhost:3000', 'https://localhost:3000', 'https://127.0.0.1:3000', 'https://[::1]:3000',
    'https://secret@example.test', 'https://example.test/path', 'https://example.test/?secret=value',
    'https://example.test/#secret', 'not-a-url']) {
    assert.throws(() => validatePreviewDeployment({ ...preview, AUTH_URL }), error => {
      assert.match(error.message, /Preview/); assert.doesNotMatch(error.message, /secret|example\.test/); return true;
    });
  }
  assert.throws(() => validatePreviewDeployment({ ...preview,
    AUTH_URL: 'https://custom-production.example', VERCEL_PROJECT_PRODUCTION_URL: 'custom-production.example' }));
});
test('rejects each incomplete payment configuration including blank values', () => {
  const keys = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'];
  for (let bits = 1; bits < 7; bits++) {
    const values = Object.fromEntries(keys.map((key, i) => [key, bits & (1 << i) ? 'test-only' : ' ']));
    assert.throws(() => validatePreviewDeployment({ ...preview, ...values }), /require PAYPAL_CLIENT_ID/);
  }
});
test('does not change Production or localhost configuration rules', () => {
  assert.doesNotThrow(() => validatePreviewDeployment({ ...preview, VERCEL_ENV: 'production', AUTH_URL: 'https://www.veggat.com' }));
  assert.doesNotThrow(() => validatePreviewDeployment({ ...preview, VERCEL: '', AUTH_URL: 'http://localhost:3000', PAYPAL_CLIENT_ID: 'local' }));
});
test('actual migration entrypoint stops before Prisma when Preview validation fails', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./migrate-deploy.mjs', import.meta.url))], {
    env: { VERCEL: '1', VERCEL_ENV: 'preview', AUTH_URL: 'https://www.veggat.com' }, encoding: 'utf8', timeout: 10_000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Preview AUTH_URL/);
  assert.doesNotMatch(result.stdout + result.stderr, /Migration attempt|Prisma config|Datasource|migrations found/);
});
