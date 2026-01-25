import { Server } from '@hapi/hapi';
import { PrismaClient } from '@prisma/client';
import { broadcastWarehousesUpdate } from './websocket';
import { getBringProvider } from './integrations/bring';
import { isDbConfigured } from './db';

const LOG_PREFIX = '[backend/src/routes.ts]';

type JsonObject = Record<string, unknown>;

function badRequest(h: any, message: string) {
  return h.response({ error: message }).code(400);
}

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
      if (!isDbConfigured) {
        return h
          .response({ error: 'DATABASE_URL_NEON not set (DB disabled). Warehouse updates unavailable.' })
          .code(503);
      }

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

        await broadcastWarehousesUpdate(); // Broadcast update to all WebSocket clients and Pusher

        return h.response('Update broadcasted').code(200);
      } catch (error) {
        console.error(LOG_PREFIX, '[Hapi Server] Error updating warehouse:', error);
        return h.response('Error updating warehouse').code(500);
      }
    },
  });

  // ---- Integration Core v1 (public-ish) ----
  server.route({
    method: 'GET',
    path: '/v1/health',
    handler: (_request, h) => {
      return h
        .response({ ok: true, service: 'backend', time: new Date().toISOString() })
        .code(200);
    },
  });

  server.route({
    method: 'POST',
    path: '/v1/shipping/rates',
    handler: async (request, h) => {
      const payload = (request.payload ?? {}) as JsonObject;

      const fromCountryCode = String(payload.fromCountryCode ?? '').trim();
      const toCountryCode = String(payload.toCountryCode ?? '').trim();
      const fromPostalCode = String(payload.fromPostalCode ?? '').trim();
      const toPostalCode = String(payload.toPostalCode ?? '').trim();
      const packages = Array.isArray(payload.packages) ? payload.packages : null;

      if (!fromCountryCode || !toCountryCode || !fromPostalCode || !toPostalCode) {
        return badRequest(h, 'Missing required fields: from/to countryCode and postalCode');
      }
      if (!packages || packages.length === 0) {
        return badRequest(h, 'Missing required field: packages[]');
      }

      const provider = getBringProvider();

      try {
        const options = await provider.getRates({
          fromCountryCode,
          toCountryCode,
          fromPostalCode,
          toPostalCode,
          packages: packages.map((p: any) => ({
            length: Number(p?.length ?? 10),
            width: Number(p?.width ?? 10),
            height: Number(p?.height ?? 10),
            grossWeight: Number(p?.grossWeight ?? 300),
          })),
          language: typeof payload.language === 'string' ? payload.language : undefined,
          customerNumber:
            typeof payload.customerNumber === 'string' ? payload.customerNumber : undefined,
        });

        const mode = (process.env.BRING_MODE || '').toLowerCase() === 'live' ? 'bring' : 'mock';
        return h.response({ provider: mode, options }).code(200);
      } catch (err) {
        console.error(LOG_PREFIX, '[v1/shipping/rates] error:', err);
        return h.response({ error: (err as Error).message || 'Failed to get rates' }).code(502);
      }
    },
  });

  // Rich Bring Shipping Guide v2 response (for template UI compatibility)
  server.route({
    method: 'POST',
    path: '/v1/shipping/bring/products',
    handler: async (request, h) => {
      const payload = (request.payload ?? {}) as JsonObject;

      const fromCountryCode = String(payload.fromCountryCode ?? '').trim();
      const toCountryCode = String(payload.toCountryCode ?? '').trim();
      const fromPostalCode = String(payload.fromPostalCode ?? '').trim();
      const toPostalCode = String(payload.toPostalCode ?? '').trim();
      const packages = Array.isArray(payload.packages) ? payload.packages : null;

      if (!fromCountryCode || !toCountryCode || !fromPostalCode || !toPostalCode) {
        return badRequest(h, 'Missing required fields: from/to countryCode and postalCode');
      }
      if (!packages || packages.length === 0) {
        return badRequest(h, 'Missing required field: packages[]');
      }

      const provider = getBringProvider();
      if (!provider.getShippingGuideProductsRaw) {
        return h
          .response({ error: 'Bring provider does not support rich products response.' })
          .code(501);
      }

      try {
        const data = await provider.getShippingGuideProductsRaw({
          fromCountryCode,
          toCountryCode,
          fromPostalCode,
          toPostalCode,
          packages: packages.map((p: any) => ({
            length: Number(p?.length ?? 10),
            width: Number(p?.width ?? 10),
            height: Number(p?.height ?? 10),
            grossWeight: Number(p?.grossWeight ?? 300),
          })),
          language: typeof payload.language === 'string' ? payload.language : undefined,
          customerNumber:
            typeof payload.customerNumber === 'string' ? payload.customerNumber : undefined,
        });

        // Ensure we always return JSON.
        if (data && typeof data === 'object') {
          return h.response(data as Record<string, unknown>).code(200);
        }
        return h.response({ data }).code(200);
      } catch (err) {
        console.error(LOG_PREFIX, '[v1/shipping/bring/products] error:', err);
        return h
          .response({ error: (err as Error).message || 'Failed to get Bring products' })
          .code(502);
      }
    },
  });

  server.route({
    method: 'GET',
    path: '/v1/shipping/postal-codes/suggestions',
    handler: async (request, h) => {
      const q = String((request.query as any)?.q ?? '').trim();
      const countryCode = String((request.query as any)?.countryCode ?? 'no').trim();
      const pageRaw = (request.query as any)?.page;
      const page = pageRaw ? Math.max(1, Number(pageRaw)) : 1;

      if (!q) return badRequest(h, 'Missing required query param: q');

      const provider = getBringProvider();
      try {
        const suggestions = await provider.suggestPostalCodes({
          countryCode,
          query: q,
          page,
        });
        return h.response({ suggestions }).code(200);
      } catch (err) {
        console.error(LOG_PREFIX, '[v1/shipping/postal-codes/suggestions] error:', err);
        return h
          .response({ error: (err as Error).message || 'Failed to get suggestions' })
          .code(502);
      }
    },
  });

  server.route({
    method: 'GET',
    path: '/v1/shipping/tracking/{trackingNumber}',
    handler: async (request, h) => {
      const trackingNumber = String((request.params as any)?.trackingNumber ?? '').trim();
      if (!trackingNumber) return badRequest(h, 'Missing trackingNumber');

      const provider = getBringProvider();
      try {
        const result = await provider.track(trackingNumber);
        // Hapi's typings are strict; ensure we always respond with a JSON object.
        if (result && typeof result === 'object') {
          return h.response(result as Record<string, unknown>).code(200);
        }
        return h.response({ result }).code(200);
      } catch (err) {
        console.error(LOG_PREFIX, '[v1/shipping/tracking] error:', err);
        return h.response({ error: (err as Error).message || 'Failed to track' }).code(502);
      }
    },
  });
};

export default registerRoutes;