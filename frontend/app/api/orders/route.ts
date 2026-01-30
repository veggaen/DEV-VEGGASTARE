import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { NextResponse } from 'next/server';
import { PaymentMethod } from '@prisma/client';
import { z } from 'zod';

const isDev = process.env.NODE_ENV !== 'production';

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
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Error creating order', ...(isDev && error instanceof Error ? { detail: error.message } : {}) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {

}