import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Warehouse ID is required' }, { status: 400 });
  }

  try {
    console.log('[frontend/app/api/warehouses/[...id]/route.ts] GET warehouse details for ID:', id);
    const warehouse = await dbPrisma.warehouseLocation.findUnique({
      where: { id: id },
      include: {
        inventory: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!warehouse) {
      console.log('[frontend/app/api/warehouses/[...id]/route.ts] Warehouse not found for ID:', id);
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }

    const warehouseDetails = {
      warehouse,
      products: warehouse.inventory.map(inv => ({
        product: inv.product,
        stock: inv.stock,
      })),
    };

    console.log('[frontend/app/api/warehouses/[...id]/route.ts] Fetched warehouse details:', warehouseDetails);
    return NextResponse.json(warehouseDetails, { status: 200 });
  } catch (error) {
    console.error('[frontend/app/api/warehouses/[...id]/route.ts] Error fetching warehouse details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}