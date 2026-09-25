/** @fileOverview Signed delivery evidence; never a payment, waiver or resend path. @stability experimental */
import 'server-only';
import { Webhook } from 'svix';
import { z } from 'zod';
import type { PrismaClient } from '@/generated/prisma/client';
import { EmailPayload, emailEnvironment } from './email-policy';

export const DELIVERY_EVENTS = ['email.delivered', 'email.bounced', 'email.failed', 'email.suppressed', 'email.complained'] as const;
const Event = z.object({
  type: z.enum(DELIVERY_EVENTS), created_at: z.string().datetime({ offset: true }),
  data: z.object({
    email_id: z.string().uuid(), from: z.string().max(320), to: z.array(z.string().email().max(254)).length(1),
    subject: z.string().max(200), tags: z.record(z.string().max(256)).optional(),
  }),
});
export type DeliveryEvent = z.infer<typeof Event>;
export function webhookConfigured(secret: string | undefined) {
  return !!secret && /^whsec_[A-Za-z0-9+/=_-]{32,128}$/.test(secret);
}
export function verifyDeliveryEvent(raw: string, headers: Headers, secret: string): { id: string; event: DeliveryEvent | null } {
  const id = headers.get('svix-id') ?? '';
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new Error('INVALID_SIGNATURE');
  // Svix validates the exact bytes, signature and timestamp replay window.
  new Webhook(secret).verify(raw, {
    'svix-id': id, 'svix-timestamp': headers.get('svix-timestamp') ?? '', 'svix-signature': headers.get('svix-signature') ?? '',
  });
  // Svix 2 verifies authenticity and returns void; parse only after it succeeds.
  const value: unknown = JSON.parse(raw);
  const envelope = z.object({ type: z.string().max(100) }).parse(value);
  return { id, event: DELIVERY_EVENTS.includes(envelope.type as DeliveryEvent['type']) ? Event.parse(value) : null };
}

const priority = (type: string | null) => DELIVERY_EVENTS.indexOf(type as DeliveryEvent['type']);
const address = (value: string) => (value.match(/<([^<>]+)>$/)?.[1] ?? value).trim().toLowerCase();

export async function recordDeliveryEvent(db: PrismaClient, id: string, event: DeliveryEvent, now = new Date()) {
  const environment = emailEnvironment(), tags = event.data.tags;
  if (tags?.veggat_environment && tags.veggat_environment !== environment) return 'ignored';
  const occurredAt = new Date(event.created_at);
  if (occurredAt.getTime() > now.getTime() + 60_000) return 'ignored';
  return db.$transaction(async tx => {
    // Stable metadata binds even an event that beats the send response. Older
    // immutable payloads have no tags and can only match their saved provider ID.
    const boundId = z.string().uuid().safeParse(tags?.veggat_mail_id);
    const found = await tx.transactionalEmail.findUnique({ where: boundId.success ? { id: boundId.data } : { providerId: event.data.email_id } });
    if (!found || found.environment !== environment) return 'ignored';
    // Advisory locking also respects Prisma adapters using isolated schemas;
    // an unqualified raw table query can otherwise lock the public table.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`email-delivery:${found.id}`}, 0))`;
    const row = await tx.transactionalEmail.findUniqueOrThrow({ where: { id: found.id } });
    const payload = EmailPayload.safeParse(row.payload);
    if (!payload.success || !row.firstAttemptAt || row.status === 'SKIPPED' ||
      occurredAt.getTime() < row.firstAttemptAt.getTime() - 60_000 ||
      address(event.data.from) !== address(payload.data.from) || event.data.subject !== payload.data.subject ||
      event.data.to[0].toLowerCase() !== row.recipient.toLowerCase() ||
      payload.data.to[0].toLowerCase() !== row.recipient.toLowerCase() ||
      (row.providerId && row.providerId !== event.data.email_id)) return 'ignored';
    if (boundId.success && (!payload.data.tags || payload.data.tags[0].value !== boundId.data ||
      payload.data.tags[1].value !== environment || tags?.veggat_environment !== environment)) return 'ignored';
    if (!row.providerId && !boundId.success) return 'ignored';
    if (row.deliveryEventId === id) return 'duplicate';
    const newer = !row.deliveryEventAt || occurredAt > row.deliveryEventAt ||
      (occurredAt.getTime() === row.deliveryEventAt.getTime() && priority(event.type) > priority(row.deliveryEventType));
    const firstDelivery = event.type === 'email.delivered' && (!row.deliveredAt || occurredAt < row.deliveredAt);
    if (!newer && !firstDelivery) return 'ignored';
    await tx.transactionalEmail.update({ where: { id: row.id }, data: {
      ...(firstDelivery ? { deliveredAt: occurredAt } : {}),
      ...(newer ? {
        providerId: event.data.email_id, deliveryEventAt: occurredAt, deliveryEventType: event.type, deliveryEventId: id,
        status: event.type === 'email.delivered' ? 'DELIVERED' : 'FAILED',
        lastErrorCode: event.type === 'email.delivered' ? null : `WEBHOOK_${event.type.slice(6).toUpperCase()}`,
        // Invalidate any pending sender/poller CAS: stale responses must not
        // overwrite authenticated delivery evidence or queue another send.
        leaseUntil: null,
      } : {}),
    } });
    return 'applied';
  }, { maxWait: 10_000, timeout: 15_000 });
}
