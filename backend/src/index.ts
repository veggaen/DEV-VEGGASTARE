import Hapi from '@hapi/hapi';
import { PrismaClient } from '@prisma/client';
import { initWebSocketServer } from './websocket';
import registerRoutes from './routes';
import dotenv from 'dotenv';
import http from 'http';
import { triggerEvent } from './pusher';

dotenv.config();

const prisma = new PrismaClient();
const LOG_PREFIX = '[backend/src/index.ts]';

const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 3001,
    host: '0.0.0.0'
  });

  registerRoutes(server, prisma);

  const httpServer = http.createServer(server.listener);

  initWebSocketServer(httpServer);

  server.route({
    method: 'POST',
    path: '/api/pusher-trigger',
    handler: (request, h) => {
      const { channel, event, data } = request.payload as any;
      triggerEvent(channel, event, data);
      return h.response({ status: 'success' }).code(200);
    },
  });

  await server.start();
  httpServer.listen(process.env.WS_PORT || 3002, () => {
    console.log(LOG_PREFIX, `HTTP Server running on http://0.0.0.0:${process.env.WS_PORT || 3002}`);
  });

  console.log(LOG_PREFIX, `Hapi Server running on ${server.info.uri}`);
};

process.on('unhandledRejection', (err) => {
  console.log(LOG_PREFIX, err);
  process.exit(1);
});

init();