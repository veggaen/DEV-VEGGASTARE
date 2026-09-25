/** @fileOverview Real PostgreSQL receiving-email races in a disposable schema, never live. @stability stable */
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { previewDatabaseUrl } from '@/lib/preview-database';
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', () => ({ get dbPrisma() { return state.db; } }));
import { preparePaypalEmail, discardPaypalEmailRequest, checkPaypalEmail, clearPaypalEmail, readPaypalPaymentStatus, type PaypalEmailTarget } from './paypal-email';

describe.skipIf(process.env.TEST_PAYPAL_EMAIL_DATABASE !== '1')('atomic PayPal receiving email', () => {
  const schema = `qa_paypal_email_${randomUUID().replaceAll('-', '')}`;
  let admin: Client, db: PrismaClient;
  const companyId = 'cveggatshowcasestudio00001';
  beforeAll(async () => {
    if (process.env.VERCEL_ENV !== 'preview') throw new Error('Isolated Preview required');
    const url = new URL(previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: process.env.DATABASE_URL_MAINPREVIEW, DATABASE_URL_MAINLIVE: process.env.DATABASE_URL_MAINLIVE }));
    url.hostname = url.hostname.replace('-pooler.', '.'); url.searchParams.set('sslmode', 'verify-full');
    admin = new Client({ connectionString: url.toString() }); await admin.connect();
    if (!/^qa_paypal_email_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid disposable schema');
    await admin.query(`CREATE SCHEMA "${schema}"`); await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(`CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "paypalEmail" TEXT, "paypalEmailVerifiedAt" TIMESTAMP(3), "defaultReceivingWalletId" TEXT, "updatedAt" TIMESTAMP(3));
      CREATE TABLE "Company" ("id" TEXT PRIMARY KEY, "ownerId" TEXT, "paypalEmail" TEXT, "paypalEmailVerifiedAt" TIMESTAMP(3), "defaultReceivingWalletId" TEXT, "updatedAt" TIMESTAMP(3));
      CREATE TABLE "Wallet" ("id" TEXT PRIMARY KEY, "address" TEXT);
      CREATE TABLE "PaypalVerificationToken" ("id" TEXT PRIMARY KEY, "email" TEXT NOT NULL, "token" TEXT UNIQUE NOT NULL,
        "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "expires" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) DEFAULT now(), "updatedAt" TIMESTAMP(3), UNIQUE("entityType","entityId"));`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 6 }, { schema }) }); state.db = db;
    expect((await db.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`)[0].current_schema).toBe(schema);
  }, 30_000);
  afterAll(async () => {
    await db?.$disconnect();
    if (admin && /^qa_paypal_email_[a-f0-9]{32}$/.test(schema)) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      expect((await admin.query('SELECT 1 FROM information_schema.schemata WHERE schema_name = $1', [schema])).rowCount).toBe(0);
      await admin.end();
    }
  });
  beforeEach(async () => {
    await admin.query(`TRUNCATE "PaypalVerificationToken","Company","Wallet","User";
      INSERT INTO "User" ("id","paypalEmail","paypalEmailVerifiedAt") VALUES ('qa-owner','old@example.test',now()),('qa-other',null,null),('demo_fixture',null,null);`);
    await admin.query('INSERT INTO "Company" ("id","ownerId","paypalEmail","paypalEmailVerifiedAt") VALUES ($1,$2,$3,now())', [companyId, 'qa-owner', 'old@example.test']);
  });
  for (const target of [{ target: 'user' }, { target: 'company', companyId }] as PaypalEmailTarget[]) {
    const identity = { ...target, userId: 'qa-owner', origin: 'http://localhost:3000' };
    const issue = (email = 'new@example.test') => preparePaypalEmail({ ...identity, email, expectedEmail: 'old@example.test' });
    it(`${target.target}: keeps the current address until explicit one-use verification`, async () => {
      const request = await issue();
      const stored = await db.paypalVerificationToken.findFirst();
      expect(stored?.token).toMatch(/^sha256:[a-f0-9]{64}$/); expect(stored?.token).not.toContain(request.token);
      expect(await readPaypalPaymentStatus(identity)).toMatchObject({ paypalEmail: 'old@example.test', paypalEmailVerified: true, pendingPaypalEmail: 'new@example.test' });
      expect(await checkPaypalEmail({ ...identity, token: request.token }, false)).toEqual({ email: 'new@example.test' });
      expect((await readPaypalPaymentStatus(identity)).paypalEmail).toBe('old@example.test');
      await checkPaypalEmail({ ...identity, token: request.token }, true);
      expect(await readPaypalPaymentStatus(identity)).toMatchObject({ paypalEmail: 'new@example.test', paypalEmailVerified: true, pendingPaypalEmail: null });
      await expect(checkPaypalEmail({ ...identity, token: request.token }, true)).rejects.toThrow('expired');
    });
    it(`${target.target}: concurrent replay grants exactly one confirmation`, async () => {
      const request = await issue();
      const results = await Promise.allSettled(Array.from({ length: 6 }, () => checkPaypalEmail({ ...identity, token: request.token }, true)));
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      expect(await db.paypalVerificationToken.count()).toBe(0);
      expect((await readPaypalPaymentStatus(identity)).paypalEmail).toBe('new@example.test');
    });
    it(`${target.target}: stale mail cleanup and links cannot destroy or verify a newer request`, async () => {
      const stale = await issue('stale@example.test'), fresh = await issue('fresh@example.test');
      await discardPaypalEmailRequest(target.target, stale.entityId, stale.tokenHash);
      await expect(checkPaypalEmail({ ...identity, token: stale.token }, true)).rejects.toThrow('expired');
      await checkPaypalEmail({ ...identity, token: fresh.token }, true);
      expect((await readPaypalPaymentStatus(identity)).paypalEmail).toBe('fresh@example.test');
    });
    it(`${target.target}: rejects another account, another host, malformed and expired proof`, async () => {
      const request = await issue();
      for (const extra of [{ userId: 'qa-other' }, { origin: 'https://www.veggat.com' }, { token: '0'.repeat(64) }]) {
        await expect(checkPaypalEmail({ ...identity, token: request.token, ...extra }, true)).rejects.toThrow();
      }
      await db.paypalVerificationToken.updateMany({ data: { expires: new Date(0) } });
      await expect(checkPaypalEmail({ ...identity, token: request.token }, true)).rejects.toThrow('expired');
      expect((await readPaypalPaymentStatus(identity)).paypalEmail).toBe('old@example.test');
    });
    it(`${target.target}: stale forms cannot clear or overwrite reviewed values`, async () => {
      await issue();
      await expect(preparePaypalEmail({ ...identity, email: 'wrong@example.test', expectedEmail: null })).rejects.toThrow('changed');
      await expect(clearPaypalEmail({ ...identity, expectedEmail: 'old@example.test', expectedPendingEmail: null })).rejects.toThrow('changed');
      await clearPaypalEmail({ ...identity, expectedEmail: 'old@example.test', expectedPendingEmail: 'new@example.test' });
      expect(await readPaypalPaymentStatus(identity)).toMatchObject({ paypalEmail: null, paypalEmailVerified: false, pendingPaypalEmail: null });
    });
    it(`${target.target}: verification and removal serialize without resurrecting a cleared address`, async () => {
      const request = await issue();
      const results = await Promise.allSettled([
        clearPaypalEmail({ ...identity, expectedEmail: 'old@example.test', expectedPendingEmail: 'new@example.test' }),
        checkPaypalEmail({ ...identity, token: request.token }, true),
      ]);
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      expect(await db.paypalVerificationToken.count()).toBe(0);
      const status = await readPaypalPaymentStatus(identity);
      expect(status.paypalEmail).toBe(results[0].status === 'fulfilled' ? null : 'new@example.test');
    });
    it(`${target.target}: failure rolls back token consumption and destination together`, async () => {
      const request = await issue('blocked@example.test'); const table = target.target === 'user' ? 'User' : 'Company';
      await admin.query(`ALTER TABLE "${table}" ADD CONSTRAINT "qa_reject_email" CHECK ("paypalEmail" IS DISTINCT FROM 'blocked@example.test')`);
      try {
        await expect(checkPaypalEmail({ ...identity, token: request.token }, true)).rejects.toThrow();
        expect(await db.paypalVerificationToken.count()).toBe(1);
        expect((await readPaypalPaymentStatus(identity)).paypalEmail).toBe('old@example.test');
      } finally { await admin.query(`ALTER TABLE "${table}" DROP CONSTRAINT "qa_reject_email"`); }
    });
  }
  it('company transfer invalidates the former owner and their pending proof for the new owner', async () => {
    const identity = { target: 'company' as const, companyId, userId: 'qa-owner', origin: 'http://localhost:3000' };
    const request = await preparePaypalEmail({ ...identity, email: 'new@example.test', expectedEmail: 'old@example.test' });
    await admin.query('UPDATE "Company" SET "ownerId"=$1 WHERE "id"=$2', ['qa-other', companyId]);
    await expect(checkPaypalEmail({ ...identity, token: request.token }, true)).rejects.toThrow('owner');
    await expect(checkPaypalEmail({ ...identity, userId: 'qa-other', token: request.token }, true)).rejects.toThrow('expired');
    await expect(readPaypalPaymentStatus(identity)).rejects.toThrow('owner');
  });
  it('rejects demo and deleted identities before creating tokens', async () => {
    for (const userId of ['demo_fixture', 'missing']) await expect(preparePaypalEmail({ target: 'user', userId, origin: 'http://localhost:3000', email: 'qa@example.test', expectedEmail: null })).rejects.toThrow();
    expect(await db.paypalVerificationToken.count()).toBe(0);
  });
});
