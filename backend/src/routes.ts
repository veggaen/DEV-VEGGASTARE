import { Server, ResponseToolkit, Request } from '@hapi/hapi';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { broadcastWarehousesUpdate } from './websocket';
import { getBringProvider } from './integrations/bring';
import { isDbConfigured } from './db';

const LOG_PREFIX = '[backend/src/routes.ts]';

type JsonObject = Record<string, unknown>;

// ============ Zod Schemas for Input Validation ============

const updateWarehouseSchema = z.object({
  warehouseId: z.string().min(1, 'warehouseId is required'),
  inventoryId: z.string().min(1, 'inventoryId is required'),
  stock: z.number().int().min(0, 'stock must be a non-negative integer'),
});

const shippingRatesSchema = z.object({
  fromCountryCode: z.string().min(1).max(3),
  toCountryCode: z.string().min(1).max(3),
  fromPostalCode: z.string().min(1),
  toPostalCode: z.string().min(1),
  packages: z.array(z.object({
    length: z.number().positive().optional().default(10),
    width: z.number().positive().optional().default(10),
    height: z.number().positive().optional().default(10),
    grossWeight: z.number().positive().optional().default(300),
  })).min(1, 'At least one package is required'),
  language: z.string().optional(),
  customerNumber: z.string().optional(),
});

const postalSuggestionsSchema = z.object({
  q: z.string().min(1, 'Query parameter q is required'),
  countryCode: z.string().default('no'),
  page: z.coerce.number().int().positive().optional().default(1),
});

const pusherTriggerSchema = z.object({
  channel: z.string().min(1),
  event: z.string().min(1),
  data: z.unknown(),
});

// ============ Helper Functions ============

function badRequest(h: ResponseToolkit, message: string) {
  return h.response({ error: message }).code(400);
}

function zodError(h: ResponseToolkit, error: z.ZodError) {
  const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
  return h.response({ error: 'Validation failed', details: issues }).code(400);
}

const registerRoutes = (server: Server, prisma: PrismaClient): void => {
  server.route({
    method: 'GET',
    path: '/',
    handler: (_request, h) => {
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

      // Validate input with Zod
      const parsed = updateWarehouseSchema.safeParse(request.payload);
      if (!parsed.success) {
        return zodError(h, parsed.error);
      }

      const { warehouseId, inventoryId, stock } = parsed.data;

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
      // Validate input with Zod
      const parsed = shippingRatesSchema.safeParse(request.payload);
      if (!parsed.success) {
        return zodError(h, parsed.error);
      }

      const { fromCountryCode, toCountryCode, fromPostalCode, toPostalCode, packages, language, customerNumber } = parsed.data;

      const provider = getBringProvider();

      try {
        const options = await provider.getRates({
          fromCountryCode,
          toCountryCode,
          fromPostalCode,
          toPostalCode,
          packages: packages.map((p) => ({
            length: p.length,
            width: p.width,
            height: p.height,
            grossWeight: p.grossWeight,
          })),
          language,
          customerNumber,
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
      // Validate input with Zod (same schema as rates)
      const parsed = shippingRatesSchema.safeParse(request.payload);
      if (!parsed.success) {
        return zodError(h, parsed.error);
      }

      const { fromCountryCode, toCountryCode, fromPostalCode, toPostalCode, packages, language, customerNumber } = parsed.data;

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
          packages: packages.map((p) => ({
            length: p.length,
            width: p.width,
            height: p.height,
            grossWeight: p.grossWeight,
          })),
          language,
          customerNumber,
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
      // Validate query params with Zod
      const parsed = postalSuggestionsSchema.safeParse(request.query);
      if (!parsed.success) {
        return zodError(h, parsed.error);
      }

      const { q, countryCode, page } = parsed.data;

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
      const trackingNumber = String(request.params?.trackingNumber ?? '').trim();
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