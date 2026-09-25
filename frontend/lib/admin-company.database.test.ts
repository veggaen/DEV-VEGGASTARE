import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { previewDatabaseUrl } from './preview-database';
const state = vi.hoisted(() => ({ db: null as unknown, actor: { id: 'qa-owner', role: 'OWNER', sessionVersion: 3 } }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ get dbPrisma() { return state.db; } }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: async () => state.actor }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: async () => true, allowAdminDetailRead: async () => true }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: async () => ({ success: true }) }));
import { adminCompanyDetail } from './admin-company';
import { companyCheckoutCounts } from './company-checkout-counts';

describe.skipIf(process.env.TEST_ADMIN_COMPANY_DATABASE !== '1')('isolated company edit transactions', () => {
  const schema = `qa_admin_company_${randomUUID().replaceAll('-', '')}`;
  let admin: Client, db: PrismaClient;
  beforeAll(async () => {
    const url = new URL(previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: process.env.DATABASE_URL_MAINPREVIEW, DATABASE_URL_MAINLIVE: process.env.DATABASE_URL_MAINLIVE }));
    url.hostname = url.hostname.replace('-pooler.', '.'); url.searchParams.set('sslmode', 'verify-full');
    admin = new Client({ connectionString: url.toString() }); await admin.connect();
    if (!/^qa_admin_company_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid disposable schema');
    await admin.query(`CREATE SCHEMA "${schema}"`); await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(`CREATE TYPE "UserRole" AS ENUM ('OWNER','ADMIN','USER');
      CREATE TABLE "User" ("id" TEXT PRIMARY KEY,"role" "UserRole","tokenVersion" INTEGER);
      CREATE TABLE "Company" ("id" TEXT PRIMARY KEY,"name" TEXT NOT NULL,"description" TEXT,"websiteUrl" TEXT,"logo" TEXT[] NOT NULL DEFAULT '{}',"bannerImage" TEXT[] NOT NULL DEFAULT '{}',"colorScheme" TEXT,"usesShipping" BOOLEAN DEFAULT false,"updatedAt" TIMESTAMP(3) DEFAULT now());
      CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "companyId" TEXT);
      CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "userId" TEXT, "status" TEXT DEFAULT 'COMPLETED');
      CREATE TABLE "OrderItem" ("id" TEXT PRIMARY KEY, "productId" TEXT, "orderId" TEXT, "quantity" INT DEFAULT 1);
      CREATE TABLE "CheckoutAttempt" ("orderId" TEXT PRIMARY KEY, "userId" TEXT DEFAULT 'buyer', "environment" TEXT DEFAULT 'LIVE',
        "state" TEXT DEFAULT 'COMPLETED', "completedAt" TIMESTAMP DEFAULT now(), "paymentAdjustedAt" TIMESTAMP,
        "refundedOre" INT DEFAULT 0, "totalOre" INT DEFAULT 900, "currency" TEXT DEFAULT 'NOK', "captureId" TEXT,
        "paypalOrderId" TEXT DEFAULT 'qa-provider-order', "merchantId" TEXT DEFAULT 'qa-merchant');
      CREATE TYPE "AdminAction" AS ENUM ('VIEW','EDIT'); CREATE TYPE "AdminTargetType" AS ENUM ('COMPANY');
      CREATE TABLE "AdminAuditLog" ("id" TEXT PRIMARY KEY,"adminId" TEXT,"action" "AdminAction","targetType" "AdminTargetType","targetId" TEXT,
        "previousData" JSONB,"newData" JSONB,"ipAddress" TEXT,"userAgent" TEXT,"reason" TEXT,"createdAt" TIMESTAMP(3) DEFAULT now(),"updatedAt" TIMESTAMP(3) DEFAULT now());
      INSERT INTO "User" ("id","role","tokenVersion") VALUES ('qa-owner','OWNER',3);
      INSERT INTO "Company" ("id","name") VALUES ('qa-company','QA Company');`);
    url.searchParams.set('options', `-c search_path=${schema}`);
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 5 }, { schema }) }); state.db = db;
    expect((await db.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`)[0].current_schema).toBe(schema);
  }, 30000);
  beforeEach(async () => {
    state.actor = { id: 'qa-owner', role: 'OWNER', sessionVersion: 3 };
    await admin.query(`UPDATE "User" SET "role"='OWNER',"tokenVersion"=3; UPDATE "Company" SET "name"='QA Company',"logo"='{}',"usesShipping"=false; DELETE FROM "AdminAuditLog";`);
    await admin.query(`DELETE FROM "OrderItem"; DELETE FROM "CheckoutAttempt"; DELETE FROM "Order"; DELETE FROM "Product";
      INSERT INTO "Product" ("id","companyId") VALUES ('a','qa-company'),('b','qa-company'),('other','other-company'),('personal',NULL);`);
  });
  afterAll(async () => { await db?.$disconnect(); if (admin && /^qa_admin_company_[a-f0-9]{32}$/.test(schema)) { await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end(); } });
  const target = () => db.company.findUniqueOrThrow({ where: { id: 'qa-company' }, select: { id: true, name: true, logo: true, usesShipping: true, updatedAt: true } });
  const edit = (expectedUpdatedAt: string, patch: object) => adminCompanyDetail(new Request('http://localhost:3000/api/admin/companies/qa-company', {
    method: 'PATCH', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt, reason: 'Disposable company transaction QA', ...patch }),
  }), 'qa-company', 'PATCH');
  const counts = (ids = ['qa-company']) => db.$transaction(tx => companyCheckoutCounts(tx, ids), { isolationLevel: 'RepeatableRead' });
  const capture = async (id: string, products = ['a']) => {
    await admin.query('INSERT INTO "Order" ("id","userId") VALUES ($1,\'buyer\');', [id]);
    await admin.query('INSERT INTO "CheckoutAttempt" ("orderId","captureId") VALUES ($1,$2)', [id, 'capture-' + id]);
    for (const [index, product] of products.entries()) await admin.query('INSERT INTO "OrderItem" ("id","orderId","productId") VALUES ($1,$2,$3)', [id + '-' + index, id, product]);
  };
  it('counts distinct verified orders for each scoped company, not item quantity or unrelated products', async () => {
    await capture('mixed', ['a','b','a','other']); await capture('foreign', ['other']); await capture('solo', ['personal']);
    await admin.query('UPDATE "OrderItem" SET "quantity"=7 WHERE "orderId"=\'mixed\'');
    const actual = await counts(['qa-company', 'other-company', 'empty-company']);
    expect(actual.get('qa-company')).toEqual({ livePaid: 1, liveAdjusted: 0, liveReview: 0, sandbox: 0 });
    expect(actual.get('other-company')?.livePaid).toBe(2); expect(actual.get('empty-company')?.livePaid).toBe(0);
    expect(actual.size).toBe(3);
  }, 30000);
  it('excludes demo, unpaid, unverified, mismatched and invalid proof without treating legacy completion as payment', async () => {
    const invalid = [
      `"environment"='DEMO'`, `"environment"='UNKNOWN'`, `"state"='PREPARED'`, `"state"='CAPTURE_PENDING'`,
      `"state"='CANCELLED'`, `"captureId"=NULL`, `"captureId"=''`, `"completedAt"=NULL`,
      `"totalOre"=0`, `"totalOre"=-1`, `"refundedOre"=1`, `"currency"='USD'`, `"userId"='different-buyer'`,
      `"paypalOrderId"=NULL`, `"merchantId"=NULL`, `"paypalOrderId"=''`, `"merchantId"=''`, `"refundedOre"=-1`,
    ];
    for (const [index, set] of invalid.entries()) { await capture('invalid-' + index); await admin.query(`UPDATE "CheckoutAttempt" SET ${set} WHERE "orderId"=$1`, ['invalid-' + index]); }
    await capture('demo'); await admin.query(`UPDATE "Order" SET "userId"='demo_buyer' WHERE "id"='demo'; UPDATE "CheckoutAttempt" SET "userId"='demo_buyer' WHERE "orderId"='demo'`);
    await capture('pending'); await admin.query(`UPDATE "Order" SET "status"='PENDING' WHERE "id"='pending'`);
    await capture('legacy'); await admin.query(`DELETE FROM "CheckoutAttempt" WHERE "orderId"='legacy'`);
    await capture('empty-item'); await admin.query(`UPDATE "OrderItem" SET "quantity"=0 WHERE "orderId"='empty-item'`);
    await capture('valid'); expect((await counts()).get('qa-company')).toEqual({ livePaid: 1, liveAdjusted: 0, liveReview: 0, sandbox: 0 });
  }, 60000);
  it('separates live refunds, reversals and partial-payment review from sandbox captures, including refund-before-fulfilment', async () => {
    for (const environment of ['LIVE','SANDBOX']) for (const state of ['COMPLETED','REFUNDED','REVERSED','PAYMENT_REVIEW']) {
      const id = environment + state; await capture(id);
      await admin.query('UPDATE "CheckoutAttempt" SET "environment"=$1,"state"=$2,"paymentAdjustedAt"=now(),"completedAt"=CASE WHEN $2=\'COMPLETED\' THEN now() ELSE NULL END WHERE "orderId"=$3', [environment,state,id]);
      await admin.query('UPDATE "Order" SET "status"=$1 WHERE "id"=$2', [state === 'COMPLETED' ? 'COMPLETED' : state === 'PAYMENT_REVIEW' ? 'CONFIRMING' : 'CANCELLED',id]);
    }
    await capture('unverified-adjustment'); await admin.query(`UPDATE "CheckoutAttempt" SET "state"='REFUNDED' WHERE "orderId"='unverified-adjustment'; UPDATE "Order" SET "status"='CANCELLED' WHERE "id"='unverified-adjustment'`);
    expect((await counts()).get('qa-company')).toEqual({ livePaid: 1, liveAdjusted: 2, liveReview: 1, sandbox: 4 });
  }, 30000);
  it('is read-only, parameterized and follows explicitly current product links', async () => {
    await capture('paid');
    const before = (await admin.query('SELECT * FROM "CheckoutAttempt" ORDER BY "orderId"')).rows;
    expect((await counts()).get('qa-company')?.livePaid).toBe(1);
    expect((await counts([`qa-company') OR true --`])).get(`qa-company') OR true --`)?.livePaid).toBe(0);
    await admin.query(`UPDATE "Product" SET "companyId"='other-company' WHERE "id"='a'`);
    expect((await counts(['qa-company','other-company'])).get('qa-company')?.livePaid).toBe(0);
    expect((await admin.query('SELECT * FROM "CheckoutAttempt" ORDER BY "orderId"')).rows).toEqual(before);
  }, 30000);
  it('returns no-query empty scopes and refuses oversized reporting scopes', async () => {
    expect((await counts([])).size).toBe(0);
    await expect(counts(Array.from({length:101},(_,i)=>'company-'+i))).rejects.toThrow('Invalid company count scope');
  });
  it('commits typed arrays and exact audit together; replay cannot update twice', async () => {
    const before = await target(); expect((await edit(before.updatedAt.toISOString(), { name: 'Changed', logo: ['https://example.test/logo.png'], usesShipping: true })).status).toBe(200);
    expect(await target()).toMatchObject({ name: 'Changed', logo: ['https://example.test/logo.png'], usesShipping: true });
    const audit = await db.adminAuditLog.findFirstOrThrow(); expect(audit).toMatchObject({ action: 'EDIT', previousData: { name: 'QA Company', logo: [], usesShipping: false }, newData: { name: 'Changed', logo: ['https://example.test/logo.png'], usesShipping: true } });
    expect((await edit(before.updatedAt.toISOString(), { name: 'Again' })).status).toBe(409); expect(await db.adminAuditLog.count()).toBe(1);
  }, 30000);
  it('rolls back all company changes if audit insertion fails', async () => {
    const before = await target(); await admin.query('ALTER TABLE "AdminAuditLog" RENAME TO "AuditUnavailable"');
    try { expect((await edit(before.updatedAt.toISOString(), { name: 'Must roll back' })).status).toBe(503); }
    finally { await admin.query('ALTER TABLE "AuditUnavailable" RENAME TO "AdminAuditLog"'); }
    expect(await target()).toEqual(before); expect(await db.adminAuditLog.count()).toBe(0);
  }, 30000);
  it('serializes simultaneous edits from the same reviewed version', async () => {
    const before = await target();
    const responses = await Promise.all([edit(before.updatedAt.toISOString(), { name: 'First' }), edit(before.updatedAt.toISOString(), { name: 'Second' })]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]); expect(await db.adminAuditLog.count()).toBe(1);
    const audit = await db.adminAuditLog.findFirstOrThrow(); expect((await target()).name).toBe((audit.newData as { name: string }).name);
  }, 30000);
  it('sees revocation committed while an edit waits for the actor lock', async () => {
    const before = await target(); await admin.query('BEGIN'); await admin.query('UPDATE "User" SET "tokenVersion"=4 WHERE "id"=\'qa-owner\'');
    let finished = false; const pending = edit(before.updatedAt.toISOString(), { name: 'Unauthorized' }).then(result => { finished = true; return result; });
    try { await new Promise(resolve => setTimeout(resolve, 150)); expect(finished).toBe(false); } finally { await admin.query('COMMIT'); }
    expect((await pending).status).toBe(401); expect(await target()).toEqual(before); expect(await db.adminAuditLog.count()).toBe(0);
  }, 30000);
});
