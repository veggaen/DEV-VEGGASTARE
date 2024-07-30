import Hapi from '@hapi/hapi';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();
const wss = new WebSocketServer({ port: Number(process.env.WS_PORT) || 3002 });
const LOG_PREFIX = '[backend/src/index.ts]';

const broadcast = async () => {
  try {
    const warehouses = await prisma.warehouseLocation.findMany({
      include: {
        inventory: {
          include: {
            product: true,
          },
        },
      },
    });
    const payload = {
      type: 'WAREHOUSES_UPDATE',
      payload: warehouses,
    };
    console.log(LOG_PREFIX, '[WebSocket Server] Broadcasting message:', payload);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    });
  } catch (error) {
    console.error('[WebSocket Server] Error broadcasting warehouses:', error);
  }
};

const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 3001,
    host: '0.0.0.0' // Change this to 0.0.0.0
  });

  server.route({
    method: 'GET',
    path: '/',
    handler: (request, h) => {
      return 'Hello, World!';
    }
  });

  server.route({
    method: 'POST',
    path: '/api/update',
    handler: async (request, h) => {
      const { warehouseId, inventoryId, stock } = request.payload as any;

      try {
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

        console.log(LOG_PREFIX, '[Hapi Server] Warehouse updated:', updatedWarehouse);
        await broadcast();

        return h.response('Update broadcasted').code(200);
      } catch (error) {
        console.error('[Hapi Server] Error updating warehouse:', error);
        return h.response('Error updating warehouse').code(500);
      }
    }
  });

  await server.start();
  console.log(LOG_PREFIX, `Server running on ${server.info.uri}`);
};

wss.on('connection', (ws: WebSocket) => {
  console.log(LOG_PREFIX, '[WebSocket Server] Client connected');

  ws.on('close', () => {
    console.log(LOG_PREFIX, '[WebSocket Server] Client disconnected');
  });

  ws.on('message', (message) => {
    console.log(LOG_PREFIX, '[WebSocket Server] Message received:', message.toString());
    const data = JSON.parse(message.toString());
    if (data.type === 'UPDATE_WAREHOUSES') {
      broadcast();
    }
  });
});

console.log(LOG_PREFIX, `[WebSocket Server] Listening on port ${Number(process.env.WS_PORT) || 3002}`);

process.on('unhandledRejection', (err) => {
  console.log(LOG_PREFIX, err);
  process.exit(1);
});

init();