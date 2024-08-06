import { dbPrisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'url';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    const { id } = params
  
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
  
    try {
      const order = await dbPrisma.order.findUnique({
        where: {
            id,
        },
        include: {
          payment: true,
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