/** @fileOverview Spending-policy and real Postgres concurrency regressions. @stability stable */
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ dbPrisma: {} }));
import { aiCreditEnvironment, createAiCreditLedger, platformDailyMicroUsd } from './ai-credit-ledger';

describe('AI spending safety configuration', () => {
  afterAll(() => vi.unstubAllEnvs());
  it.each(['-1', 'NaN', 'Infinity', '1e6', '2.123', ' 5', 'oops'])('fails closed for invalid budget %s', value => {
    expect(platformDailyMicroUsd(value)).toBe(0);
  });
  it('bounds owner configuration and preserves a kill switch', () => {
    expect(platformDailyMicroUsd('')).toBe(5_000_000);
    expect(platformDailyMicroUsd('0')).toBe(0);
    expect(platformDailyMicroUsd('1.25')).toBe(1_250_000);
    expect(platformDailyMicroUsd('100000')).toBe(10_000_000);
  });
  it('keeps demo, localhost and live balances separate', () => {
    vi.stubEnv('VERCEL', ''); vi.stubEnv('NODE_ENV', 'production');
    expect(aiCreditEnvironment('buyer')).toBe('SANDBOX');
    vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_ENV', 'production');
    expect(aiCreditEnvironment('buyer')).toBe('LIVE');
    expect(aiCreditEnvironment('demo_isolated')).toBe('DEMO');
  });
});

