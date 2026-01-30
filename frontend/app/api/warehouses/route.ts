import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';

export async function GET(req: NextRequest) {
  try {
    // Authentication required to view warehouses with inventory
    const session = await MyLibUserAuth();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Get() Fetching all warehouses');
    
    // Regular users can only see basic warehouse info
    // Admin/Owner can see full inventory details
    const isAdmin = session.role === 'ADMIN' || session.role === 'OWNER';

    const warehouses = await dbPrisma.warehouseLocation.findMany({
      include: isAdmin ? {
        Inventory: {
          include: {
            Product: {
              select: {
                id: true,
                title: true,
                price: true,
                stock: true,
              },
            },
          },
        },
      } : undefined,
    });

    if (warehouses.length > 0) {
      console.log('Successfully fetched warehouses:', warehouses.length);
    }
    return NextResponse.json(warehouses, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch warehouses:', error);
    return NextResponse.json({ error: 'Failed to fetch warehouses' }, { status: 500 });
  }
}