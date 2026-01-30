'use server';

import { dbPrisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

const LOG_PREFIX = '[frontend/actions/fetchWarehouseById.ts]';

type WarehouseWithInventory = Prisma.WarehouseLocationGetPayload<{
  include: { Inventory: { include: { Product: true } } };
}> | null;

export async function fetchWarehouseById(id: string): Promise<WarehouseWithInventory> {
  try {
    const warehouse = await dbPrisma.warehouseLocation.findUnique({
      where: { id: id },
      include: {
        Inventory: {
          include: {
            Product: true,
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