/** @fileOverview CI's plaintext transport exception must never apply to real databases. @stability stable */
import { expect, it } from 'vitest';
import { isDisposableCiDatabase } from '@/scripts/ci-database.mjs';
const url = 'postgresql://veggat_ci:disposable@127.0.0.1:5432/veggat_ci?sslmode=disable';
const env = { CI: 'true', VERCEL_ENV: 'preview', VERCEL: '', DATABASE_URL_MAINLIVE: '' };
it('recognizes only the named ephemeral loopback CI service', () => {
  expect(isDisposableCiDatabase(url, env)).toBe(true);
  expect(isDisposableCiDatabase(url.replace('127.0.0.1', 'localhost'), env)).toBe(true);
});
it.each([
  [url, { ...env, CI: 'false' }], [url, { ...env, VERCEL_ENV: 'production' }],
  [url, { ...env, VERCEL: '1' }], [url, { ...env, DATABASE_URL_MAINLIVE: 'configured' }],
  [url.replace('127.0.0.1', 'example.neon.tech'), env], [url.replace('/veggat_ci?', '/production?'), env],
  [url.replace('veggat_ci:', 'owner:'), env], [url.replace('5432', '5433'), env],
  [url + '&schema=production', env], [url.replace('disable', 'require'), env], ['invalid', env],
])('denies any other target or environment (%s)', (target, environment) => {
  expect(isDisposableCiDatabase(target, environment)).toBe(false);
});
