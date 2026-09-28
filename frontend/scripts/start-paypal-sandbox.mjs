/** @fileOverview Start the local built app with verified Sandbox-only PayPal credentials. @stability experimental */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { isolatedPreviewEnv } from './with-preview-database.mjs';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = process.argv.find(arg => arg.startsWith('--dist-dir='))?.slice(11) ?? '.next';
const development = process.argv.includes('--dev');
if (!/^\.next(?:-[a-z0-9-]+)?$/.test(dist)) throw new Error('Invalid local build directory');
const sandbox = parse(readFileSync(new URL('../.private-showcase/paypal-development.env', import.meta.url)));
if (!sandbox.PAYPAL_CLIENT_ID || !sandbox.PAYPAL_CLIENT_SECRET) throw new Error('Pull Sandbox Development credentials first; never pull Production here.');
// Authentication against the fixed Sandbox endpoint fails for Live credentials.
// No credential, access token or provider response body is ever printed.
const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
  method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
  headers: { Authorization: `Basic ${Buffer.from(`${sandbox.PAYPAL_CLIENT_ID}:${sandbox.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
    'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials',
});
if (!response.ok || typeof (await response.json()).access_token !== 'string') throw new Error('Sandbox authentication failed; local server was not started.');
const env = { ...process.env, NODE_ENV: development ? 'development' : 'production', NEXT_DIST_DIR: dist, AUTH_URL: 'http://localhost:3000',
  ...isolatedPreviewEnv(),
  PAYPAL_CLIENT_ID: sandbox.PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET: sandbox.PAYPAL_CLIENT_SECRET };
// Do not load Development's database, AI keys, or Live routing into the process.
delete env.VERCEL; delete env.PAYPAL_WEBHOOK_ID;
console.log('Sandbox credentials and isolated Preview database verified. Starting localhost:3000; real payments are disabled.');
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), development ? 'dev' : 'start', ...(development ? ['--webpack'] : []), '-p', '3000'], { cwd: root, env, stdio: 'inherit' });
child.on('exit', code => { process.exitCode = code ?? 1; });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
