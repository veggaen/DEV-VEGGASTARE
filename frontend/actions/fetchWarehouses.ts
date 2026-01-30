'use server';

import { dbPrisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

type WarehouseWithInventory = Prisma.WarehouseLocationGetPayload<{
  include: { Inventory: { include: { Product: true } } };
}>;

export async function fetchWarehouses(): Promise<WarehouseWithInventory[]> {
  try {
    console.log('[frontend/actions/fetchWarehouses.ts] Fetching all warehouses');
    const warehouses = await dbPrisma.warehouseLocation.findMany({
      include: {
        Inventory: {
          include: {
            Product: true,
          },
        },
      },
    });
    console.log('[frontend/actions/fetchWarehouses.ts] Successfully fetched warehouses:', warehouses.length);
    
    return warehouses;
  } catch (error) {
    console.error('[frontend/actions/fetchWarehouses.ts] Failed to fetch warehouses:', error);
    throw new Error('[frontend/actions/fetchWarehouses.ts] Failed to fetch warehouses');
  }
}