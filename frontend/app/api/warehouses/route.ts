import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    console.log('Fetching all warehouses');
    const warehouses = await dbPrisma.warehouseLocation.findMany({
      include: {
        inventory: {
          include: {
            product: true,
          },
        },
      },
    });
    console.log('Fetched warehouses:', warehouses);
    return NextResponse.json(warehouses, { status: 200 });
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json({ error: 'Failed to fetch warehouses' }, { status: 500 });
  }
}