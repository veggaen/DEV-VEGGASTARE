import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';
import { OrderDtoSchema } from '@/lib/types/orders';

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

// Next.js 16+ params type
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    // Authentication required
    const session = await MyLibUserAuth();
    if (!session?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
  
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
  
    try {
      const order = await dbPrisma.order.findUnique({
        where: {
            id,
        },
        include: {
          Payment: true,
          User: { select: { id: true } },
        },
      });
  
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      // Authorization: Only order owner or admin can view order
      const isOwner = order.User?.id === session.id || order.userId === session.id;
      const isAdmin = session.role === 'ADMIN';
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: 'Forbidden - You cannot view this order' }, { status: 403 });
      }

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
        User: order.User ? { id: order.User.id } : null,
      };

      const parsed = OrderDtoSchema.safeParse(dto);
      if (!parsed.success) {
        console.error('[api/orders/[id]] Invalid GET DTO:', parsed.error);
        return NextResponse.json(
          { error: 'Error fetching order', ...(isDev ? { issues: parsed.error.issues } : {}) },
          { status: 500 }
        );
      }

      return NextResponse.json(parsed.data);
    } catch (error) {
      console.error('Error fetching order:', error);
      return NextResponse.json({ error: 'Error fetching order' }, { status: 500 });
    }
  }