/** @fileOverview Isolated PostgreSQL evidence filtering and cache consistency. @stability stable */
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { previewDatabaseUrl } from '@/lib/preview-database';
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', () => ({ get dbPrisma() { return state.db; } }));
import { readVerificationEvidence } from '@/lib/verification-evidence';
import { recalculateVerificationTier } from '@/lib/verification-recalc';

describe.skipIf(process.env.TEST_VERIFICATION_DATABASE !== '1')('real database verification evidence', () => {
  const schema = `qa_evidence_${randomUUID().replaceAll('-', '')}`;
  let admin: Client, db: PrismaClient;
  const transactionErrors: string[] = [];
  beforeAll(async () => {
    const url = new URL(previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: process.env.DATABASE_URL_MAINPREVIEW, DATABASE_URL_MAINLIVE: process.env.DATABASE_URL_MAINLIVE }));
    url.hostname = url.hostname.replace('-pooler.', '.'); url.searchParams.set('sslmode', 'verify-full');
    admin = new Client({ connectionString: url.toString() }); await admin.connect();
    if (!/^qa_evidence_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid disposable schema');
    await admin.query(`CREATE SCHEMA "${schema}"`); await admin.query(`SET search_path TO "${schema}"`);
    // Minimal disposable tables exercise the real query predicates and
    // transactions, including intentionally invalid legacy records. No public
    // data or schema is copied or modified; this is not a migrations test.
    await admin.query(`CREATE TYPE "ChainFamily" AS ENUM ('EVM','SOLANA','AUTH');
      CREATE TYPE "OrderStatus" AS ENUM ('PENDING','COMPLETED');
      CREATE TYPE "UserVerificationTier" AS ENUM ('ANONYMOUS','WALLET_ONLY','WEB2_BASIC','WEB3_BASIC','SOCIAL_BASIC','SOCIAL_VERIFIED','MULTI_SOCIAL','WEB2_PAYMENT','WEB3_VERIFIED','WEB3_PAYMENT','PAYMENT_VERIFIED','PHONE_VERIFIED','FULLY_VERIFIED');
      CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "emailVerified" TIMESTAMP(3), "phoneVerified" TIMESTAMP(3), "phoneNumber" TEXT,
        "hasGoogleAuth" BOOLEAN DEFAULT TRUE, "hasGithubAuth" BOOLEAN DEFAULT FALSE, "hasDiscordAuth" BOOLEAN DEFAULT FALSE,
        "isTwoFactorEnabled" BOOLEAN DEFAULT FALSE, "web3ModeEnabled" BOOLEAN DEFAULT FALSE, "bankidVerified" TIMESTAMP(3),
        "vippsVerified" TIMESTAMP(3), "emailRisk" TEXT DEFAULT 'verified', "reachLifetime" DOUBLE PRECISION DEFAULT 0,
        "hasVerifiedWallet" BOOLEAN DEFAULT TRUE, "hasWeb2Payment" BOOLEAN DEFAULT TRUE, "hasWeb3Payment" BOOLEAN DEFAULT TRUE,
        "verificationTier" "UserVerificationTier" DEFAULT 'FULLY_VERIFIED', "verificationScore" INTEGER DEFAULT 100, "trueReach" DOUBLE PRECISION,
        "riskScore" INTEGER, "updatedAt" TIMESTAMP(3));
      CREATE TABLE "Account" ("id" TEXT PRIMARY KEY, "userId" TEXT, "provider" TEXT);
      CREATE TABLE "PendingOAuthLink" ("id" TEXT PRIMARY KEY, "userId" TEXT, "provider" TEXT, "expires" TIMESTAMP(3));
      CREATE TABLE "Wallet" ("id" TEXT PRIMARY KEY, "label" TEXT, "family" "ChainFamily", "address" TEXT, "ownerUserId" TEXT,
        "ownerCompanyId" TEXT, "verifiedAt" TIMESTAMP(3), "donationTotalUsd" DOUBLE PRECISION, "createdAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3));
      CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "userId" TEXT, "totalAmount" DOUBLE PRECISION, "status" "OrderStatus",
        "createdAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3));
      CREATE TABLE "CheckoutAttempt" ("orderId" TEXT PRIMARY KEY, "userId" TEXT, "requestKey" TEXT, "environment" TEXT,
        "totalOre" INTEGER, "quote" JSONB, "state" TEXT, "refundedOre" INTEGER DEFAULT 0, "captureId" TEXT, "completedAt" TIMESTAMP(3),
        "createRequestId" TEXT, "captureRequestId" TEXT);`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 8 }, { schema }) });
    const transaction = db.$transaction.bind(db);
    state.db = new Proxy(db, { get(target, property) {
      if (property === '$transaction') return async (...args: Parameters<typeof transaction>) => {
        try { return await transaction(...args); }
        catch (error) { transactionErrors.push(JSON.stringify(error)); throw error; }
      };
      return Reflect.get(target, property);
    } });
    expect((await db.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`)[0].current_schema).toBe(schema);
    await admin.query(`INSERT INTO "User" ("id","emailVerified") VALUES ('qa-evidence',now());
      INSERT INTO "Account" VALUES ('qa-google','qa-evidence','google');`);
  }, 30_000);
  afterAll(async () => {
    await db?.$disconnect();
    if (admin && /^qa_evidence_[a-f0-9]{32}$/.test(schema)) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end();
    }
  });
  async function seedAttempt(kind: string) {
    const id = `qa-${kind}`;
    await admin.query('INSERT INTO "Order" ("id","userId","totalAmount","status") VALUES ($1,$2,9,$3)',
      [id, kind === 'wrong-owner' ? 'other' : 'qa-evidence', kind === 'order-pending' ? 'PENDING' : 'COMPLETED']);
    await admin.query('INSERT INTO "CheckoutAttempt" ("orderId","userId","environment","totalOre","state","refundedOre","captureId","completedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, 'qa-evidence', ['SANDBOX','DEMO'].includes(kind) ? kind : 'LIVE', kind === 'free' ? 0 : 900,
        kind === 'pending' ? 'APPROVAL_PENDING' : kind === 'reversed' ? 'REVERSED' : 'COMPLETED', kind === 'refunded' ? 900 : 0,
        kind === 'no-capture' ? null : id, kind === 'no-completion' ? null : new Date()]);
  }
  it('ignores stale cached fields, unsigned wallets and company-owned wallets', async () => {
    await admin.query(`INSERT INTO "Wallet" ("id","family","ownerUserId","donationTotalUsd") VALUES ('unsigned','EVM','qa-evidence',10000000);
      INSERT INTO "Wallet" ("id","family","ownerUserId","ownerCompanyId","verifiedAt") VALUES ('company','EVM','qa-evidence','qa-company',now());`);
    expect(await readVerificationEvidence('qa-evidence')).toMatchObject({ tier: 'SOCIAL_VERIFIED', score: 30,
      flags: { hasVerifiedWallet: false, hasWeb2Payment: false, hasWeb3Payment: false } });
  });
  it.each(['SANDBOX','DEMO','pending','refunded','reversed','no-capture','no-completion','free','wrong-owner','order-pending'])('does not award a payment badge for %s', async kind => {
    await seedAttempt(kind);
    expect((await readVerificationEvidence('qa-evidence'))!.flags.hasWeb2Payment).toBe(false);
  });
  it('recognizes a verified Live capture and persists matching flags under concurrency', async () => {
    await seedAttempt('live');
    const expected = { tier: 'WEB2_PAYMENT', score: 45 };
    expect(await readVerificationEvidence('qa-evidence')).toMatchObject(expected);
    const results = await Promise.all([recalculateVerificationTier('qa-evidence'), recalculateVerificationTier('qa-evidence')]);
    expect(results.filter(Boolean), transactionErrors.join('\n')).toHaveLength(2);
    expect(results).toEqual([expected, expected]);
    expect(await db.user.findUnique({ where: { id: 'qa-evidence' }, select: { verificationTier: true, verificationScore: true, hasWeb2Payment: true, hasVerifiedWallet: true, hasWeb3Payment: true } }))
      .toEqual({ verificationTier: expected.tier, verificationScore: expected.score, hasWeb2Payment: true, hasVerifiedWallet: false, hasWeb3Payment: false });
  });
  it('reflects a refund and a removed OAuth provider immediately without writing on read', async () => {
    await db.checkoutAttempt.update({ where: { orderId: 'qa-live' }, data: { state: 'REFUNDED', refundedOre: 900 }, select: { orderId: true } });
    await db.account.deleteMany({ where: { userId: 'qa-evidence' } });
    expect(await readVerificationEvidence('qa-evidence')).toMatchObject({ tier: 'WEB2_BASIC', score: 10, flags: { hasGoogleAuth: false, hasWeb2Payment: false } });
    expect((await db.user.findUnique({ where: { id: 'qa-evidence' }, select: { verificationTier: true } }))!.verificationTier).toBe('WEB2_PAYMENT');
  });
});
