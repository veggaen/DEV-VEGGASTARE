/** @fileOverview Mail retries cannot duplicate receipts or leak cloned Preview data. @stability stable */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient, TransactionalEmail } from '@/generated/prisma/client';
vi.mock('server-only', () => ({}));
import { dispatchTransactionEmail } from './email-dispatch';
import { emailRecipientAllowed, emailStatusText, transactionMessage } from './email-policy';
import { queueTransactionEmail } from './email-outbox';

const now = new Date('2026-09-24T12:00:00Z');
const payload = transactionMessage('buyer@example.com', 'Veggat test record', 'veggat-order-test.txt', 'Original purchase record — no money moved.');
let row: TransactionalEmail;
let recipient = 'buyer@example.com';
let count = 0;
const transport = vi.fn<typeof fetch>();
const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
  row = { ...row, ...data, ...(data.attempts ? { attempts: row.attempts + 1 } : {}) } as TransactionalEmail;
  return { ...row };
});
const db = {
  $transaction: async (callback: (value: unknown) => unknown) => callback(db),
  $executeRaw: vi.fn(),
  transactionalEmail: {
    findUnique: async () => ({ ...row }), update,
    count: async () => count,
    updateMany: async ({ where, data }: { where: { leaseUntil: Date }; data: Record<string, unknown> }) => {
      if (row.leaseUntil?.getTime() !== where.leaseUntil?.getTime()) return { count: 0 };
      await update({ data }); return { count: 1 };
    },
    upsert: vi.fn(),
  },
  user: { findUnique: async () => ({ email: recipient, emailVerified: now }) },
  order: { findUnique: async () => ({ userId: 'buyer' }) },
} as unknown as PrismaClient;

beforeEach(() => {
  vi.clearAllMocks(); recipient = 'buyer@example.com'; count = 0;
  vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('TRANSACTIONAL_EMAIL_ENABLED', 'true');
  vi.stubEnv('RESEND_API_KEY', 're_unit_test_never_a_real_credential');
  row = { id: 'mail1', sourceKey: 'purchase:order1', userId: 'buyer', orderId: 'order1', kind: 'PURCHASE',
    environment: 'PRODUCTION', recipient, payload, status: 'QUEUED', attempts: 0,
    firstAttemptAt: null, leaseUntil: null, nextAttemptAt: now, providerId: null, acceptedAt: null,
    deliveredAt: null, lastErrorCode: null, createdAt: now, updatedAt: now };
  transport.mockResolvedValue(new Response(JSON.stringify({ id: 'provider1' }), { status: 200 }));
});
afterEach(() => vi.unstubAllEnvs());

