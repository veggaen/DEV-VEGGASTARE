'use server';

import { dbPrisma } from '@/lib/db';
import { MyLibRoleAuth } from '@/lib/user-auth';
import { UserRole } from '@prisma/client';
import { pusherServer } from '@/lib/pusher';

const LOG_PREFIX = '[frontend/actions/updateWarehouse.ts]';

export async function updateWarehouseInventory(warehouseId: string, inventoryId: string, stock: number) {
  console.log(LOG_PREFIX, 'Starting update for warehouse:', warehouseId, 'inventory:', inventoryId, 'stock:', stock);

  try {
    const role = await MyLibRoleAuth();
    console.log(LOG_PREFIX, 'User role:', role);

    if (role !== UserRole.ADMIN) {
      console.log(LOG_PREFIX, 'Warehouse update failed: Missing permissions for user role', role);
      return { status: 403, message: 'Forbidden' };
    }

    const updatedInventory = await dbPrisma.$transaction(async (prisma) => {
      const inventory = await prisma.inventory.findUnique({
        where: { id: inventoryId },
        select: { version: true },
      });

      if (!inventory) {
        throw new Error('Inventory item not found');
      }

      const newInventory = await prisma.inventory.update({
        where: { id_version: { id: inventoryId, version: inventory.version } },
        data: {
          stock,
          version: inventory.version + 1,
        },
      });

      return prisma.inventory.findUnique({
        where: { id: newInventory.id },
        select: {
          id: true,
          stock: true,
          version: true,
          product: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });
    });

    console.log(LOG_PREFIX, 'Inventory updated successfully:', updatedInventory);

    try {
      console.log(LOG_PREFIX, 'Triggering Pusher event for warehouse update');
      await pusherServer.trigger(`WarehouseChannel_${warehouseId}`, 'my-event-warehouse', {
        type: 'INVENTORY_UPDATE',
        payload: {
          warehouseId,
          inventoryId,
          stock,
          version: updatedInventory?.version,
          product: {
            id: updatedInventory?.product?.id,
            title: updatedInventory?.product?.title,
          },
        },
      });
      console.log(LOG_PREFIX, 'Pusher event triggered successfully');
    } catch (pusherError) {
      console.error(LOG_PREFIX, 'Error triggering Pusher event:', pusherError);
    }

    return { status: 200, data: updatedInventory };

  } catch (error) {
    console.error(LOG_PREFIX, 'Error updating warehouse:', error);
    return { status: 500, message: 'Failed to update warehouse' };
  }
}