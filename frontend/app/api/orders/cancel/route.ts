import { NextResponse } from 'next/server';
import { z } from 'zod';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { releaseReservedOrderStock } from '@/lib/payments/complete-fiat-order';

/**
 * @fileOverview Cancel a pending/confirming checkout order and release reserved stock.
 * @stability maturing
 */

export async function POST(req: Request) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bodyResult = await parseJsonOrError(
    req,
    z.object({
      orderId: z.string().min(1),
      transactionId: z.string().trim().max(200).optional().nullable(),
      status: z.enum(['FAILED', 'CANCELLED']).default('CANCELLED'),
    })
  );
  if (!bodyResult.ok) return bodyResult.response;

  const { orderId, transactionId, status } = bodyResult.data;

  const order = await dbPrisma.order.findUnique({
    where: { id: orderId },
    select: { userId: true, status: true },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.userId !== session.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (order.status === 'COMPLETED') {
    return NextResponse.json({
      success: true,
      orderId,
      alreadyCompleted: true,
    });
  }

  const result = await releaseReservedOrderStock(orderId, {
    status,
    paymentTransactionId: transactionId ?? undefined,
    source: 'orders.cancel',
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? 'Failed to cancel order' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    orderId,
    status,
  });
}