// Explicit opt-in only. Creates/drops ONLY its own random schema. No public
// tables, production counters, identities, balances or provider APIs are used.
describe.skipIf(process.env.TEST_AI_LEDGER_DATABASE !== '1')('AI ledger: real Postgres isolation', () => {
  const schema = `qa_ai_ledger_${randomUUID().replaceAll('-', '')}`;
  let admin: Client;
  let db: PrismaClient;
  let ledger: ReturnType<typeof createAiCreditLedger>;
  const request = (userId: string, overrides: Record<string, unknown> = {}) => ({
    userId, actorKey: userId, requestId: randomUUID(), provider: 'OPENAI', model: 'fixture-model',
    funding: 'PLATFORM' as const, credits: 1, reservedMicroUsd: 1000, ...overrides,
  });

  beforeAll(async () => {
    // Vitest's NODE_ENV=test intentionally skips Next's .env.local. Read only
    // the required DB value; never print values or load provider/payment keys.
    const { parse } = await import('dotenv');
    const local = parse(await readFile(new URL('../.env.local', import.meta.url), 'utf8').catch(() => ''));
    const connectionString = process.env.AI_LEDGER_TEST_DATABASE_URL ?? process.env.DATABASE_URL_MAINLIVE ??
      process.env.DATABASE_URL_MAINDEV ?? process.env.DATABASE_URL ?? local.DATABASE_URL_MAINLIVE ?? local.DATABASE_URL_MAINDEV ?? local.DATABASE_URL;
    if (!connectionString) throw new Error('A database URL is required for isolated integration tests');
    vi.stubEnv('VERCEL', ''); vi.stubEnv('VERCEL_ENV', ''); vi.stubEnv('AI_PLATFORM_DAILY_BUDGET_USD', '1');
    const directUrl = new URL(connectionString);
    if (directUrl.hostname.endsWith('.neon.tech')) directUrl.hostname = directUrl.hostname.replace('-pooler.', '.');
    admin = new Client({ connectionString: directUrl.toString() });
    await admin.connect();
    if (!/^qa_ai_ledger_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe test schema');
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query('BEGIN');
    await admin.query(`SET LOCAL search_path TO "${schema}"`);
    await admin.query('CREATE TABLE "User" ("id" TEXT PRIMARY KEY)');
    const previous = await readFile(new URL('../prisma/migrations/20260924000100_verified_checkout_credits/migration.sql', import.meta.url), 'utf8');
    await admin.query(previous.slice(previous.indexOf('CREATE TABLE "AiCreditAccount"')));
    await admin.query(await readFile(new URL('../prisma/migrations/20260924000200_ai_reservations/migration.sql', import.meta.url), 'utf8'));
    await admin.query(`CREATE TABLE "DailyAiUsage" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id"),
      "date" DATE NOT NULL, "count" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL, UNIQUE ("userId", "date"))`);
    await admin.query('COMMIT');
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 12 }, { schema }) });
    ledger = createAiCreditLedger(db);
  }, 30_000);

  afterAll(async () => {
    await db?.$disconnect();
    // Exact generated target only, validated before creation and again here.
    if (admin && /^qa_ai_ledger_[a-f0-9]{32}$/.test(schema)) {
      await admin.query('ROLLBACK');
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
    vi.unstubAllEnvs();
  });

  async function buyer(name: string, balance: number) {
    await admin.query(`INSERT INTO "${schema}"."User" ("id") VALUES ($1)`, [name]);
    await db.aiCreditAccount.create({ data: { id: `SANDBOX:${name}`, userId: name, environment: 'SANDBOX', balance } });
  }

  it('allows exactly one of ten concurrent attempts to spend the last credit', async () => {
    await buyer('last-credit', 1);
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => ledger.reserve(request('last-credit'))));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected').every(r => r.status === 'rejected' && r.reason.code === 'AI_CREDITS_REQUIRED')).toBe(true);
    expect(await ledger.balance('last-credit')).toBe(0);
    expect(await db.aiCreditEntry.count({ where: { accountId: 'SANDBOX:last-credit', kind: 'RESERVE' } })).toBe(1);
  }, 30_000);

  it('does not charge or execute a duplicate request twice', async () => {
    await buyer('replay', 3);
    const input = request('replay');
    const results = await Promise.allSettled([ledger.reserve(input), ledger.reserve(input)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await ledger.balance('replay')).toBe(2);
  });

  it('refunds once while keeping provider budget spent, including a replay after refund', async () => {
    await buyer('refund', 3);
    const input = request('refund');
    const reservation = await ledger.reserve(input);
    const before = await db.aiPlatformSpendDay.findMany();
    expect((await Promise.all(Array.from({ length: 8 }, () => ledger.settle(reservation.id, false)))).filter(Boolean)).toHaveLength(1);
    expect(await ledger.balance('refund')).toBe(3);
    expect(await db.aiPlatformSpendDay.findMany()).toEqual(before);
    await expect(ledger.reserve(input)).rejects.toMatchObject({ code: 'AI_REQUEST_ALREADY_USED' });
  }, 30_000);

  it('cannot refund a successfully completed generation', async () => {
    await buyer('complete', 3);
    const reservation = await ledger.reserve(request('complete'));
    expect(await ledger.settle(reservation.id, true)).toBe(true);
    expect(await ledger.settle(reservation.id, false)).toBe(false);
    expect(await ledger.balance('complete')).toBe(2);
  });

  it('recovers a crashed reservation after the lease without replenishing the fuse', async () => {
    await buyer('crashed', 2);
    const reservation = await ledger.reserve(request('crashed'));
    await db.aiGenerationReservation.update({ where: { id: reservation.id }, data: { createdAt: new Date(Date.now() - 180_000) } });
    const before = await db.aiPlatformSpendDay.findMany();
    expect(await ledger.balance('crashed')).toBe(2);
    expect(await db.aiPlatformSpendDay.findMany()).toEqual(before);
    expect(await ledger.settle(reservation.id, true)).toBe(false);
  });

  it('grants a demo allowance once despite simultaneous initialization', async () => {
    await admin.query(`INSERT INTO "${schema}"."User" ("id") VALUES ($1)`, ['demo_fixture']);
    const grants = await Promise.all(Array.from({ length: 6 }, () => ledger.grantDemo('demo_fixture')));
    expect(grants.filter(Boolean)).toHaveLength(1);
    expect(await ledger.balance('demo_fixture')).toBe(5);
    await expect(ledger.grantDemo('complete')).rejects.toMatchObject({ code: 'DEMO_SESSION_REQUIRED' });
  }, 30_000);

  it('checks daily quota before reserving or charging', async () => {
    await buyer('daily', 100);
    const date = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    await db.dailyAiUsage.create({ data: { userId: 'daily', date, count: 20 } });
    await expect(ledger.reserve(request('daily'))).rejects.toMatchObject({ code: 'AI_DAILY_LIMIT' });
    expect(await ledger.balance('daily')).toBe(100);
  });

  it('cannot make the platform fuse race past its limit', async () => {
    await buyer('fuse', 100);
    const date = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    await db.aiPlatformSpendDay.update({ where: { date }, data: { reservedMicroUsd: 999_000 } });
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => ledger.reserve(request('fuse'))));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((await db.aiPlatformSpendDay.findUniqueOrThrow({ where: { date } })).reservedMicroUsd).toBe(1_000_000);
    expect(await ledger.balance('fuse')).toBe(99);
  }, 30_000);

  it('BYOK does not debit credits or platform budget, even after the fuse is exhausted', async () => {
    await buyer('byok', 0);
    const before = await db.aiPlatformSpendDay.findMany();
    await ledger.reserve(request('byok', { funding: 'BYOK', credits: 0, reservedMicroUsd: 0 }));
    expect(await ledger.balance('byok')).toBe(0);
    expect(await db.aiPlatformSpendDay.findMany()).toEqual(before);
    await expect(ledger.reserve(request('byok', { funding: 'BYOK', credits: 1 }))).rejects.toThrow();
  });

  it('database constraints reject negative balances and bypassing the hard platform cap', async () => {
    await expect(db.aiCreditAccount.update({ where: { id: 'SANDBOX:byok' }, data: { balance: -1 } })).rejects.toThrow();
    const date = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    await expect(db.aiPlatformSpendDay.update({ where: { date }, data: { reservedMicroUsd: 10_000_001 } })).rejects.toThrow();
  });
});
