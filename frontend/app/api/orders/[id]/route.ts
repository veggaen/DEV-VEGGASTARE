import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';

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
  
      return NextResponse.json(order);
    } catch (error) {
      console.error('Error fetching order:', error);
      return NextResponse.json({ error: 'Error fetching order' }, { status: 500 });
    }
  }