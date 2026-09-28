/** @fileOverview Delivery notifications cannot forge receipts, resend mail or change purchases. @stability stable */
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient, TransactionalEmail } from '@/generated/prisma/client';
vi.mock('server-only', () => ({}));
const stub = vi.hoisted(() => ({ db: {} as unknown }));
vi.mock('@/lib/db', () => ({ get dbPrisma() { return stub.db; } }));
import { recordDeliveryEvent, verifyDeliveryEvent, type DeliveryEvent } from './email-webhook';
import { transactionMessage } from './email-policy';
import { dispatchTransactionEmail } from './email-dispatch';
import { POST } from '@/app/api/webhooks/resend/route';

const now = new Date('2026-09-25T06:00:00Z');
const key = Buffer.alloc(32, 42), secret = `whsec_${key.toString('base64')}`;
const emailId = '6a0d6e22-19c3-4ca8-aaec-20beed593052', providerId = 'f35ee73c-c754-4e84-a171-e3863d5dd2fb';
let row: TransactionalEmail;
const update = vi.fn(async ({ data }: { data: Partial<TransactionalEmail> }) => { row = { ...row, ...data }; return row; });
const find = async ({ where }: { where: { id?: string; providerId?: string } }) =>
  (where.id === row.id || where.providerId === row.providerId) ? { ...row } : null;
