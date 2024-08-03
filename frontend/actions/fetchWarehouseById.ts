'use server';

import { dbPrisma } from '@/lib/db';

const LOG_PREFIX = '[frontend/actions/fetchWarehouseById.ts]';

export async function fetchWarehouseById(id: string) {
  try {
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
    return warehouse;
  } catch (error) {
    console.error('Failed to fetch warehouse by id:', error);
    throw error;
  }
}