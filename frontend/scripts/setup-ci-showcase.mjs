/** @fileOverview Seed an EMPTY disposable CI database only; no production credentials or external writes. @stability experimental */
import { Pool } from 'pg';
import { spawnSync } from 'node:child_process';
import { isDisposableCiDatabase } from './ci-database.mjs';

const connectionString = process.env.DATABASE_URL_MAINPREVIEW;
if (!isDisposableCiDatabase(connectionString)) throw new Error('Only the named empty loopback CI database is permitted.');
const forbidden = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID', 'OPENAI_API_KEY',
  'GROQ_API_KEY', 'XAI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY'];
if (forbidden.some(name => process.env[name])) throw new Error('Payment and AI provider credentials must be absent in CI.');
const pool = new Pool({ connectionString, ssl: false, max: 1 });
try {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
  if (rows[0].count !== 0) throw new Error('CI database must be empty; no existing data will be overwritten.');
  // Historical migrations lack an initial baseline. This bootstraps the CURRENT
  // schema for browser smoke tests, not a migration replay acceptance claim.
  const schema = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push'], { stdio: 'inherit', env: process.env });
  if (schema.status !== 0) throw new Error('Disposable schema bootstrap failed');
  await pool.query(`INSERT INTO "User" (id,name,email,role,"emailDisplayMode","updatedAt")
    VALUES ('cveggatcistudioowner00001','CI Studio','studio@ci.veggat.invalid','OWNER','HIDE',now())`);
  const seed = spawnSync(process.execPath, ['scripts/seed-showcase.mjs', 'preview'], { stdio: 'inherit', env: process.env });
  if (seed.status !== 0) throw new Error('Disposable catalog seed failed');
  console.log('Empty CI database initialized with synthetic catalog only. No payment or AI provider credentials.');
} finally { await pool.end(); }