const db = {
  $transaction: async (callback: (tx: unknown) => unknown) => callback(db), $queryRaw: vi.fn(), $executeRaw: vi.fn(),
  transactionalEmail: { findUnique: find, findUniqueOrThrow: find, update, count: async () => 0,
    updateMany: async ({ where, data }: { where: { leaseUntil: Date }; data: Partial<TransactionalEmail> }) => {
      if (row.leaseUntil?.getTime() !== where.leaseUntil?.getTime()) return { count: 0 };
      await update({ data }); return { count: 1 };
    },
  },
  user: { findUnique: async () => ({ email: 'buyer@example.com', emailVerified: now }) },
  order: { findUnique: async () => ({ userId: 'buyer' }) },
} as unknown as PrismaClient;
function event(type: DeliveryEvent['type'] = 'email.delivered', at = now): DeliveryEvent {
  return { type, created_at: at.toISOString(), data: {
    email_id: providerId, from: 'Veggat Orders <Veggat-Orders@veggat.com>', to: ['buyer@example.com'], subject: 'Order confirmation',
    tags: { veggat_mail_id: emailId, veggat_environment: 'PRODUCTION' },
  } };
}
function signed(value: unknown, id = 'msg_fixture', timestamp = Math.floor(now.getTime() / 1000)) {
  const raw = JSON.stringify(value), signature = createHmac('sha256', key).update(`${id}.${timestamp}.${raw}`).digest('base64');
  const headers = new Headers({ 'svix-id': id, 'svix-timestamp': String(timestamp), 'svix-signature': `v1,${signature}` });
  return { raw, headers, request: new Request('http://localhost:3000/api/webhooks/resend', { method: 'POST', body: raw, headers }) };
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now); vi.clearAllMocks();
  vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('RESEND_WEBHOOK_SECRET', secret);
  vi.stubEnv('TRANSACTIONAL_EMAIL_ENABLED', 'true'); vi.stubEnv('RESEND_API_KEY', 're_unit_fixture_never_a_real_credential');
  row = { id: emailId, sourceKey: 'purchase:order1', userId: 'buyer', orderId: 'order1', environment: 'PRODUCTION', kind: 'PURCHASE',
    recipient: 'buyer@example.com', payload: transactionMessage('buyer@example.com', 'Order confirmation', 'veggat-order-order1.txt', 'Original terms', { id: emailId, environment: 'PRODUCTION' }),
    status: 'ACCEPTED_UNCONFIRMED', attempts: 1, firstAttemptAt: new Date(now.getTime() - 1000), nextAttemptAt: now, leaseUntil: null,
    providerId, acceptedAt: new Date(now.getTime() - 500), deliveredAt: null, deliveryEventAt: null, deliveryEventType: null, deliveryEventId: null,
    lastErrorCode: 'PROVIDER_HTTP_401', createdAt: new Date(now.getTime() - 10_000), updatedAt: now };
  stub.db = db;
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('signed email delivery evidence', () => {
  it('verifies raw bytes and records the provider event time, not the callback time', async () => {
    const proof = signed(event()); const original = JSON.stringify(row.payload);
    expect(verifyDeliveryEvent(proof.raw, proof.headers, secret).event?.type).toBe('email.delivered');
    expect((await POST(proof.request)).status).toBe(200);
    expect(row).toMatchObject({ status: 'DELIVERED', deliveredAt: now, deliveryEventId: 'msg_fixture', lastErrorCode: null });
    expect(JSON.stringify(row.payload)).toBe(original); expect(row.attempts).toBe(1);
  });
  it('fails closed without the endpoint secret', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', ''); expect((await POST(signed(event()).request)).status).toBe(503); expect(update).not.toHaveBeenCalled();
  });
  it.each(['unsigned', 'changed-body', 'old', 'future'])('rejects %s authentication without mutation', async scenario => {
    const proof = signed(event(), 'msg_fixture', Math.floor(now.getTime() / 1000) + (scenario === 'old' ? -601 : scenario === 'future' ? 601 : 0));
    if (scenario === 'unsigned') proof.headers.delete('svix-signature');
    const response = await POST(new Request('http://localhost:3000/api/webhooks/resend', { method: 'POST', headers: proof.headers, body: proof.raw + (scenario === 'changed-body' ? ' ' : '') }));
    expect(response.status).toBe(401); expect(update).not.toHaveBeenCalled();
  });
  it('limits both declared and actual request size', async () => {
    const cases: Record<string, string>[] = [{ 'content-length': '70000' }, {}];
    for (const headers of cases) {
      const response = await POST(new Request('http://localhost:3000/api/webhooks/resend', { method: 'POST', headers, body: 'x'.repeat(70_000) }));
      expect(response.status).toBe(413);
    }
    expect(update).not.toHaveBeenCalled();
  });
  it('ignores unrelated authenticated events and returns no private matching details', async () => {
    const response = await POST(signed({ type: 'email.opened' }).request);
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ received: true }); expect(update).not.toHaveBeenCalled();
  });
  it.each(['recipient', 'sender', 'subject', 'provider', 'environment', 'binding', 'unsent', 'past', 'future'])('does not accept a mismatched %s', async mismatch => {
    const value = event();
    if (mismatch === 'recipient') value.data.to = ['other@example.com'];
    if (mismatch === 'sender') value.data.from = 'other@example.com';
    if (mismatch === 'subject') value.data.subject = 'Different message';
    if (mismatch === 'provider') value.data.email_id = '835ee73c-c754-4e84-a171-e3863d5dd2fb';
    if (mismatch === 'environment') value.data.tags!.veggat_environment = 'PREVIEW';
    if (mismatch === 'binding') value.data.tags!.veggat_mail_id = '7a0d6e22-19c3-4ca8-aaec-20beed593052';
    if (mismatch === 'unsent') row.firstAttemptAt = null;
    if (mismatch === 'past') value.created_at = new Date(now.getTime() - 120_000).toISOString();
    if (mismatch === 'future') value.created_at = new Date(now.getTime() + 120_000).toISOString();
    expect(await recordDeliveryEvent(db, 'msg_bad', value)).toBe('ignored'); expect(update).not.toHaveBeenCalled();
  });
  it('matches legacy immutable messages only through their saved provider ID', async () => {
    row.payload = transactionMessage('buyer@example.com', 'Order confirmation', 'veggat-order-order1.txt', 'Old original terms');
    const value = event(); delete value.data.tags;
    expect(await recordDeliveryEvent(db, 'msg_legacy', value)).toBe('applied'); expect(row.status).toBe('DELIVERED');
  });
  it('processes an early signed event without a provider ID and prevents the stale send response from overwriting it', async () => {
    row.providerId = null; row.acceptedAt = null; row.status = 'QUEUED';
    const transport = vi.fn<typeof fetch>(async () => {
      expect(await recordDeliveryEvent(db, 'msg_early', event())).toBe('applied');
      return new Response(JSON.stringify({ id: providerId }));
    });
    await dispatchTransactionEmail(db, row.id, transport, now);
    expect(row).toMatchObject({ status: 'DELIVERED', providerId, deliveryEventId: 'msg_early' });
    await dispatchTransactionEmail(db, row.id, transport, new Date(now.getTime() + 3_600_000));
    expect(transport).toHaveBeenCalledOnce();
  });
  it('is idempotent and does not erase a newer complaint with an older delivered event', async () => {
    await recordDeliveryEvent(db, 'msg_complaint', event('email.complained'));
    expect(await recordDeliveryEvent(db, 'msg_complaint', event('email.complained'))).toBe('duplicate');
    await recordDeliveryEvent(db, 'msg_delivery', event('email.delivered', new Date(now.getTime() - 500)));
    expect(row).toMatchObject({ status: 'FAILED', deliveryEventId: 'msg_complaint', lastErrorCode: 'WEBHOOK_COMPLAINED', deliveredAt: new Date(now.getTime() - 500) });
  });
  it('prefers a negative event over delivered when timestamps tie, regardless of arrival order', async () => {
    await recordDeliveryEvent(db, 'msg_delivered', event());
    await recordDeliveryEvent(db, 'msg_failed', event('email.failed'));
    await recordDeliveryEvent(db, 'msg_replayed', event());
    expect(row.status).toBe('FAILED'); expect(row.deliveryEventId).toBe('msg_failed');
  });
  it('returns retryable failure without leaking a database error or claiming delivery', async () => {
    stub.db = { $transaction: async () => { throw new Error('private record details'); } };
    const response = await POST(signed(event()).request);
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: 'DELIVERY_RECORD_RETRY' });
  });
});
