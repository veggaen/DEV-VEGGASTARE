import { dbPrisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { OrdersListResponseSchema } from '@/lib/types/orders';

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

// Next.js 16+ params type
type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    // Authentication required
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { userId } = await context.params;
  
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // IDOR Protection: Users can only access their own orders (admins can access all)
    if (session.user.id !== userId && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Cannot access other user\'s orders' }, { status: 403 });
    }
    
    // Rate limiting
    const identifier = getClientIdentifier(request, session.user.id);
    const rateLimitResult = await checkRateLimit(identifier, 'read');
    if (!rateLimitResult.success) {
      return rateLimitedResponse(rateLimitResult);
    }
  
    try {
      const order = await dbPrisma.order.findMany({
        where: {
          userId,
        },
        include: {
          Payment: true,
        },
        take: 100, // Pagination limit for safety
        orderBy: {
          createdAt: 'desc',
        },
      });
  
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
  
      const dto = order.map((o) => {
        const payment = o.Payment
          ? {
              id: o.Payment.id,
              orderId: o.Payment.orderId,
              method: o.Payment.method,
              status: o.Payment.status,
              transactionId: o.Payment.transactionId ?? null,
              commentPay: o.Payment.commentPay ?? null,
              createdAt: toIsoString(o.Payment.createdAt),
              updatedAt: toIsoString(o.Payment.updatedAt),
            }
          : null;

        return {
          id: o.id,
          userId: o.userId,
          totalAmount: o.totalAmount,
          status: o.status,
          transactionId: o.transactionId ?? null,
          commentOrder: o.commentOrder ?? null,
          createdAt: toIsoString(o.createdAt),
          updatedAt: toIsoString(o.updatedAt),
          Payment: payment,
          payment,
        };
      });

      const parsed = OrdersListResponseSchema.safeParse(dto);
      if (!parsed.success) {
        console.error('[api/orders/user/[userId]] Invalid GET DTO:', parsed.error);
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