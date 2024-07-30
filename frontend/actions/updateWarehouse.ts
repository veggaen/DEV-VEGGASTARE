'use server';

import { dbPrisma } from '@/lib/db';
import { MyLibRoleAuth } from '@/lib/user-auth';
import { UserRole } from '@prisma/client';
import { io } from 'socket.io-client';

const LOG_PREFIX = '[frontend/actions/updateWarehouse.ts]';

export async function updateWarehouseInventory(warehouseId: string, inventoryId: string, stock: number) {
  try {
    const role = await MyLibRoleAuth();

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
    });
    console.log(LOG_PREFIX, 'Warehouse updated successfully:', updatedWarehouse);

    // Socket.IO message
    const wsUrl = process.env.NODE_ENV === 'production'
      ? 'https://dev-veggastare.vercel.app'
      : 'http://localhost:3002';

    const socket = io(wsUrl, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log(LOG_PREFIX, 'Socket.IO connection opened', socket.id);
      socket.emit('UPDATE_WAREHOUSES');
      socket.disconnect();
    });

    socket.on('connect_error', (error) => {
      console.error(LOG_PREFIX, 'Socket.IO connection error:', error);
    });

    socket.on('error', (error) => {
      console.error(LOG_PREFIX, 'Socket.IO error:', error);
    });

    socket.on('disconnect', (reason) => {
      console.log(LOG_PREFIX, 'Socket.IO connection closed:', reason);
    });

    return { status: 200, data: updatedWarehouse };

  } catch (error) {
    console.error(LOG_PREFIX, 'Error updating warehouse:', error);
    return { status: 500, message: 'Failed to update warehouse' };
  }
}