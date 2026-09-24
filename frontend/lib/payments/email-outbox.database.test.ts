/** @fileOverview Opt-in outbox lease/replay tests in an isolated, disposable PG schema. @stability stable */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { previewDatabaseUrl } from '@/lib/preview-database';
vi.mock('server-only', () => ({}));
import { queueTransactionEmail } from './email-outbox';
import { dispatchTransactionEmail } from './email-dispatch';

describe.skipIf(process.env.TEST_EMAIL_DATABASE !== '1')('transaction mail: real Postgres concurrency', () => {
  const schema = `qa_email_${randomUUID().replaceAll('-', '')}`;
  let admin: Client, db: PrismaClient;
  const recipient = 'qa-email@example.com';
  const input = { sourceKey: 'purchase:order1', userId: 'qa-buyer', orderId: 'order1', kind: 'PURCHASE' as const,
    paymentEnvironment: 'SANDBOX', subject: 'Isolated mail fixture', filename: 'veggat-order-order1.txt', original: 'QA fixture, no purchase or email.' };
  beforeAll(async () => {
    vi.stubEnv('VERCEL_ENV', 'preview'); vi.stubEnv('TRANSACTIONAL_EMAIL_ENABLED', 'true');
    vi.stubEnv('TRANSACTIONAL_EMAIL_TEST_RECIPIENTS', recipient); vi.stubEnv('RESEND_API_KEY', 're_fixture_no_real_network_allowed');
    const connectionString = previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: process.env.DATABASE_URL_MAINPREVIEW, DATABASE_URL_MAINLIVE: process.env.DATABASE_URL_MAINLIVE });
    const direct = new URL(connectionString); direct.hostname = direct.hostname.replace('-pooler.', '.');
    admin = new Client({ connectionString: direct.toString() }); await admin.connect();
    if (!/^qa_email_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe QA schema');
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(await readFile(new URL('../../prisma/migrations/20260924000700_transactional_email_outbox/migration.sql', import.meta.url), 'utf8'));
    await admin.query('CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "email" TEXT, "emailVerified" TIMESTAMP(3)); CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "userId" TEXT)');
    await admin.query('INSERT INTO "User" VALUES ($1, $2, now())', ['qa-buyer', recipient]);
    await admin.query('INSERT INTO "Order" VALUES ($1, $2)', ['order1', 'qa-buyer']);
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 12 }, { schema }) });
  }, 30_000);
  afterAll(async () => {
    vi.unstubAllEnvs(); await db?.$disconnect();
    if (admin && /^qa_email_[a-f0-9]{32}$/.test(schema)) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end();
    }
  });
  it('concurrent source replays create one immutable message; a rolled-back transaction creates none', async () => {
    await Promise.all(Array.from({ length: 8 }, () => db.$transaction(tx => queueTransactionEmail(tx, input))));
    expect(await db.transactionalEmail.count()).toBe(1);
    const before = await db.transactionalEmail.findUniqueOrThrow({ where: { sourceKey: input.sourceKey } });
    await db.$transaction(tx => queueTransactionEmail(tx, { ...input, original: 'Must not overwrite original' }));
    expect((await db.transactionalEmail.findUniqueOrThrow({ where: { sourceKey: input.sourceKey } })).payload).toEqual(before.payload);
    await expect(db.$transaction(async tx => {
      await queueTransactionEmail(tx, { ...input, sourceKey: 'rolled-back' }); throw new Error('Transaction rolled back');
    })).rejects.toThrow('Transaction rolled back');
    expect(await db.transactionalEmail.count()).toBe(1);
  }, 30_000);
  it('eight competing workers send once, then confirm delivery without another POST', async () => {
    const message = await db.transactionalEmail.findUniqueOrThrow({ where: { sourceKey: input.sourceKey } });
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: 'fixture-provider-id' })));
    const now = new Date();
    await Promise.all(Array.from({ length: 8 }, () => dispatchTransactionEmail(db, message.id, transport, now)));
    expect(transport).toHaveBeenCalledOnce();
    expect(await db.transactionalEmail.findUniqueOrThrow({ where: { id: message.id } })).toMatchObject({ status: 'ACCEPTED', attempts: 1, providerId: 'fixture-provider-id' });
    transport.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'fixture-provider-id', to: [recipient], last_event: 'delivered' })));
    await dispatchTransactionEmail(db, message.id, transport, new Date(now.getTime() + 61_000));
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[1][1]?.method).toBe('GET');
    expect((await db.transactionalEmail.findUniqueOrThrow({ where: { id: message.id } })).status).toBe('DELIVERED');
  }, 30_000);
});
