/** @fileOverview Real sales relation/grouping SQL in a disposable Preview-only schema. @stability stable */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { previewDatabaseUrl } from '@/lib/preview-database';
import { SellerOrderList } from './seller-orders';
vi.mock('server-only', () => ({}));
const runtime = vi.hoisted(() => ({ db: undefined as unknown, user: { id: 'seller', role: 'USER', isDemo: false } }));
vi.mock('@/lib/db', () => ({ get dbPrisma() { return runtime.db; } }));
vi.mock('@/auth', () => ({ auth: async () => ({ user: runtime.user }) }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: async () => ({ success: true }), getClientIdentifier: () => 'qa', rateLimitedResponse: () => new Response(null, { status: 429 }) }));
import { GET } from '@/app/api/seller/orders/route';

describe.skipIf(process.env.TEST_SALES_DATABASE !== '1')('personal sales: actual isolated SQL', () => {
  const schema = `qa_sales_${randomUUID().replaceAll('-', '')}`;
  let admin: Client, db: PrismaClient;
  beforeAll(async () => {
    const url = new URL(previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: process.env.DATABASE_URL_MAINPREVIEW, DATABASE_URL_MAINLIVE: process.env.DATABASE_URL_MAINLIVE }));
    url.searchParams.set('sslmode', 'verify-full'); url.searchParams.delete('uselibpqcompat');
    const direct = new URL(url); direct.hostname = direct.hostname.replace('-pooler.', '.');
    admin = new Client({ connectionString: direct.toString() }); await admin.connect();
    if (!/^qa_sales_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe test schema');
    await admin.query(`CREATE SCHEMA "${schema}"`); await admin.query(`SET search_path TO "${schema}"`);
    for (const type of ['OrderStatus', 'FulfilmentStatus', 'EmployeeRole', 'PaymentMethod', 'PaymentStatus', 'ProductType', 'EmailDisplayMode']) {
      const labels = await admin.query<{ label: string }>('SELECT enumlabel AS label FROM pg_enum WHERE enumtypid = $1::regtype ORDER BY enumsortorder', [`public."${type}"`]);
      if (!labels.rows.length || labels.rows.some(row => !/^[A-Z0-9_]+$/.test(row.label))) throw new Error('Unexpected enum');
      await admin.query(`CREATE TYPE "${type}" AS ENUM (${labels.rows.map(row => `'${row.label}'`).join(',')})`);
    }
    await admin.query(`
      CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "name" TEXT, "email" TEXT, "emailDisplayMode" "EmailDisplayMode");
      CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "userId" TEXT, "currency" TEXT DEFAULT 'NOK', "status" "OrderStatus" DEFAULT 'COMPLETED', "fulfilmentStatus" "FulfilmentStatus" DEFAULT 'UNFULFILLED', "createdAt" TIMESTAMP(3) DEFAULT now(),
        "shippingName" TEXT, "shippingAddress" TEXT, "shippingCity" TEXT, "shippingPostalCode" TEXT, "shippingCountry" TEXT, "trackingNumber" TEXT, "trackingUrl" TEXT, "labelUrl" TEXT);
      CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "companyId" TEXT, "productType" "ProductType" DEFAULT 'DIGITAL');
      CREATE TABLE "OrderItem" ("id" TEXT PRIMARY KEY, "orderId" TEXT, "productId" TEXT, "title" TEXT DEFAULT 'Synthetic file', "quantity" INTEGER DEFAULT 1, "priceAtTime" DOUBLE PRECISION DEFAULT 29);
      CREATE TABLE "Employee" ("id" TEXT PRIMARY KEY, "userId" TEXT, "companyId" TEXT, "role" "EmployeeRole");
      CREATE TABLE "Payment" ("id" TEXT PRIMARY KEY, "orderId" TEXT, "method" "PaymentMethod" DEFAULT 'PAYPAL', "status" "PaymentStatus" DEFAULT 'COMPLETED',
        "receiverAddress" TEXT, "senderAddress" TEXT, "transactionId" TEXT, "chainFamily" TEXT, "chainId" INTEGER, "tokenSymbol" TEXT, "nativeAmount" TEXT);
      CREATE TABLE "CheckoutAttempt" ("orderId" TEXT PRIMARY KEY, "environment" TEXT, "state" TEXT);
      INSERT INTO "User" VALUES ('buyer', 'Synthetic buyer', 'hidden@example.invalid', 'HIDE');
      INSERT INTO "Order" ("id","userId") VALUES ('own','buyer'), ('owned-company','buyer'), ('mixed','buyer'), ('foreign','buyer'), ('empty','buyer'), ('staff-only','buyer');
      UPDATE "Order" SET "fulfilmentStatus"='SHIPPED' WHERE "id"='owned-company';
      INSERT INTO "Product" ("id","userId","companyId") VALUES ('p-own','seller',NULL), ('p-company','other','company-one'), ('p-foreign','other',NULL), ('p-staff','other','company-two');
      INSERT INTO "Employee" VALUES ('e1','seller','company-one','OWNER'), ('e2','seller','company-two','STAFF');
      INSERT INTO "OrderItem" ("id","orderId","productId") VALUES ('i1','own','p-own'), ('i2','owned-company','p-company'), ('i3','mixed','p-own'), ('i4','mixed','p-foreign'), ('i5','foreign','p-foreign'), ('i6','staff-only','p-staff');
      INSERT INTO "Payment" ("id","orderId","receiverAddress","transactionId") VALUES ('pay-own','own','own-seller@example.invalid','own-capture'), ('pay-mixed','mixed','foreign-seller@example.invalid','mixed-capture');
      INSERT INTO "CheckoutAttempt" VALUES ('own','SANDBOX','REFUNDED');
    `);
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 4 }, { schema }), log: ['error'] }); runtime.db = db;
  }, 30_000);
  beforeEach(() => { runtime.user = { id: 'seller', role: 'USER', isDemo: false }; });
  afterAll(async () => {
    await db?.$disconnect();
    if (admin && /^qa_sales_[a-f0-9]{32}$/.test(schema)) { await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end(); }
  });
  async function list(query = '') {
    const response = await GET(new Request(`http://localhost:3000/api/seller/orders${query}`));
    expect(response.status).toBe(200); const data = await response.json(); expect(SellerOrderList.safeParse(data).success).toBe(true); return data;
  }
  it('filters rows/items and grouped counts using the same actual relation scope', async () => {
    const data = await list(); expect(data.orders.map((row: { id: string }) => row.id).sort()).toEqual(['mixed', 'own', 'owned-company']);
    expect(data.counts).toMatchObject({ ALL: 3, UNFULFILLED: 2, SHIPPED: 1 });
    const mixed = data.orders.find((row: { id: string }) => row.id === 'mixed');
    expect(mixed).toMatchObject({ sellerTotal: 29, sharedOrder: true, payment: null }); expect(mixed.items).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain('foreign-seller@example.invalid'); expect(JSON.stringify(data)).not.toContain('hidden@example.invalid');
    expect(data.orders.find((row: { id: string }) => row.id === 'own').payment.state).toBe('REFUNDED');
  });
  it('paginates deterministically and keeps all-status counts with a filter', async () => {
    const first = await list('?limit=1'), second = await list('?limit=1&page=2');
    expect(first.orders[0].id).not.toBe(second.orders[0].id); expect(first.pagination.totalPages).toBe(3);
    const shipped = await list('?fulfilmentStatus=SHIPPED'); expect(shipped.orders.map((row: { id: string }) => row.id)).toEqual(['owned-company']);
    expect(shipped.counts.ALL).toBe(3); expect(shipped.pagination.total).toBe(1);
  });
  it('role revocation takes effect on the next read; admin remains personal', async () => {
    await admin.query('UPDATE "Employee" SET "role"=\'STAFF\' WHERE "id"=\'e1\'');
    expect((await list()).counts.ALL).toBe(2); runtime.user.role = 'ADMIN'; expect((await list()).counts.ALL).toBe(2);
  });
  it('demo never sees real orders even with a privileged role', async () => {
    runtime.user = { id: 'seller', role: 'ADMIN', isDemo: true }; expect(await list()).toMatchObject({ readOnly: true, orders: [], counts: { ALL: 0 } });
  });
});
