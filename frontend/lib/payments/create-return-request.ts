/** @fileOverview Serialize pending buyer requests with payment reconciliation. @stability experimental */
import 'server-only';
import type { PrismaClient } from '@/generated/prisma/client';
import type { z } from 'zod';
import { CreateReturnSchema, returnAcknowledgment } from './return-request';
import { queueTransactionEmail } from './email-outbox';

export class BuyerRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function createBuyerRequest(db: PrismaClient, userId: string, input: z.infer<typeof CreateReturnSchema>) {
  return db.$transaction(async tx => {
    // Same lock as capture and refund reconciliation. A request never modifies
    // order/payment status, download permissions or any credit account.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`fulfill:${input.orderId}`}, 0))`;
    const order = await tx.order.findUnique({ where: { id: input.orderId }, select: {
      id: true, userId: true, status: true, fulfilmentStatus: true, createdAt: true, deliveredAt: true,
    } });
    if (!order || order.userId !== userId) throw new BuyerRequestError('Order not found', 404);
    const existing = await tx.returnRequest.findFirst({ where: { orderId: order.id, userId, reason: input.reason,
      status: { in: ['PENDING', 'APPROVED'] } }, orderBy: { createdAt: 'desc' } });
    const description = input.description?.trim() || null;
    if (existing && (existing.reason !== input.reason || existing.description !== description)) {
      throw new BuyerRequestError('A request of this type is already open. Review it on your receipt or contact kontakt@veggat.com to add to your notice.', 409);
    }
    // Recover a lost response even if a verified refund arrived in the meantime.
    if (existing) return { record: existing, duplicate: true, order };
    if (order.status !== 'COMPLETED' || ['RETURNED', 'CANCELLED'].includes(order.fulfilmentStatus)) {
      throw new BuyerRequestError('This order is not awaiting a new return request. Check its payment status or contact kontakt@veggat.com.', 409);
    }
    const record = await tx.returnRequest.create({ data: {
      orderId: order.id, userId, reason: input.reason, description,
    } });
    const email = await queueTransactionEmail(tx, { sourceKey: `buyer-request:${record.id}`, userId, orderId: order.id,
      kind: 'BUYER_REQUEST', subject: 'Veggat received your purchase request',
      filename: `veggat-request-${record.id}.txt`, original: returnAcknowledgment(record, true) });
    return { record, duplicate: false, order, emailStatus: email?.status ?? null };
  }, { maxWait: 10_000, timeout: 15_000 });
}
