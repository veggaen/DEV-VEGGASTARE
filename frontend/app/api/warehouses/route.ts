'use server'

import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';


export async function GET(req: NextRequest) {
  try {
    console.log('Get() Fetching all warehouses');
    const warehouses = await dbPrisma.warehouseLocation.findMany({
      include: {
        inventory: {
          include: {
            product: true,
          },
        },
      },
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