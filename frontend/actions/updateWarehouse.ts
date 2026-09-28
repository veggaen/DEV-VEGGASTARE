'use server';

import { dbPrisma } from '@/lib/db';
import { MyLibRoleAuth } from '@/lib/user-auth';
import { UserRole } from '@/generated/prisma/browser';
import { publishWarehouseInvalidation } from '@/lib/warehouse-events';
import { z } from 'zod';

const LOG_PREFIX = '[frontend/actions/updateWarehouse.ts]';
const adjustment = z.object({ warehouseId: z.string().min(1).max(200), inventoryId: z.string().min(1).max(200), action: z.enum(['add', 'subtract']) });
class StockError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export async function updateWarehouseInventory(warehouseId: string, inventoryId: string, action: 'add' | 'subtract') {
  try {
    const role = await MyLibRoleAuth();

    if (role !== UserRole.ADMIN) {
      return { status: 403, message: 'Forbidden' };
    }
    if (!adjustment.safeParse({ warehouseId, inventoryId, action }).success) return { status: 400, message: 'Invalid stock adjustment' };

    const updatedInventory = await dbPrisma.$transaction(async (prisma) => {
      const inventory = await prisma.inventory.findUnique({
        where: { id: inventoryId },
        select: { version: true, stock: true, warehouseId: true },
      });

      if (!inventory || inventory.warehouseId !== warehouseId) {
        throw new StockError(404, 'Inventory item not found in this warehouse');
      }

      const newStock = action === 'add' ? inventory.stock + 1 : inventory.stock - 1;
      if (!Number.isSafeInteger(newStock) || newStock < 0 || newStock > 2_147_483_647) throw new StockError(409, 'Stock cannot be adjusted beyond its available range. Refresh and review the inventory.');

      const newInventory = await prisma.inventory.update({
        where: { id_version: { id: inventoryId, version: inventory.version }, warehouseId },
        data: {
          stock: newStock,
          version: inventory.version + 1,
        },
      });

      return prisma.inventory.findUnique({
        where: { id: newInventory.id },
        select: {
          id: true,
          stock: true,
          version: true,
          Product: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });
    });

    try {
      await publishWarehouseInvalidation(warehouseId);
    } catch {
      console.warn(LOG_PREFIX, 'Inventory saved; refresh notification unavailable.');
    }

    return { status: 200, data: updatedInventory };

  } catch (error) {
    if (error instanceof StockError) return { status: error.status, message: error.message };
    if (error && typeof error === 'object' && 'code' in error && ['P2025', 'P2034'].includes(String(error.code))) return { status: 409, message: 'Stock changed while saving. Refresh before trying again.' };
    console.error(LOG_PREFIX, 'Stock adjustment could not be confirmed.');
    return { status: 500, message: 'Failed to update warehouse' };
  }
}
