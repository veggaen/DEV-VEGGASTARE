import { dbbPrisma } from "./db";
import { triggerEvent } from "./pusher";
import { WarehouseLocation } from "@prisma/client";

type UpdateResult = 
  | { status: 200; data: WarehouseLocation }
  | { status: 500; message: string };

const LOG_PREFIX = '[backend/src/updateWarehouseInventory.ts]'
export async function updateWarehouseInventory(warehouseId: string, inventoryId: string, stock: number): Promise<UpdateResult> {
  try {

    const updatedWarehouse = await dbbPrisma.warehouseLocation.update({
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
    console.log(LOG_PREFIX, 'Warehouse updated successfully:', updatedWarehouse);

    // Trigger Pusher event
    triggerEvent('MainChannelUpdateWarehouse', 'my-event-warehouse', { warehouseId, inventoryId, stock });
    console.log(LOG_PREFIX, 'Pusher event triggered: ', { warehouseId, inventoryId, stock });

    return { status: 200, data: updatedWarehouse };

  } catch (error) {
    console.error(LOG_PREFIX, 'Error updating warehouse:', error);
    return { status: 500, message: 'Failed to update warehouse' };
  }
}