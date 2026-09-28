import dotenv from 'dotenv';
dotenv.config(); // Load env vars FIRST before any other imports that use them

import Hapi from '@hapi/hapi';
import { initWebSocketServer } from './websocket';
import registerRoutes from './routes';
import http from 'http';
const LOG_PREFIX = '[backend/src/index.ts]';
const shouldLogRequests =
  process.env.LOG_REQUESTS === '1' ||
  process.env.LOG_HTTP === '1' ||
  process.env.BACKEND_LOG_REQUESTS === '1';

const init = async (): Promise<void> => {
  const railwayEnv = (process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_ENVIRONMENT || '').toLowerCase();
  const isProduction = process.env.NODE_ENV === 'production' || railwayEnv === 'production';
  const httpPort = Number(process.env.PORT) || 3001;
  const wsPort = Number(process.env.WS_PORT) || 3002;
  const corsOrigins = isProduction
    ? (process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
        : [])
    : ['*'];

  const corsConfig: false | { origin: string[]; additionalHeaders: string[] } =
    isProduction && corsOrigins.length === 0
      ? false
      : {
          origin: corsOrigins,
          additionalHeaders: ['x-request-id', 'x-nonce'],
        };

  console.log(LOG_PREFIX, `Starting in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
  console.log(LOG_PREFIX, `Ports: http=${httpPort} ws=${wsPort}`);
  if (isProduction) {
    console.log(
      LOG_PREFIX,
      `CORS allowed origins: ${corsOrigins.length > 0 ? corsOrigins.join(', ') : '(none - CORS disabled)'}`
    );
  }

  const server = Hapi.server({
    port: httpPort,
    host: '0.0.0.0',
    routes: {
      cors: corsConfig,
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

  // Shipping adapters need no application DB. Retired warehouse prototypes must
  // not open a privileged connection or publish inventory on public channels.
  registerRoutes(server);

  const httpServer = http.createServer((_request, response) => {
    response.writeHead(410, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Legacy realtime is unavailable.' }));
  });

  initWebSocketServer(httpServer);

  await server.start();
  httpServer.listen(wsPort, () => {
    console.log(LOG_PREFIX, `WS Server running on http://0.0.0.0:${wsPort}`);
  });

  console.log(LOG_PREFIX, `Hapi Server running on ${server.info.uri}`);
};

process.on('unhandledRejection', () => {
  console.error(LOG_PREFIX, 'Unhandled rejection; stopping integration service.');
  process.exit(1);
});

init();
