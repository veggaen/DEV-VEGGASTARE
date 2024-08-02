import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { PrismaClient } from '@prisma/client';
import { setupKeepAlive } from './utils/keepAlive';
import { triggerEvent } from './pusher';

let io: SocketIOServer;
const prisma = new PrismaClient();
const LOG_PREFIX = '[backend/src/websocket.ts]';

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
    console.log(LOG_PREFIX, '[Socket.IO] Broadcasting message:', JSON.stringify(payload, null, 2));
    io.emit('WAREHOUSES_UPDATE', payload);

    // Trigger Pusher event
    triggerEvent('MainChannelUpdateWarehouse', 'UPDATE_WAREHOUSES', payload);
  } catch (error) {
    console.error(LOG_PREFIX, '[Socket.IO] Error broadcasting warehouses:', error);
  }
};