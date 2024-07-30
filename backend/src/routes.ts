import { Server } from '@hapi/hapi';
import { PrismaClient } from '@prisma/client';
import { broadcastWarehousesUpdate } from './websocket';

const LOG_PREFIX = '[backend/src/routes.ts]';

const registerRoutes = (server: Server, prisma: PrismaClient) => {
  server.route({
    method: 'GET',
    path: '/',
    handler: (request, h) => {
      return 'Hello, World!';
    },
  });

  server.route({
    method: 'POST',
    path: '/api/update',
    handler: async (request, h) => {
      const { warehouseId, inventoryId, stock } = request.payload as any;

      try {
        console.log(LOG_PREFIX, 'Updating warehouse:', warehouseId, 'inventory:', inventoryId, 'stock:', stock);
        const updatedWarehouse = await prisma.warehouseLocation.update({
          where: { id: warehouseId },
          data: {
            inventory: {
              update: {
                where: { id: inventoryId },
                data: { stock },
              },
            },
          },
        });

        await broadcastWarehousesUpdate(); // Broadcast update to all WebSocket clients

        return h.response('Update broadcasted').code(200);
      } catch (error) {
        console.error(LOG_PREFIX, '[Hapi Server] Error updating warehouse:', error);
        return h.response('Error updating warehouse').code(500);
      }
    },
  });
};

export default registerRoutes;