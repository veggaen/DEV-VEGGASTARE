import { WebSocketServer, WebSocket } from 'ws';
import { dbbPrisma } from './db';

let wss: WebSocketServer;
const LOG_PREFIX = '[backend/src/websocket.ts]'
export const initWebSocketServer = (port: number) => {
  wss = new WebSocketServer({ port });

  wss.on('connection', (ws: WebSocket) => {
    console.log(LOG_PREFIX, '[WebSocket Server] Client connected');

    ws.on('close', () => {
      console.log(LOG_PREFIX, '[WebSocket Server] Client disconnected');
    });
  });

  console.log(LOG_PREFIX, `[WebSocket Server] Listening on port ${port}`);
};

export const broadcast = async (warehouseId: string) => {
    try {
      const updatedWarehouse = await dbbPrisma.warehouseLocation.findUnique({
        where: {
          id: warehouseId, // Ensure this is passed correctly
        },
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
        payload: updatedWarehouse,
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