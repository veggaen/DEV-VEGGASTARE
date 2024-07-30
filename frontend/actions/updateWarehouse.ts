'use server';

import { dbPrisma } from '@/lib/db';
import { MyLibRoleAuth } from '@/lib/user-auth';
import { UserRole } from '@prisma/client';

export async function updateWarehouseInventory(warehouseId: string, inventoryId: string, stock: number) {
  try {
    const role = await MyLibRoleAuth();

    if (role !== UserRole.ADMIN) {
      console.log('[frontend/actions/updateWarehouse.ts] Warehouse update failed: Missing permissions for user role', role);
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
    });
    console.log('[frontend/actions/updateWarehouse.ts] Warehouse updated successfully:', updatedWarehouse);

    // WebSocket message
    const ws = new WebSocket('ws://localhost:3002');
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'UPDATE_WAREHOUSES' }));
      ws.close();
    };
    
    return { status: 200, data: updatedWarehouse };

  } catch (error) {
    console.error('[frontend/actions/updateWarehouse.ts] Error updating warehouse:', error);
    return { status: 500, message: 'Failed to update warehouse' };
  }
}