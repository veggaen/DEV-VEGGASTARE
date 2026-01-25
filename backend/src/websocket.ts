import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { setupKeepAlive } from './utils/keepAlive';
import { triggerEvent } from './pusher';
import { dbbPrisma } from './db';
import { isDbConfigured } from './db';

let io: SocketIOServer;
const LOG_PREFIX = '[backend/src/websocket.ts]';
const isDev = process.env.NODE_ENV !== 'production';

export const initWebSocketServer = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(LOG_PREFIX, '[Socket.IO] Client connected', socket.id);

    // Setup keep-alive for this socket
    setupKeepAlive(socket);

    socket.on('disconnect', (reason) => {
      console.log(LOG_PREFIX, '[Socket.IO] Client disconnected:', reason, socket.id);
    });

    socket.on('UPDATE_WAREHOUSES', async () => {
      console.log(LOG_PREFIX, '[Socket.IO] Received UPDATE_WAREHOUSES event from', socket.id);
      await broadcastWarehousesUpdate();
    });

    socket.on('error', (error) => {
      console.error(LOG_PREFIX, '[Socket.IO] Error from', socket.id, ':', error);
    });

    // Additional event logging
    socket.onAny((event, ...args) => {
      console.log(LOG_PREFIX, '[Socket.IO] Event received:', event, 'from', socket.id, 'with args:', args);
    });
  });

  console.log(LOG_PREFIX, '[Socket.IO] WebSocket Server initialized');
};

export const broadcastWarehousesUpdate = async () => {
  try {
    if (!isDbConfigured) {
      console.warn(LOG_PREFIX, '[Socket.IO] DB not configured; skipping warehouse broadcast.');
      return;
    }
    const warehouses = await dbbPrisma.warehouseLocation.findMany({
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
    if (isDev) console.log(LOG_PREFIX, `[Socket.IO] Broadcasting warehouses: ${warehouses.length}`);
    io.emit('WAREHOUSES_UPDATE', payload);

    // Trigger Pusher event
    triggerEvent('MainChannelUpdateWarehouse', 'UPDATE_WAREHOUSES', payload);
  } catch (error) {
    console.error(LOG_PREFIX, '[Socket.IO] Error broadcasting warehouses:', error);
  }
};