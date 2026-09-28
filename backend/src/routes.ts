import { Server, ResponseToolkit } from '@hapi/hapi';
import { z } from 'zod';
import { getBringProvider } from './integrations/bring';

const LOG_PREFIX = '[backend/src/routes.ts]';

// ============ Zod Schemas for Input Validation ============

const shippingRatesSchema = z.object({
  fromCountryCode: z.string().min(1).max(3),
  toCountryCode: z.string().min(1).max(3),
  fromPostalCode: z.string().min(1),
  toPostalCode: z.string().min(1),
  packages: z.array(z.object({
    id: z.string().optional(),
    length: z.number().nonnegative().optional().default(20),
    width: z.number().nonnegative().optional().default(15),
    height: z.number().nonnegative().optional().default(10),
    grossWeight: z.number().nonnegative().optional().default(500),
  }).transform((pkg) => ({
    // Ensure we always have positive values for Bring API
    id: pkg.id,
    length: pkg.length > 0 ? pkg.length : 20,
    width: pkg.width > 0 ? pkg.width : 15,
    height: pkg.height > 0 ? pkg.height : 10,
    grossWeight: pkg.grossWeight > 0 ? pkg.grossWeight : 500,
  }))).min(1, 'At least one package is required'),
  language: z.string().optional(),
  customerNumber: z.string().optional(),
});

const postalSuggestionsSchema = z.object({
  q: z.string().min(1, 'Query parameter q is required'),
  countryCode: z.string().default('no'),
  page: z.coerce.number().int().positive().optional().default(1),
});

// ============ Helper Functions ============

function badRequest(h: ResponseToolkit, message: string) {
  return h.response({ error: message }).code(400);
}

function zodError(h: ResponseToolkit, error: z.ZodError) {
  const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
  return h.response({ error: 'Validation failed', details: issues }).code(400);
}

const registerRoutes = (server: Server): void => {
  server.route({
    method: 'GET',
    path: '/',
    handler: (_request, h) => {
      return 'Hello, World!';
    },
  });

  // These unused prototypes had neither user auth nor tenant authorization.
  // CORS is not authorization. Inventory writes belong to the authenticated app.
  for (const path of ['/api/update', '/api/pusher-trigger']) {
    server.route({
      method: 'POST', path,
      options: { payload: { parse: false, maxBytes: 4096 } },
      handler: (_request, h) => h.response({
        error: 'This legacy integration endpoint has been retired.',
        code: 'LEGACY_ENDPOINT_RETIRED',
      }).code(410).header('Cache-Control', 'no-store'),
    });
  }

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
