import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { userId, totalAmount, transactionId, commentOrder, commentPay, method } = await req.json();
    console.log('commentOrder:', commentOrder);
    

    const order = await dbPrisma.order.create({
      data: {
        userId,
        totalAmount,
        status: 'COMPLETED',
        transactionId,
        commentOrder: commentOrder ? commentOrder : '',
        payment: {
          create: {
            commentPay: commentPay ? commentPay : '',
            method: method ? method : 'COINBASE',
            status: 'COMPLETED',
            transactionId,
          },
        },
      },
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Error creating order' }, { status: 500 });
  }
}

export async function GET(req: Request) {

}