/** @fileOverview Bounded, leased Resend dispatch; acceptance never implies delivery. @stability experimental */
import 'server-only';
import type { PrismaClient, TransactionalEmail } from '@/generated/prisma/client';
import { EmailPayload, emailEnvironment, emailRecipientAllowed } from './email-policy';

const HOUR = 3_600_000;
const LEASE_MS = 60_000;
const MAX_ATTEMPTS = 6;
const DAILY_MESSAGE_CAP = 100;
type Fetch = typeof fetch;

export class MailError extends Error {
  constructor(public code: string, public retryable: boolean) { super(code); }
}

function configured() {
  return process.env.TRANSACTIONAL_EMAIL_ENABLED === 'true' &&
    /^re_[A-Za-z0-9_-]{20,}$/.test(process.env.RESEND_API_KEY ?? '') &&
    !process.env.RESEND_API_KEY?.includes('not_a_real_key');
}

async function provider(path: string, init: RequestInit, transport: Fetch) {
  const response = await transport(`https://api.resend.com${path}`, { ...init, cache: 'no-store', redirect: 'error',
    headers: { ...init.headers, Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    // Never store/log provider bodies, which can echo recipients or credentials.
    if (response.status === 409) {
      const body = await response.json().catch(() => null);
      throw new MailError(body?.name === 'concurrent_idempotent_requests' ? 'PROVIDER_BUSY' : 'PAYLOAD_CONFLICT', body?.name === 'concurrent_idempotent_requests');
    }
    throw new MailError(`PROVIDER_HTTP_${response.status}`, response.status === 429 || response.status >= 500);
  }
  return response.json().catch(() => { throw new MailError('INVALID_PROVIDER_RESPONSE', true); });
}

async function claim(db: PrismaClient, id: string, now: Date) {
  return db.$transaction(async tx => {
    // A single brief budget lock also serializes lease claims across replicas.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'transactional-email-budget'}, 0))`;
    const row = await tx.transactionalEmail.findUnique({ where: { id } });
    if (!row || row.environment !== emailEnvironment() || !['QUEUED', 'SENDING', 'ACCEPTED'].includes(row.status) ||
        row.nextAttemptAt > now || (row.leaseUntil && row.leaseUntil > now)) return null;
    const update = (data: Parameters<typeof tx.transactionalEmail.update>[0]['data']) => tx.transactionalEmail.update({ where: { id }, data });
    if (!configured()) {
      await update({ lastErrorCode: 'EMAIL_NOT_CONFIGURED', nextAttemptAt: new Date(now.getTime() + HOUR) }); return null;
    }
    const [user, order] = await Promise.all([
      tx.user.findUnique({ where: { id: row.userId }, select: { email: true, emailVerified: true } }),
      tx.order.findUnique({ where: { id: row.orderId }, select: { userId: true } }),
    ]);
    if (!user || user.email !== row.recipient || order?.userId !== row.userId || !emailRecipientAllowed(row.recipient, !!user.emailVerified, row.environment)) {
      await update({ status: 'SKIPPED', lastErrorCode: 'RECIPIENT_CHANGED_OR_INELIGIBLE', leaseUntil: null }); return null;
    }
    const payload = EmailPayload.safeParse(row.payload);
    if (!payload.success || payload.data.to[0] !== row.recipient) {
      await update({ status: 'FAILED', lastErrorCode: 'INVALID_SAVED_MESSAGE', leaseUntil: null }); return null;
    }
    if (row.providerId) {
      if (!row.acceptedAt || now.getTime() - row.acceptedAt.getTime() > 72 * HOUR) {
        await update({ status: 'REVIEW', lastErrorCode: 'DELIVERY_UNCONFIRMED', leaseUntil: null }); return null;
      }
      return update({ leaseUntil: new Date(now.getTime() + LEASE_MS), nextAttemptAt: new Date(now.getTime() + HOUR) });
    }
    // Resend retains deduplication keys for 24h. Hold for manual review BEFORE
    // that expires; never rotate a key after an uncertain send response.
    if (row.attempts >= MAX_ATTEMPTS || (row.firstAttemptAt && now.getTime() - row.firstAttemptAt.getTime() >= 23 * HOUR) ||
        now.getTime() - row.createdAt.getTime() >= 7 * 24 * HOUR) {
      await update({ status: 'REVIEW', lastErrorCode: 'SAFE_RETRY_WINDOW_EXPIRED', leaseUntil: null }); return null;
    }
    const start = new Date(now); start.setUTCHours(0, 0, 0, 0);
    if (!row.firstAttemptAt && await tx.transactionalEmail.count({ where: { firstAttemptAt: { gte: start } } }) >= DAILY_MESSAGE_CAP) {
      await update({ lastErrorCode: 'DAILY_MESSAGE_LIMIT', nextAttemptAt: new Date(now.getTime() + HOUR) }); return null;
    }
    return update({ status: 'SENDING', firstAttemptAt: row.firstAttemptAt ?? now, attempts: { increment: 1 },
      leaseUntil: new Date(now.getTime() + LEASE_MS), nextAttemptAt: new Date(now.getTime() + LEASE_MS), lastErrorCode: null });
  }, { maxWait: 10_000, timeout: 15_000 });
}

export async function dispatchTransactionEmail(db: PrismaClient, id: string, transport: Fetch = fetch, now = new Date()) {
  const row = await claim(db, id, now);
  if (!row) return;
  const where = { id: row.id, leaseUntil: row.leaseUntil };
  try {
    if (row.providerId) {
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(row.providerId)) throw new MailError('INVALID_PROVIDER_ID', false);
      const result = await provider(`/emails/${row.providerId}`, { method: 'GET' }, transport);
      if (result.id !== row.providerId || !Array.isArray(result.to) || result.to.length !== 1 || result.to[0].toLowerCase() !== row.recipient.toLowerCase()) {
        throw new MailError('PROVIDER_RECEIPT_MISMATCH', false);
      }
      const delivered = ['delivered', 'opened', 'clicked'].includes(result.last_event);
      const failed = ['bounced', 'complained', 'failed', 'suppressed'].includes(result.last_event);
      await db.transactionalEmail.updateMany({ where, data: { status: delivered ? 'DELIVERED' : failed ? 'FAILED' : 'ACCEPTED',
        deliveredAt: delivered ? now : null, lastErrorCode: failed ? 'PROVIDER_DELIVERY_FAILED' : null,
        leaseUntil: null, nextAttemptAt: new Date(now.getTime() + HOUR) } });
    } else {
      const result = await provider('/emails', { method: 'POST', headers: { 'Idempotency-Key': `veggat/${row.id}` }, body: JSON.stringify(row.payload) }, transport);
      if (typeof result.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(result.id)) throw new MailError('INVALID_PROVIDER_RESPONSE', true);
      await db.transactionalEmail.updateMany({ where, data: { status: 'ACCEPTED', providerId: result.id, acceptedAt: now,
        leaseUntil: null, lastErrorCode: null, nextAttemptAt: new Date(now.getTime() + 60_000) } });
    }
  } catch (error) {
    const failure = error instanceof MailError ? error : new MailError('PROVIDER_RESPONSE_UNCERTAIN', true);
    await db.transactionalEmail.updateMany({ where, data: {
      status: row.providerId ? (failure.retryable ? 'ACCEPTED' : 'REVIEW') : failure.retryable ? 'QUEUED' : 'FAILED',
      lastErrorCode: failure.code, leaseUntil: null,
      nextAttemptAt: new Date(now.getTime() + Math.min(HOUR, 120_000 * 2 ** row.attempts)),
    } });
  }
}

export async function processTransactionEmailBatch(db: PrismaClient, sourceKey?: string) {
  if (!configured()) return { processed: 0, configured: false };
  const rows = await db.transactionalEmail.findMany({ where: { environment: emailEnvironment(),
    ...(sourceKey ? { sourceKey } : {}), status: { in: ['QUEUED', 'SENDING', 'ACCEPTED'] }, nextAttemptAt: { lte: new Date() },
    OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }],
  }, select: { id: true }, orderBy: { nextAttemptAt: 'asc' }, take: sourceKey ? 1 : 3 });
  // Sequential, bounded batch. A provider 429 is retained for a later retry;
  // it never becomes a lost acknowledgment or triggers unbounded retries.
  for (const row of rows) await dispatchTransactionEmail(db, row.id);
  return { processed: rows.length, configured: true };
}

export type PublicEmailStatus = Pick<TransactionalEmail, 'status' | 'kind'>;
