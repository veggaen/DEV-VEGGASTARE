import Hapi from '@hapi/hapi';
import { initWebSocketServer } from './websocket';
import registerRoutes from './routes';
import dotenv from 'dotenv';
import http from 'http';
import { isPusherConfigured, triggerEvent } from './pusher';
import { dbbPrisma } from './db';
import { isDbConfigured } from './db';

dotenv.config();
const LOG_PREFIX = '[backend/src/index.ts]';
const shouldLogRequests =
  process.env.LOG_REQUESTS === '1' ||
  process.env.LOG_HTTP === '1' ||
  process.env.BACKEND_LOG_REQUESTS === '1';

const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 3001,
    host: '0.0.0.0',
    routes: {
      cors: {
        origin:
          process.env.NODE_ENV === 'production'
            ? (process.env.CORS_ORIGINS
                ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
                : [])
            : ['*'],
        additionalHeaders: ['x-request-id', 'x-nonce'],
      },
    },
  });

  if (shouldLogRequests) {
    server.ext('onRequest', (request, h) => {
      (request.app as any).startTime = Date.now();
      return h.continue;
    });

    server.ext('onPreResponse', (request, h) => {
      const start = (request.app as any).startTime as number | undefined;
      const ms = typeof start === 'number' ? Date.now() - start : undefined;

      const res: any = request.response;
      const statusCode = res?.isBoom ? res.output?.statusCode : res?.statusCode;
      const status = typeof statusCode === 'number' ? statusCode : '-';

      console.log(
        `${LOG_PREFIX} ${request.method.toUpperCase()} ${request.path} ${status} ${
          typeof ms === 'number' ? `${ms}ms` : '-'
        }`
      );
      return h.continue;
    });
  }

  if (isDbConfigured) {
    const prismaConnectStart = Date.now();
    await dbbPrisma.$connect();
    console.log(LOG_PREFIX, `Prisma connected in ${Date.now() - prismaConnectStart}ms`);
  } else {
    console.log(LOG_PREFIX, 'DATABASE_URL_NEON missing: skipping Prisma connection (shipping demo mode).');
  }

  registerRoutes(server, dbbPrisma);

  const httpServer = http.createServer(server.listener);

  initWebSocketServer(httpServer);

  server.route({
    method: 'POST',
    path: '/api/pusher-trigger',
    handler: (request, h) => {
      if (!isPusherConfigured) {
        return h
          .response({ error: 'Pusher is not configured on this server.' })
          .code(503);
      }
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