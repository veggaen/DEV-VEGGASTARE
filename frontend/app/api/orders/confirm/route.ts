import { NextResponse } from 'next/server';
import { z } from 'zod';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { completePaidOrder } from '@/lib/payments/complete-fiat-order';

/**
 * POST /api/orders/confirm
 * Called after on-chain payment verification succeeds.
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
      transactionId: z.string().min(1),
      blockNumber: z.coerce.number().int().optional().nullable(),
    })
  );
  if (!bodyResult.ok) return bodyResult.response;

  const { orderId, transactionId, blockNumber } = bodyResult.data;

  try {
    const order = await dbPrisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, status: true },
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
        status: 'COMPLETED',
        alreadyCompleted: true,
      });
    }

    if (order.status !== 'CONFIRMING') {
      return NextResponse.json(
        {
          error: `Order is ${order.status}`,
          status: order.status,
        },
        { status: 400 }
      );
    }

    const result = await completePaidOrder(orderId, {
      paymentKind: 'web3',
      paymentTransactionId: transactionId,
      blockNumber,
      origin: new URL(req.url).origin,
      source: 'orders.confirm',
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? 'Failed to confirm order' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId,
      status: 'COMPLETED',
    });
  } catch (error) {
    console.error('[api/orders/confirm] Error:', error);
    return NextResponse.json(
      { error: 'Failed to confirm order' },
      { status: 500 }
    );
  }
}
