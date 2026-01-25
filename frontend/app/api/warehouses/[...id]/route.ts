import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { parseQueryOrError } from '@/lib/api-validate';
import { z } from 'zod';

const isDev = process.env.NODE_ENV !== 'production';

const querySchema = z.object({
  id: z.string().trim().min(1).max(200),
});

export async function GET(req: NextRequest) {
  const queryResult = parseQueryOrError(req, querySchema);
  if (!queryResult.ok) return queryResult.response;
  const { id } = queryResult.data;

  try {
    if (isDev) console.log('[frontend/app/api/warehouses/[...id]/route.ts] GET warehouse details for ID:', id);
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

    if (isDev) console.log('[frontend/app/api/warehouses/[...id]/route.ts] Fetched warehouse details');
    return NextResponse.json(warehouseDetails, { status: 200 });
  } catch (error) {
    console.error('[frontend/app/api/warehouses/[...id]/route.ts] Error fetching warehouse details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}