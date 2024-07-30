'use server';

import { dbPrisma } from '@/lib/db';

export async function fetchWarehouses() {
  try {
    console.log('[frontend/actions/fetchWarehouses.ts] Fetching all warehouses');
    const warehouses = await dbPrisma.warehouseLocation.findMany({
      include: {
        inventory: {
          include: {
            product: true,
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