describe('durable transactional email', () => {
  it('sends the exact saved payload with one stable idempotency key and reports acceptance only', async () => {
    await dispatchTransactionEmail(db, row.id, transport, now);
    expect(transport).toHaveBeenCalledOnce();
    expect(transport).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      method: 'POST', body: JSON.stringify(payload), redirect: 'error', headers: expect.objectContaining({ 'Idempotency-Key': 'veggat/mail1' }),
    }));
    expect(row).toMatchObject({ status: 'ACCEPTED', providerId: 'provider1', attempts: 1, deliveredAt: null });
    await dispatchTransactionEmail(db, row.id, transport, now);
    expect(transport).toHaveBeenCalledOnce();
  });
  it('recovers an uncertain response using the same idempotency key and bytes', async () => {
    transport.mockRejectedValueOnce(new Error('Network timeout containing private payload'));
    await dispatchTransactionEmail(db, row.id, transport, now);
    expect(row).toMatchObject({ status: 'QUEUED', attempts: 1, lastErrorCode: 'PROVIDER_RESPONSE_UNCERTAIN' });
    await dispatchTransactionEmail(db, row.id, transport, new Date(now.getTime() + 5 * 60_000));
    expect(row.status).toBe('ACCEPTED');
    expect(transport.mock.calls[0][1]?.body).toBe(transport.mock.calls[1][1]?.body);
    expect(transport.mock.calls[1][1]?.headers).toEqual(transport.mock.calls[0][1]?.headers);
  });
  it('holds an uncertain send before the 24h deduplication window expires', async () => {
    row.firstAttemptAt = new Date(now.getTime() - 23 * 3_600_000); row.attempts = 1;
    await dispatchTransactionEmail(db, row.id, transport, now);
    expect(transport).not.toHaveBeenCalled(); expect(row.status).toBe('REVIEW');
  });
  it('ignores an active lease and caps attempts and daily first sends', async () => {
    row.leaseUntil = new Date(now.getTime() + 30_000);
    await dispatchTransactionEmail(db, row.id, transport, now); expect(transport).not.toHaveBeenCalled();
    row.leaseUntil = null; count = 100;
    await dispatchTransactionEmail(db, row.id, transport, now); expect(transport).not.toHaveBeenCalled();
    expect(row.lastErrorCode).toBe('DAILY_MESSAGE_LIMIT');
    row.nextAttemptAt = now; row.attempts = 6;
    await dispatchTransactionEmail(db, row.id, transport, now); expect(transport).not.toHaveBeenCalled(); expect(row.status).toBe('REVIEW');
  });
  it('never sends after the buyer changes their email address', async () => {
    recipient = 'changed@example.com'; await dispatchTransactionEmail(db, row.id, transport, now);
    expect(transport).not.toHaveBeenCalled(); expect(row.status).toBe('SKIPPED');
  });
  it('never sends a Production message from Preview or an unapproved cloned address', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview'); await dispatchTransactionEmail(db, row.id, transport, now);
    row.environment = 'PREVIEW'; await dispatchTransactionEmail(db, row.id, transport, now);
    expect(transport).not.toHaveBeenCalled(); expect(row.status).toBe('SKIPPED');
  });
  it('fails closed when sending is disabled or an API key is missing', async () => {
    vi.stubEnv('TRANSACTIONAL_EMAIL_ENABLED', 'false'); await dispatchTransactionEmail(db, row.id, transport, now);
    vi.stubEnv('TRANSACTIONAL_EMAIL_ENABLED', 'true'); vi.stubEnv('RESEND_API_KEY', ''); row.nextAttemptAt = now;
    await dispatchTransactionEmail(db, row.id, transport, now);
    expect(transport).not.toHaveBeenCalled(); expect(row.attempts).toBe(0);
  });
  it('never sends a tampered recipient in the saved payload', async () => {
    row.payload = { ...payload, to: ['other@example.com'] };
    await dispatchTransactionEmail(db, row.id, transport, now);
    expect(transport).not.toHaveBeenCalled(); expect(row.status).toBe('FAILED');
  });
  it('confirms delivery only by a matching authenticated provider receipt, never by resending', async () => {
    row.providerId = 'provider1'; row.status = 'ACCEPTED'; row.acceptedAt = now;
    transport.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'provider1', to: [recipient], last_event: 'delivered' })));
    await dispatchTransactionEmail(db, row.id, transport, now);
    expect(transport).toHaveBeenCalledWith('https://api.resend.com/emails/provider1', expect.objectContaining({ method: 'GET' }));
    expect(row.status).toBe('DELIVERED'); expect(row.deliveredAt).toEqual(now);
  });
  it('does not claim delivery for a mismatched provider receipt', async () => {
    row.providerId = 'provider1'; row.status = 'ACCEPTED'; row.acceptedAt = now;
    transport.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'provider1', to: ['other@example.com'], last_event: 'delivered' })));
    await dispatchTransactionEmail(db, row.id, transport, now);
    expect(row).toMatchObject({ status: 'REVIEW', lastErrorCode: 'PROVIDER_RECEIPT_MISMATCH', deliveredAt: null });
  });
  it('keeps provider rejection details private', async () => {
    transport.mockResolvedValueOnce(new Response('private provider error', { status: 401 }));
    await dispatchTransactionEmail(db, row.id, transport, now);
    expect(row).toMatchObject({ status: 'FAILED', lastErrorCode: 'PROVIDER_HTTP_401' });
  });
  it('retains acceptance when a sending-only key cannot retrieve delivery history', async () => {
    row.providerId = 'provider1'; row.status = 'ACCEPTED'; row.acceptedAt = now;
    transport.mockResolvedValueOnce(new Response(JSON.stringify({ name: 'restricted_api_key' }), { status: 401 }));
    await dispatchTransactionEmail(db, row.id, transport, now);
    expect(row.status).toBe('ACCEPTED_UNCONFIRMED'); expect(row.providerId).toBe('provider1');
    await dispatchTransactionEmail(db, row.id, transport, new Date(now.getTime() + 3_600_000));
    expect(transport).toHaveBeenCalledOnce();
    expect(emailStatusText(row.status)).toContain('accepted');
    expect(emailStatusText(row.status)).not.toContain('failed');
  });
  it('queues no email for demos and stores an immutable copy for a verified buyer', async () => {
    const input = { sourceKey: 'purchase:order1', userId: 'demo_visitor', orderId: 'order1', kind: 'PURCHASE' as const,
      subject: 'Test', filename: 'veggat-order-order1.txt', original: 'Original' };
    await queueTransactionEmail(db, input); expect(db.transactionalEmail.upsert).not.toHaveBeenCalled();
    await queueTransactionEmail(db, { ...input, userId: 'buyer', paymentEnvironment: 'LIVE' });
    expect(db.transactionalEmail.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {}, create: expect.objectContaining({ status: 'QUEUED', userId: 'buyer' }) }));
    vi.stubEnv('TRANSACTIONAL_EMAIL_ENABLED', 'false');
    await queueTransactionEmail(db, { ...input, userId: 'buyer', paymentEnvironment: 'LIVE' });
    expect(db.transactionalEmail.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ create: expect.objectContaining({ status: 'REVIEW', lastErrorCode: 'EMAIL_NOT_CONFIGURED' }) }));
  });
  it('requires verified recipients and an explicit non-local Preview allowlist', () => {
    vi.stubEnv('TRANSACTIONAL_EMAIL_TEST_RECIPIENTS', 'approved@example.com');
    expect(emailRecipientAllowed('approved@example.com', true, 'PREVIEW')).toBe(true);
    expect(emailRecipientAllowed('other@example.com', true, 'PREVIEW')).toBe(false);
    expect(emailRecipientAllowed('approved@example.com', true, 'LOCAL')).toBe(false);
    expect(emailRecipientAllowed('approved@example.com', false, 'PRODUCTION')).toBe(false);
    expect(emailRecipientAllowed('qa@veggat.invalid', true, 'PRODUCTION')).toBe(false);
    expect(emailStatusText('ACCEPTED')).toContain('not yet confirmed');
    expect(emailStatusText('DELIVERED')).toContain('mail server');
    expect(Buffer.from(payload.attachments[0].content, 'base64').toString()).toContain('Original purchase record');
  });
});
