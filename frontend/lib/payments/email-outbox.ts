/** @fileOverview Persist transaction mail without contacting a provider inside a DB transaction. @stability experimental */
import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { z } from 'zod';
import { isDemoUserId } from '@/lib/demo-policy';
import { emailEnvironment, emailRecipientAllowed, transactionMessage } from './email-policy';

export async function queueTransactionEmail(tx: Prisma.TransactionClient, input: {
  sourceKey: string; userId: string; orderId: string; kind: 'PURCHASE' | 'BUYER_REQUEST';
  paymentEnvironment?: string; subject: string; filename: string; original: string;
}) {
  // Demo records deliberately remain downloadable-only and never send mail.
  if (isDemoUserId(input.userId) || input.paymentEnvironment === 'DEMO') return;
  // Prisma can emulate an upsert with an empty update rather than issuing
  // INSERT ... ON CONFLICT. Serialize source replays inside the transaction.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`email-source:${input.sourceKey}`}, 0))`;
  const user = await tx.user.findUnique({ where: { id: input.userId }, select: { email: true, emailVerified: true } });
  if (!user?.email || !z.string().email().max(254).safeParse(user.email).success) return;
  const environment = emailEnvironment();
  const allowed = emailRecipientAllowed(user.email, !!user.emailVerified, environment) &&
    (!input.paymentEnvironment || input.paymentEnvironment === (environment === 'PRODUCTION' ? 'LIVE' : 'SANDBOX'));
  const enabled = process.env.TRANSACTIONAL_EMAIL_ENABLED === 'true';
  return tx.transactionalEmail.upsert({ where: { sourceKey: input.sourceKey }, update: {}, create: {
    sourceKey: input.sourceKey, userId: input.userId, orderId: input.orderId, environment,
    kind: input.kind, recipient: user.email, payload: transactionMessage(user.email, input.subject, input.filename, input.original),
    status: !allowed ? 'SKIPPED' : enabled ? 'QUEUED' : 'REVIEW',
    lastErrorCode: !allowed ? 'RECIPIENT_NOT_ELIGIBLE' : enabled ? null : 'EMAIL_NOT_CONFIGURED',
  } });
}
