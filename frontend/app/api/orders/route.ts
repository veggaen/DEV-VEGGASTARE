import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextResponse } from 'next/server';
import { PaymentMethod } from '@prisma/client';
import { z } from 'zod';
import { OrderDtoSchema } from '@/lib/types/orders';

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

export async function POST(req: Request) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bodyResult = await parseJsonOrError(
    req,
    z.object({
      // NOTE: never trust client-supplied userId; always use session user
      totalAmount: z.coerce.number().finite().positive(),
      transactionId: z.string().trim().min(1).max(200).optional().nullable(),
      commentOrder: z.string().trim().max(2000).optional().nullable(),
      commentPay: z.string().trim().max(2000).optional().nullable(),
      method: z.nativeEnum(PaymentMethod).optional().nullable(),
    })
  );
  if (!bodyResult.ok) return bodyResult.response;

  const { totalAmount, transactionId, commentOrder, commentPay, method } = bodyResult.data;

  try {
    const order = await dbPrisma.order.create({
      data: {
        userId: session.id,
        totalAmount,
        status: 'COMPLETED',
        transactionId: transactionId ?? null,
        commentOrder: commentOrder?.trim() || '',
        Payment: {
          create: {
            commentPay: commentPay?.trim() || '',
            method: method ?? PaymentMethod.COINBASEWALLET,
            status: 'COMPLETED',
            transactionId: transactionId ?? null,
          },
        },
      },
      include: {
        Payment: true,
      },
    });

    const payment = order.Payment
      ? {
          id: order.Payment.id,
          orderId: order.Payment.orderId,
          method: order.Payment.method,
          status: order.Payment.status,
          transactionId: order.Payment.transactionId ?? null,
          commentPay: order.Payment.commentPay ?? null,
          createdAt: toIsoString(order.Payment.createdAt),
          updatedAt: toIsoString(order.Payment.updatedAt),
        }
      : null;

    const dto = {
      id: order.id,
      userId: order.userId,
      totalAmount: order.totalAmount,
      status: order.status,
      transactionId: order.transactionId ?? null,
      commentOrder: order.commentOrder ?? null,
      createdAt: toIsoString(order.createdAt),
      updatedAt: toIsoString(order.updatedAt),
      Payment: payment,
      payment,
    };

    const parsed = OrderDtoSchema.safeParse(dto);
    if (!parsed.success) {
      console.error('[api/orders] Invalid POST DTO:', parsed.error);
      return NextResponse.json(
        { error: 'Error creating order', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Error creating order', ...(isDev && error instanceof Error ? { detail: error.message } : {}) },
      { status: 500 }
    );
  }
}

// GET not implemented at this route; use /api/orders/[id] or /api/orders/user/[userId]
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use /api/orders/[id] or /api/orders/user/[userId]' },
    { status: 405 }
  );
}