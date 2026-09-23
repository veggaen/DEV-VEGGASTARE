/** @fileOverview Run local build/migration/test commands against only the isolated Preview database. @stability experimental */
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { parse } from 'dotenv';

export function isolatedPreviewEnv() {
  const local = parse(readFileSync(new URL('../.env.local', import.meta.url)));
  const isolated = parse(readFileSync(new URL('../.private-showcase/neon-preview.env', import.meta.url)));
  const target = isolated.DATABASE_URL_MAINPREVIEW;
  const host = value => {
    try {
      const url = new URL(value);
      if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
      return url.hostname.replace('-pooler.', '.');
    } catch { throw new Error('Invalid database configuration (values redacted).'); }
  };
  if (!target || !local.DATABASE_URL_MAINLIVE || host(target) === host(local.DATABASE_URL_MAINLIVE)) {
    throw new Error('A verified isolated Preview database is required. Production fallback is forbidden.');
  }
  return { VERCEL_ENV: 'preview', DATABASE_URL_MAINPREVIEW: target };
}

// Launch a Node entrypoint, not a shell command; credentials never enter argv.
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/with-preview-database.mjs')) {
  const [entrypoint, ...args] = process.argv.slice(2);
  if (!entrypoint) throw new Error('Provide a Node script to run.');
  const env = { ...process.env, ...isolatedPreviewEnv() };
  delete env.VERCEL;
  console.log('Isolated Preview database verified; no production database changes.');
  const child = spawn(process.execPath, [entrypoint, ...args], { env, stdio: 'inherit' });
  child.on('exit', code => { process.exitCode = code ?? 1; });
  process.on('SIGINT', () => child.kill('SIGINT'));
}
