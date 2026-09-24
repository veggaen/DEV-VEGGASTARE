/** @fileOverview Opt-in real concurrency tests in a disposable isolated-Preview schema. @stability stable */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { previewDatabaseUrl } from '@/lib/preview-database';
vi.mock('server-only', () => ({}));
import { createBuyerRequest } from './create-return-request';

describe.skipIf(process.env.TEST_BUYER_REQUEST_DATABASE !== '1')('buyer notices: real Postgres concurrency', () => {
  const schema = `qa_buyer_requests_${randomUUID().replaceAll('-', '')}`;
  let admin: Client, db: PrismaClient;
  beforeAll(async () => {
    const connectionString = previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: process.env.DATABASE_URL_MAINPREVIEW,
      DATABASE_URL_MAINLIVE: process.env.DATABASE_URL_MAINLIVE });
    const direct = new URL(connectionString);
    direct.hostname = direct.hostname.replace('-pooler.', '.');
    admin = new Client({ connectionString: direct.toString() }); await admin.connect();
    if (!/^qa_buyer_requests_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe QA schema');
    await admin.query(`CREATE SCHEMA "${schema}"`);
    for (const type of ['OrderStatus', 'FulfilmentStatus', 'ReturnReason', 'ReturnRequestStatus']) {
      const labels = await admin.query<{ label: string }>('SELECT enumlabel AS label FROM pg_enum WHERE enumtypid = $1::regtype ORDER BY enumsortorder', [`public."${type}"`]);
      if (!labels.rows.length || labels.rows.some(row => !/^[A-Z0-9_]+$/.test(row.label))) throw new Error('Unexpected enum definition');
      await admin.query(`CREATE TYPE "${schema}"."${type}" AS ENUM (${labels.rows.map(row => `'${row.label}'`).join(',')})`);
    }
    // Copies geometry/defaults, not rows or foreign keys. No public-table write.
    await admin.query(`CREATE TABLE "${schema}"."Order" (LIKE public."Order" INCLUDING ALL)`);
    await admin.query(`CREATE TABLE "${schema}"."ReturnRequest" (LIKE public."ReturnRequest" INCLUDING ALL)`);
    for (const [table, column, type, defaultValue] of [
      ['Order', 'status', 'OrderStatus', 'PENDING'], ['Order', 'fulfilmentStatus', 'FulfilmentStatus', 'UNFULFILLED'],
      ['ReturnRequest', 'reason', 'ReturnReason', ''], ['ReturnRequest', 'status', 'ReturnRequestStatus', 'PENDING'],
    ]) {
      await admin.query(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${column}" DROP DEFAULT,
        ALTER COLUMN "${column}" TYPE "${schema}"."${type}" USING "${column}"::text::"${schema}"."${type}"`);
      if (defaultValue) await admin.query(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${column}" SET DEFAULT '${defaultValue}'::"${schema}"."${type}"`);
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 12 }, { schema }) });
  }, 30_000);
  afterAll(async () => {
    await db?.$disconnect();
    if (admin && /^qa_buyer_requests_[a-f0-9]{32}$/.test(schema)) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end();
    }
  });
  async function order(id: string) {
    await db.order.create({ data: { id, userId: 'qa-buyer', totalAmount: 29, currency: 'NOK', status: 'COMPLETED', fulfilmentStatus: 'DELIVERED' } });
  }
  it('eight simultaneous submissions create exactly one pending notice', async () => {
    await order('concurrent');
    const input = { orderId: 'concurrent', reason: 'CHANGED_MIND' as const, description: '' };
    const results = await Promise.all(Array.from({ length: 8 }, () => createBuyerRequest(db, 'qa-buyer', input)));
    expect(results.filter(result => !result.duplicate)).toHaveLength(1);
    expect(new Set(results.map(result => result.record.id)).size).toBe(1);
    expect(await db.returnRequest.count({ where: { orderId: 'concurrent' } })).toBe(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: 'concurrent' } })).status).toBe('COMPLETED');
  }, 30_000);
  it('does not overwrite conflicting messages and permits a separate withdrawal after a defect notice', async () => {
    await order('separate');
    await createBuyerRequest(db, 'qa-buyer', { orderId: 'separate', reason: 'DEFECTIVE', description: 'Original defect' });
    await expect(createBuyerRequest(db, 'qa-buyer', { orderId: 'separate', reason: 'DEFECTIVE', description: 'Overwrite' })).rejects.toMatchObject({ status: 409 });
    await createBuyerRequest(db, 'qa-buyer', { orderId: 'separate', reason: 'CHANGED_MIND' });
    expect(await db.returnRequest.count({ where: { orderId: 'separate' } })).toBe(2);
    expect((await db.returnRequest.findFirstOrThrow({ where: { orderId: 'separate', reason: 'DEFECTIVE' } })).description).toBe('Original defect');
  });
  it('retains the original notice across a verified order cancellation and refuses a new claim type', async () => {
    await db.order.update({ where: { id: 'concurrent' }, data: { status: 'CANCELLED' } });
    const retry = await createBuyerRequest(db, 'qa-buyer', { orderId: 'concurrent', reason: 'CHANGED_MIND' });
    expect(retry.duplicate).toBe(true);
    await expect(createBuyerRequest(db, 'qa-buyer', { orderId: 'concurrent', reason: 'OTHER' })).rejects.toMatchObject({ status: 409 });
    await expect(createBuyerRequest(db, 'another-buyer', { orderId: 'concurrent', reason: 'CHANGED_MIND' })).rejects.toMatchObject({ status: 404 });
  });
});
