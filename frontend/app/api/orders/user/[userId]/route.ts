import { dbPrisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Next.js 16+ params type
type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    const { userId } = await context.params;
  
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
  
    try {
      const order = await dbPrisma.order.findMany({
        where: {
          userId,
        },
        include: {
          Payment: true,
        },
      });
  
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
  
      return NextResponse.json(order);
    } catch (error) {
      console.error('Error fetching order:', error);
      return NextResponse.json({ error: 'Error fetching order' }, { status: 500 });
    }
  }