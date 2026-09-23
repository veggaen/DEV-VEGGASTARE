/** @fileOverview Spending-policy and real Postgres concurrency regressions. @stability stable */
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ dbPrisma: {} }));
vi.mock('@/lib/payments/showcase-paypal', () => ({ readPayPalCapture: vi.fn(), readPayPalRefund: vi.fn() }));
import { aiCreditEnvironment, createAiCreditLedger, platformDailyMicroUsd } from './ai-credit-ledger';
import { applyAiCreditDelta } from './ai-credit-adjustment';
import { createPayPalAdjustmentReconciler } from './payments/showcase-refunds';

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
    await admin.query(`CREATE TYPE "OrderStatus" AS ENUM ('PENDING','CONFIRMING','COMPLETED','FAILED','CANCELLED');
      CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "status" "OrderStatus" NOT NULL DEFAULT 'COMPLETED', "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE "Product" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "DigitalAsset" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "DownloadToken" ("id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL, "isRevoked" BOOLEAN NOT NULL DEFAULT false, "revokedReason" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE "PaymentWebhookEvent" ("id" TEXT PRIMARY KEY, "provider" TEXT NOT NULL, "deliveryId" TEXT, "eventType" TEXT,
        "signatureVerified" BOOLEAN NOT NULL DEFAULT false, "sessionId" TEXT, "orderId" TEXT, "paymentId" TEXT, "paymentStatus" TEXT,
        "orderStatus" TEXT, "httpStatus" INTEGER, "processingError" TEXT, "rawPayload" JSONB, "headers" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, UNIQUE ("provider", "deliveryId"))`);
    const previous = await readFile(new URL('../prisma/migrations/20260924000100_verified_checkout_credits/migration.sql', import.meta.url), 'utf8');
    await admin.query(previous);
    await admin.query(await readFile(new URL('../prisma/migrations/20260924000200_ai_reservations/migration.sql', import.meta.url), 'utf8'));
    await admin.query(await readFile(new URL('../prisma/migrations/20260924000300_credit_refund_adjustment/migration.sql', import.meta.url), 'utf8'));
    await admin.query(await readFile(new URL('../prisma/migrations/20260924000400_checkout_payment_reconciliation/migration.sql', import.meta.url), 'utf8'));
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

  async function refundableOrder(name: string, completed = true) {
    await buyer(name, completed ? 100 : 0);
    await admin.query(`INSERT INTO "${schema}"."Order" ("id") VALUES ($1)`, [name]);
    await db.checkoutAttempt.create({ data: { orderId: name, userId: name, requestKey: randomUUID(), environment: 'SANDBOX',
      totalOre: 3900, quote: {}, state: completed ? 'COMPLETED' : 'APPROVAL_PENDING', paypalOrderId: name.replaceAll('-', '').toUpperCase(),
      merchantId: 'MERCHANT1', captureId: completed ? `C${name.replaceAll('-', '').toUpperCase()}` : null } });
    if (completed) await db.aiCreditEntry.create({ data: { accountId: `SANDBOX:${name}`, delta: 100, kind: 'PURCHASE', sourceKey: `checkout:${name}` } });
    await admin.query(`INSERT INTO "${schema}"."DownloadToken" ("id", "orderId") VALUES ($1,$1)`, [name]);
    const captureId = `C${name.replaceAll('-', '').toUpperCase()}`;
    const provider = {
      readPayPalCapture: vi.fn(async () => ({ id: captureId, status: 'REFUNDED', invoice_id: name,
        amount: { currency_code: 'NOK', value: '39.00' }, payee: { merchant_id: 'MERCHANT1' },
        supplementary_data: { related_ids: { order_id: name.replaceAll('-', '').toUpperCase() } } })),
      readPayPalRefund: vi.fn(async (id: string) => ({ id, status: 'COMPLETED', amount: { currency_code: 'NOK', value: '39.00' },
        seller_payable_breakdown: { total_refunded_amount: { currency_code: 'NOK', value: '39.00' } },
        links: [{ rel: 'up', method: 'GET', href: `https://api-m.sandbox.paypal.com/v2/payments/captures/${captureId}` }] })),
    };
    const event = { id: `EVENT-${name}`, event_type: 'PAYMENT.CAPTURE.REFUNDED' as const, resource: { id: 'REFUND1' } };
    return { provider, event, captureId, reconcile: createPayPalAdjustmentReconciler(db, provider) };
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

  it('offsets a payment refund with an in-flight failed generation without restoring paid credits', async () => {
    await buyer('payment-refund', 100);
    const reservation = await ledger.reserve(request('payment-refund', { credits: 3 }));
    await db.$transaction(tx => applyAiCreditDelta(tx, 'SANDBOX:payment-refund', -100));
    expect(await ledger.position('payment-refund')).toEqual({ balance: 0, refundAdjustment: 3 });
    await expect(ledger.reserve(request('payment-refund'))).rejects.toMatchObject({ code: 'AI_CREDITS_REQUIRED' });
    await ledger.settle(reservation.id, false);
    expect(await ledger.position('payment-refund')).toEqual({ balance: 0, refundAdjustment: 0 });
    expect(await ledger.settle(reservation.id, false)).toBe(false);
  });

  it('keeps used refunded credits as an adjustment that the next purchase offsets', async () => {
    await buyer('used-refund', 100);
    const reservation = await ledger.reserve(request('used-refund', { credits: 3 }));
    await ledger.settle(reservation.id, true);
    await db.$transaction(tx => applyAiCreditDelta(tx, 'SANDBOX:used-refund', -100));
    expect(await ledger.position('used-refund')).toEqual({ balance: 0, refundAdjustment: 3 });
    await db.$transaction(tx => applyAiCreditDelta(tx, 'SANDBOX:used-refund', 100));
    expect(await ledger.position('used-refund')).toEqual({ balance: 97, refundAdjustment: 0 });
  });

  it('serializes a purchase, refund and generation failures without lost credit updates', async () => {
    await buyer('refund-race', 100);
    const reservations = await Promise.all(Array.from({ length: 2 }, () => ledger.reserve(request('refund-race'))));
    await Promise.all([
      db.$transaction(tx => applyAiCreditDelta(tx, 'SANDBOX:refund-race', -100)),
      db.$transaction(tx => applyAiCreditDelta(tx, 'SANDBOX:refund-race', 100)),
      ...reservations.map(reservation => ledger.settle(reservation.id, false)),
    ]);
    expect(await ledger.position('refund-race')).toEqual({ balance: 100, refundAdjustment: 0 });
  }, 30_000);

  it('prevents negative adjustments and simultaneous positive spendable credit and debt', async () => {
    await expect(db.aiCreditAccount.update({ where: { id: 'SANDBOX:used-refund' }, data: { refundAdjustment: -1 } })).rejects.toThrow();
    await expect(db.aiCreditAccount.update({ where: { id: 'SANDBOX:used-refund' }, data: { refundAdjustment: 1 } })).rejects.toThrow();
  });

  it('reconciles six duplicate refunds and a failed generation exactly once with revoked downloads', async () => {
    const name = 'refund-webhook', { reconcile, event } = await refundableOrder(name);
    const reservation = await ledger.reserve(request(name, { credits: 3 }));
    await Promise.all([...Array.from({ length: 6 }, () => reconcile(event)), ledger.settle(reservation.id, false)]);
    expect(await ledger.position(name)).toEqual({ balance: 0, refundAdjustment: 0 });
    expect(await db.aiCreditEntry.count({ where: { sourceKey: `paypal-revoke:${name}` } })).toBe(1);
    expect(await db.paymentWebhookEvent.count({ where: { deliveryId: event.id } })).toBe(1);
    expect((await db.checkoutAttempt.findUniqueOrThrow({ where: { orderId: name } })).state).toBe('REFUNDED');
    expect(await db.downloadToken.count({ where: { orderId: name, isRevoked: false } })).toBe(0);
    expect(await db.order.findUnique({ where: { id: name }, select: { status: true } })).toEqual({ status: 'CANCELLED' });
  }, 30_000);

  it('holds partial refunds and never double-debits or downgrades a later full refund', async () => {
    const name = 'refund-partial', { reconcile, event, provider } = await refundableOrder(name);
    const fullCapture = await provider.readPayPalCapture(), fullRefund = await provider.readPayPalRefund('REFUND1');
    provider.readPayPalCapture.mockResolvedValue({ ...fullCapture, status: 'PARTIALLY_REFUNDED' });
    provider.readPayPalRefund.mockResolvedValue({ ...fullRefund, amount: { currency_code: 'NOK', value: '10.00' },
      seller_payable_breakdown: { total_refunded_amount: { currency_code: 'NOK', value: '10.00' } } });
    await reconcile(event);
    expect((await db.checkoutAttempt.findUniqueOrThrow({ where: { orderId: name } })).state).toBe('PAYMENT_REVIEW');
    expect(await ledger.balance(name)).toBe(0);
    provider.readPayPalCapture.mockResolvedValue(fullCapture); provider.readPayPalRefund.mockResolvedValue(fullRefund);
    await reconcile({ ...event, id: 'FULL-REFUND' });
    provider.readPayPalCapture.mockResolvedValue({ ...fullCapture, status: 'PARTIALLY_REFUNDED' });
    provider.readPayPalRefund.mockResolvedValue({ ...fullRefund, amount: { currency_code: 'NOK', value: '10.00' },
      seller_payable_breakdown: { total_refunded_amount: { currency_code: 'NOK', value: '10.00' } } });
    await reconcile({ ...event, id: 'LATE-PARTIAL' });
    expect(await db.checkoutAttempt.findUnique({ where: { orderId: name }, select: { state: true, refundedOre: true } }))
      .toEqual({ state: 'REFUNDED', refundedOre: 3900 });
    expect(await db.aiCreditEntry.count({ where: { sourceKey: `paypal-revoke:${name}` } })).toBe(1);
  }, 30_000);

  it('records refund-before-fulfillment without inventing a credit debt', async () => {
    const name = 'refund-before', { reconcile, event } = await refundableOrder(name, false);
    await reconcile(event);
    expect((await db.checkoutAttempt.findUniqueOrThrow({ where: { orderId: name } })).state).toBe('REFUNDED');
    expect(await ledger.position(name)).toEqual({ balance: 0, refundAdjustment: 0 });
    expect(await db.aiCreditEntry.count({ where: { accountId: `SANDBOX:${name}` } })).toBe(0);
  });

  it('reconciles a verified reversal and its replay without fabricating a provider status', async () => {
    const name = 'refund-reversal', { reconcile, provider, captureId } = await refundableOrder(name);
    const capture = await provider.readPayPalCapture(); provider.readPayPalCapture.mockResolvedValue({ ...capture, status: 'COMPLETED' });
    await reconcile({ id: 'REVERSAL1', event_type: 'PAYMENT.CAPTURE.REVERSED', resource: { id: captureId } });
    await reconcile({ id: 'REVERSAL2', event_type: 'PAYMENT.CAPTURE.REVERSED', resource: { id: captureId } });
    expect(await ledger.position(name)).toEqual({ balance: 0, refundAdjustment: 0 });
    expect((await db.checkoutAttempt.findUniqueOrThrow({ where: { orderId: name } })).state).toBe('REVERSED');
    expect(await db.aiCreditEntry.count({ where: { accountId: `SANDBOX:${name}`, kind: 'PAYMENT_REVERSAL' } })).toBe(1);
    expect(provider.readPayPalRefund).not.toHaveBeenCalled();
  });

  it('rolls credit changes back if download revocation fails, then retries the complete transaction', async () => {
    const name = 'refund-rollback', { reconcile, event } = await refundableOrder(name);
    await admin.query(`ALTER TABLE "${schema}"."DownloadToken" ADD CONSTRAINT "qa_revoke_failure" CHECK ("orderId" <> 'refund-rollback' OR NOT "isRevoked")`);
    try {
      await expect(reconcile(event)).rejects.toThrow();
      expect(await ledger.balance(name)).toBe(100);
      expect((await db.checkoutAttempt.findUniqueOrThrow({ where: { orderId: name } })).state).toBe('COMPLETED');
      expect(await db.aiCreditEntry.count({ where: { sourceKey: `paypal-revoke:${name}` } })).toBe(0);
      expect(await db.paymentWebhookEvent.count({ where: { deliveryId: event.id } })).toBe(0);
    } finally { await admin.query(`ALTER TABLE "${schema}"."DownloadToken" DROP CONSTRAINT "qa_revoke_failure"`); }
    await reconcile(event); expect(await ledger.balance(name)).toBe(0);
  });

  it('allows only two parallel generations and releases a slot after settlement', async () => {
    await buyer('parallel', 100);
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => ledger.reserve(request('parallel'))));
    const accepted = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    expect(accepted).toHaveLength(2);
    expect(results.filter(result => result.status === 'rejected').every(result => result.status === 'rejected' && result.reason.code === 'AI_CONCURRENT_LIMIT')).toBe(true);
    expect(await ledger.balance('parallel')).toBe(98);
    const day = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    expect((await db.dailyAiUsage.findUniqueOrThrow({ where: { userId_date: { userId: 'parallel', date: day } } })).count).toBe(2);
    await ledger.settle(accepted[0].id, true);
    await ledger.reserve(request('parallel'));
    expect(await ledger.balance('parallel')).toBe(97);
  }, 30_000);

  it('counts BYOK and free generations toward the same concurrency limit without charging credits', async () => {
    await buyer('parallel-free', 0);
    const byok = { funding: 'BYOK' as const, credits: 0, reservedMicroUsd: 0 };
    const a = await ledger.reserve(request('parallel-free', byok));
    await ledger.reserve(request('parallel-free', { credits: 0 }));
    const budgetBefore = await db.aiPlatformSpendDay.findMany();
    await expect(ledger.reserve(request('parallel-free', byok))).rejects.toMatchObject({ code: 'AI_CONCURRENT_LIMIT' });
    expect(await db.aiPlatformSpendDay.findMany()).toEqual(budgetBefore);
    expect(await ledger.balance('parallel-free')).toBe(0);
    await db.aiGenerationReservation.update({ where: { id: a.id }, data: { createdAt: new Date(Date.now() - 180_000) } });
    await ledger.reserve(request('parallel-free', byok));
    expect((await db.aiGenerationReservation.findUniqueOrThrow({ where: { id: a.id } })).state).toBe('REFUNDED');
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
