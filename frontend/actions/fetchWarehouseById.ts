'use server';

import { dbPrisma } from '@/lib/db';
import { Prisma } from '@/generated/prisma/browser';
import { MyLibUserAuth } from '@/lib/user-auth';

const LOG_PREFIX = '[frontend/actions/fetchWarehouseById.ts]';

type WarehouseWithInventory = Prisma.WarehouseLocationGetPayload<{
  include: { Inventory: { include: { Product: true } } };
}> | null;

export async function fetchWarehouseById(id: string): Promise<WarehouseWithInventory> {
  const session = await MyLibUserAuth();
  if (!session?.id || !['ADMIN', 'OWNER'].includes(session.role)) throw new Error('Forbidden');
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
