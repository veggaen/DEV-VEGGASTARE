/** @fileOverview Real seller-inbox SQL boundaries in a disposable isolated-Preview schema. @stability stable */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { previewDatabaseUrl } from '@/lib/preview-database';
vi.mock('server-only', () => ({}));
const runtime = vi.hoisted(() => ({ db: undefined as unknown, user: { id: 'seller', role: 'USER', isDemo: false } }));
vi.mock('@/lib/db', () => ({ get dbPrisma() { return runtime.db; } }));
vi.mock('@/auth', () => ({ auth: async () => ({ user: runtime.user }) }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: async () => ({ success: true }), getClientIdentifier: () => 'qa', rateLimitedResponse: () => new Response(null, { status: 429 }) }));
import { GET } from '@/app/api/seller/returns/route';

describe.skipIf(process.env.TEST_SELLER_REVIEW_DATABASE !== '1')('seller inbox: real isolated Postgres', () => {
  const schema = `qa_seller_review_${randomUUID().replaceAll('-', '')}`;
  let admin: Client, db: PrismaClient;
  beforeAll(async () => {
    const url = new URL(previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: process.env.DATABASE_URL_MAINPREVIEW, DATABASE_URL_MAINLIVE: process.env.DATABASE_URL_MAINLIVE }));
    url.searchParams.set('sslmode', 'verify-full'); url.searchParams.delete('uselibpqcompat');
    const direct = new URL(url); direct.hostname = direct.hostname.replace('-pooler.', '.');
    admin = new Client({ connectionString: direct.toString() }); await admin.connect();
    if (!/^qa_seller_review_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe test schema');
    await admin.query(`CREATE SCHEMA "${schema}"`); await admin.query(`SET search_path TO "${schema}"`);
    for (const type of ['OrderStatus', 'ReturnReason', 'ReturnRequestStatus', 'EmployeeRole']) {
      const labels = await admin.query<{ label: string }>('SELECT enumlabel AS label FROM pg_enum WHERE enumtypid = $1::regtype ORDER BY enumsortorder', [`public."${type}"`]);
      if (!labels.rows.length || labels.rows.some(row => !/^[A-Z0-9_]+$/.test(row.label))) throw new Error('Unexpected enum');
      await admin.query(`CREATE TYPE "${type}" AS ENUM (${labels.rows.map(row => `'${row.label}'`).join(',')})`);
    }
    // Synthetic geometry only, no customer rows, grants or provider credentials.
    await admin.query(`
      CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 29, "currency" TEXT DEFAULT 'NOK', "status" "OrderStatus" NOT NULL DEFAULT 'COMPLETED');
      CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "companyId" TEXT);
      CREATE TABLE "OrderItem" ("id" TEXT PRIMARY KEY, "orderId" TEXT, "productId" TEXT, "title" TEXT NOT NULL DEFAULT 'Synthetic QA file', "quantity" INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE "Employee" ("id" TEXT PRIMARY KEY, "userId" TEXT, "companyId" TEXT, "role" "EmployeeRole");
      CREATE TABLE "ReturnRequest" ("id" TEXT PRIMARY KEY, "orderId" TEXT, "userId" TEXT DEFAULT 'buyer', "reason" "ReturnReason" NOT NULL DEFAULT 'DEFECTIVE',
        "description" TEXT DEFAULT 'Synthetic isolated notice', "status" "ReturnRequestStatus" NOT NULL DEFAULT 'PENDING', "sellerNote" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(), "processedBy" TEXT, "processedAt" TIMESTAMP(3));
      CREATE TABLE "CheckoutAttempt" ("orderId" TEXT PRIMARY KEY, "environment" TEXT, "state" TEXT, "captureId" TEXT, "refundReference" TEXT, "quote" JSONB);
      CREATE TABLE "DownloadToken" ("orderId" TEXT, "usedCount" INTEGER NOT NULL DEFAULT 0);
      INSERT INTO "Order" ("id") VALUES ('owned'), ('managed'), ('mixed'), ('foreign'), ('empty'), ('employee-only');
      INSERT INTO "Product" VALUES ('own-product','seller',NULL), ('managed-product','different','company-one'), ('foreign-product','other-seller',NULL), ('employee-product','different','company-two');
      INSERT INTO "Employee" VALUES ('qa-manager','seller','company-one','MANAGER'), ('qa-staff','seller','company-two','STAFF');
      INSERT INTO "OrderItem" ("id","orderId","productId") VALUES ('i1','owned','own-product'), ('i2','managed','managed-product'), ('i3','mixed','own-product'), ('i4','mixed','foreign-product'), ('i5','foreign','foreign-product'), ('i6','employee-only','employee-product');
      INSERT INTO "ReturnRequest" ("id","orderId") SELECT 'request-' || "id", "id" FROM "Order";
      INSERT INTO "DownloadToken" VALUES ('owned',1), ('owned',2);
    `);
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 10 }, { schema }), log: ['error'] }); runtime.db = db;
  }, 30_000);
  beforeEach(() => { runtime.user = { id: 'seller', role: 'USER', isDemo: false }; });
  afterAll(async () => {
    await db?.$disconnect();
    if (admin && /^qa_seller_review_[a-f0-9]{32}$/.test(schema)) { await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end(); }
  });
  async function list(query = '') {
    const response = await GET(new Request(`http://localhost:3000/api/seller/returns${query}`));
    expect(response.status).toBe(200); return response.json();
  }
  it('actual relation filters exclude mixed sellers, non-managers, foreign and empty orders', async () => {
    const data = await list();
    expect(data.requests.map((row: { orderId: string }) => row.orderId).sort()).toEqual(['managed', 'owned']);
    expect(data.requests.find((row: { orderId: string }) => row.orderId === 'owned').order.downloadRequests).toBe(3);
    expect((await list('?id=request-mixed&status=ALL')).requests).toEqual([]);
  });
  it('revoked company roles disappear on the next authorized read', async () => {
    await admin.query('UPDATE "Employee" SET "role" = \'STAFF\' WHERE "companyId" = \'company-one\'');
    expect((await list()).requests.map((row: { orderId: string }) => row.orderId)).toEqual(['owned']);
  });
  it('admin sees nonempty orders only; demo still sees none', async () => {
    runtime.user.role = 'ADMIN'; expect((await list()).requests).toHaveLength(5);
    runtime.user.isDemo = true; expect(await list()).toMatchObject({ requests: [], readOnly: true });
  });
  it('the tested compare-and-swap statement allows one of eight decisions, without altering the order', async () => {
    const original = await db.returnRequest.findUniqueOrThrow({ where: { id: 'request-owned' }, select: { updatedAt: true } });
    const results = await Promise.all(Array.from({ length: 8 }, () => db.returnRequest.updateMany({
      where: { id: 'request-owned', status: 'PENDING', updatedAt: original.updatedAt },
      data: { status: 'APPROVED', sellerNote: 'QA review only, no payment', processedBy: 'seller', processedAt: new Date() },
    })));
    expect(results.reduce((sum, result) => sum + result.count, 0)).toBe(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: 'owned' }, select: { status: true } })).status).toBe('COMPLETED');
  }, 30_000);
});
