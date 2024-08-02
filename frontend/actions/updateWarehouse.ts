'use server';

import { dbPrisma } from '@/lib/db';
import { MyLibRoleAuth } from '@/lib/user-auth';
import { UserRole } from '@prisma/client';
import { pusherServer } from '@/lib/pusher'; // Import the pusherServer

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

    const updatedWarehouse = await dbPrisma.warehouseLocation.update({
      where: { id: warehouseId },
      data: {
        inventory: {
          updateMany: {
            where: { id: inventoryId },
            data: { stock },
          },
        },
      },
      include: {
        inventory: {
          where: { id: inventoryId },
          include: {
            product: true,
          },
        },
      },
    });

    console.log(LOG_PREFIX, 'Warehouse updated successfully:', updatedWarehouse);

    try {
      const inventoryItem = updatedWarehouse.inventory.find(item => item.id === inventoryId);
      console.log(LOG_PREFIX, 'Triggering Pusher event for warehouse update');
      await pusherServer.trigger(`WarehouseChannel_${warehouseId}`, 'my-event-warehouse', {
        type: 'INVENTORY_UPDATE',
        payload: {
          warehouseId,
          inventoryId,
          stock,
          product: inventoryItem?.product,
        },
      });
      console.log(LOG_PREFIX, 'Pusher event triggered successfully');
    } catch (pusherError) {
      console.error(LOG_PREFIX, 'Error triggering Pusher event:', pusherError);
    }

    return { status: 200, data: updatedWarehouse };

  } catch (error) {
    console.error(LOG_PREFIX, 'Error updating warehouse:', error);
    return { status: 500, message: 'Failed to update warehouse' };
  }
}