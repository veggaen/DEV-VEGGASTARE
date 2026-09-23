/** @fileOverview Create synthetic seller and password QA buyer only in an explicitly isolated Preview database. @stability experimental */
import { Client } from 'pg';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parse } from 'dotenv';
import bcrypt from 'bcryptjs';

const expectedHost = process.argv.find(arg => arg.startsWith('--expected-host='))?.slice(16);
const url = new URL(process.env.DATABASE_URL_MAINPREVIEW);
if (!expectedHost || url.hostname !== expectedHost || !expectedHost.endsWith('.neon.tech') || process.env.VERCEL_ENV === 'production') throw new Error('Use an explicitly verified Neon Preview endpoint only.');
if (process.env.DATABASE_URL_MAINLIVE && url.hostname.replace('-pooler.', '.') === new URL(process.env.DATABASE_URL_MAINLIVE).hostname.replace('-pooler.', '.')) throw new Error('Refusing production endpoint.');
const credentialsPath = new URL('../.private-showcase/preview-qa.env', import.meta.url);
const buyerEmail = 'paypal-qa@veggat.invalid';
const buyerId = 'cveggatpreviewbuyer000001';
const sellerId = 'cveggatpreviewseller00001';
const existingCredentials = existsSync(credentialsPath) ? parse(readFileSync(credentialsPath)) : undefined;
if (existingCredentials && existingCredentials.E2E_TEST_EMAIL !== buyerEmail) throw new Error('Existing test credentials belong to a different identity.');
const password = existingCredentials?.E2E_TEST_PASSWORD || randomBytes(30).toString('base64url');
const passwordHash = await bcrypt.hash(password, 12);
url.searchParams.set('uselibpqcompat', 'true');
const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 10_000 });
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query(`SELECT pg_advisory_xact_lock(682079441)`);
  const users = (await client.query('SELECT id,email,role,password FROM public."User" ORDER BY id')).rows;
  if (users.some(user => ![sellerId, buyerId].includes(user.id))) throw new Error('Unexpected identities in target. Refusing to seed over an existing environment.');
  if (users.length && (!existingCredentials || !users.find(user => user.id === buyerId) || !await bcrypt.compare(password, users.find(user => user.id === buyerId).password || ''))) throw new Error('Existing QA identity does not match local test credentials. No password will be reset.');
  await client.query(`INSERT INTO public."User" (id,name,email,role,"emailVerified","web3ModeEnabled","updatedAt") VALUES ($1,'Sandbox Studio','sandbox-studio@veggat.invalid','OWNER',now(),false,now()) ON CONFLICT (id) DO NOTHING`, [sellerId]);
  await client.query(`INSERT INTO public."User" (id,name,email,role,password,"emailVerified","web3ModeEnabled","updatedAt") VALUES ($1,'Sandbox QA Buyer',$2,'USER',$3,now(),false,now()) ON CONFLICT (id) DO NOTHING`, [buyerId,buyerEmail,passwordHash]);
  if (!existingCredentials) writeFileSync(credentialsPath, `E2E_TEST_EMAIL=${buyerEmail}\nE2E_TEST_PASSWORD=${password}\n`, { flag: 'wx', mode: 0o600 });
  await client.query('COMMIT');
  console.log('Synthetic Preview seller (no password/login) and ordinary QA buyer ready. No credit grant, purchase, cap reset or production record copied. QA password saved only in ignored local test credentials.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(error.code ? `Preview seed failed (${error.code}); transaction rolled back.` : error.message);
  process.exitCode = 1;
} finally { await client.end(); }
