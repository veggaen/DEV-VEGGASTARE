import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recalculateVerificationTier } from '@/lib/verification-recalc';

/**
 * POST /api/orders/confirm
 * Called after on-chain payment verification succeeds.
 * Moves an order from CONFIRMING → COMPLETED.
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
      include: { Payment: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Only the order owner can confirm
    if (order.userId !== session.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only CONFIRMING orders can be confirmed
    if (order.status !== 'CONFIRMING') {
      return NextResponse.json({ 
        error: `Order is already ${order.status}`,
        status: order.status,
      }, { status: 400 });
    }

    // Update order and payment to COMPLETED
    await dbPrisma.$transaction([
      dbPrisma.order.update({
        where: { id: orderId },
        data: { 
          status: 'COMPLETED',
          transactionId,
        },
      }),
      ...(order.Payment ? [
        dbPrisma.payment.update({
          where: { id: order.Payment.id },
          data: { 
            status: 'COMPLETED',
            transactionId,
            ...(blockNumber != null ? { blockNumber } : {}),
          },
        }),
      ] : []),
    ]);

    // Set Web3 payment flag and recalculate verification tier
    try {
      await dbPrisma.user.update({
        where: { id: session.id },
        data: { hasWeb3Payment: true },
      });
      await recalculateVerificationTier(session.id, { hasWeb3Payment: true });
    } catch (flagErr) {
      console.error('[api/orders/confirm] Failed to set hasWeb3Payment flag:', flagErr);
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
