/** @fileOverview Isolated Postgres migration and capture/cancel compare-and-set race checks. @stability stable */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { previewDatabaseUrl } from '../preview-database';

describe.skipIf(process.env.TEST_CHECKOUT_RECOVERY_DATABASE !== '1')('checkout recovery: real Postgres', () => {
  const schema = `qa_checkout_recovery_${randomUUID().replaceAll('-', '')}`;
  let first: Client, second: Client;
  beforeAll(async () => {
    const url = new URL(previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: process.env.DATABASE_URL_MAINPREVIEW,
      DATABASE_URL_MAINLIVE: process.env.DATABASE_URL_MAINLIVE }));
    if (url.hostname.endsWith('.neon.tech')) url.hostname = url.hostname.replace('-pooler.', '.');
    url.searchParams.set('uselibpqcompat', 'true');
    first = new Client({ connectionString: url.toString() }); second = new Client({ connectionString: url.toString() });
    await first.connect(); await second.connect();
    if (!/^qa_checkout_recovery_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe schema');
    await first.query(`CREATE SCHEMA "${schema}"`);
    for (const connection of [first, second]) await connection.query(`SET search_path TO "${schema}"`);
    await first.query(`CREATE TABLE "CheckoutAttempt" ("orderId" TEXT PRIMARY KEY, "userId" TEXT NOT NULL,
      state TEXT NOT NULL, environment TEXT NOT NULL, "captureId" TEXT, "paypalOrderId" TEXT, "merchantId" TEXT,
      CONSTRAINT "CheckoutAttempt_state_check" CHECK (state IN ('PREPARED','APPROVAL_PENDING','COMPLETED','REFUNDED','REVERSED','PAYMENT_REVIEW')),
      CONSTRAINT "CheckoutAttempt_completion_proof" CHECK (state IN ('PREPARED','APPROVAL_PENDING') OR environment='DEMO' OR
        ("captureId" IS NOT NULL AND "paypalOrderId" IS NOT NULL AND "merchantId" IS NOT NULL)))`);
    await first.query(await readFile(new URL('../../prisma/migrations/20260925030000_checkout_recovery_states/migration.sql', import.meta.url), 'utf8'));
  }, 30_000);
  afterAll(async () => {
    if (first && /^qa_checkout_recovery_[a-f0-9]{32}$/.test(schema)) {
      await first.query('ROLLBACK');
      // Only the random schema created by this test is removed, never public tables.
      await first.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
    await first?.end(); await second?.end();
  });
  const insert = async (id: string) => first.query(`INSERT INTO "CheckoutAttempt" ("orderId","userId",state,environment) VALUES ($1,'buyer','APPROVAL_PENDING','SANDBOX')`, [id]);
  const claim = (client: Client, id: string, state: string) => client.query(`UPDATE "CheckoutAttempt" SET state=$2
    WHERE "orderId"=$1 AND "userId"='buyer' AND "captureId" IS NULL AND state IN ('PREPARED','APPROVAL_PENDING') RETURNING state`, [id, state]);
  it('has exactly one winner between simultaneous capture and cancellation', async () => {
    for (let index = 0; index < 12; index++) {
      const id = `race-${index}`; await insert(id);
      const results = await Promise.all([claim(first, id, 'CAPTURE_PENDING'), claim(second, id, 'CANCEL_PENDING')]);
      expect(results.reduce((sum, result) => sum + (result.rowCount ?? 0), 0)).toBe(1);
      const row = (await first.query('SELECT state FROM "CheckoutAttempt" WHERE "orderId"=$1', [id])).rows[0];
      expect(['CAPTURE_PENDING', 'CANCEL_PENDING']).toContain(row.state);
    }
  });
  it('keeps verified proof mandatory and rejects cancelling a captured order', async () => {
    await insert('proof');
    await expect(first.query(`UPDATE "CheckoutAttempt" SET state='COMPLETED' WHERE "orderId"='proof'`)).rejects.toMatchObject({ code: '23514' });
    await first.query(`UPDATE "CheckoutAttempt" SET state='COMPLETED',"captureId"='capture',"paypalOrderId"='paypal',"merchantId"='merchant' WHERE "orderId"='proof'`);
    await expect(first.query(`UPDATE "CheckoutAttempt" SET state='CANCELLED' WHERE "orderId"='proof'`)).rejects.toMatchObject({ code: '23514' });
    expect((await first.query(`SELECT state FROM "CheckoutAttempt" WHERE "orderId"='proof'`)).rows[0].state).toBe('COMPLETED');
  });
  it('permits cancellation without inventing payment evidence', async () => {
    await insert('cancel'); await claim(first, 'cancel', 'CANCEL_PENDING');
    await first.query(`UPDATE "CheckoutAttempt" SET state='CANCELLED' WHERE "orderId"='cancel' AND state='CANCEL_PENDING'`);
    expect((await first.query(`SELECT state,"captureId" FROM "CheckoutAttempt" WHERE "orderId"='cancel'`)).rows[0]).toEqual({ state: 'CANCELLED', captureId: null });
  });
});
