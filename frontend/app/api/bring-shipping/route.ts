import type { NextRequest } from 'next/server';
import { parseJsonOrError } from '@/lib/api-validate';
import { getIntegrationCoreBaseUrl } from '@/lib/integration-core';
import { z } from 'zod';

// Define TypeScript interfaces for the request body and the Bring API response
export interface BringShippingRequestBody {
  language: string;
  withPrice: boolean;
  withExpectedDelivery: boolean;
  withGuiInformation: boolean;
  numberOfAlternativeDeliveryDates: number;
  edi: boolean;
  postingAtPostOffice: boolean;
  trace: boolean;
  consignments: Array<any >;
  productSpecifications: {
    length: number;
    width: number;
    height: number;
    grossWeight: number;
  };
}

interface BringApiResponse {
  // Define the structure based on the Bring API response
  consignments: Array<any>; // Simplified for example purposes
}

const bringApiUID = process.env.BRING_SHIPPING_API_UID;
const bringApiKey = process.env.BRING_SHIPPING_API_KEY;

function normalizePackages(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((p: any) => ({
      length: Number(p?.length ?? 0),
      width: Number(p?.width ?? 0),
      height: Number(p?.height ?? 0),
      grossWeight: Number(p?.grossWeight ?? 0),
    }))
    .filter((p) => Number.isFinite(p.length) && p.length > 0)
    .filter((p) => Number.isFinite(p.width) && p.width > 0)
    .filter((p) => Number.isFinite(p.height) && p.height > 0)
    .filter((p) => Number.isFinite(p.grossWeight) && p.grossWeight > 0);
}

export async function POST(req: NextRequest) {
  try {
    const bodyResult = await parseJsonOrError(
      req,
      z
        .union([
          // Normalized Integration Core request shape
          z
            .object({
              fromCountryCode: z.string().trim().min(2).max(2).optional(),
              toCountryCode: z.string().trim().min(2).max(2).optional(),
              fromPostalCode: z.string().trim().min(1).max(16),
              toPostalCode: z.string().trim().min(1).max(16),
              packages: z
                .array(
                  z.object({
                    length: z.coerce.number().finite().positive(),
                    width: z.coerce.number().finite().positive(),
                    height: z.coerce.number().finite().positive(),
                    grossWeight: z.coerce.number().finite().positive(),
                  })
                )
                .min(1)
                .max(100),
              language: z.string().trim().min(2).max(10).optional(),
              customerNumber: z.string().trim().min(1).max(32).optional(),
            })
            .passthrough(),

          // Legacy Bring Shipping Guide request shape (consignments etc)
          z
            .object({
              language: z.string().trim().min(2).max(10).optional(),
              consignments: z.array(z.any()).min(1).max(100),
            })
            .passthrough(),
        ])
        .passthrough()
    );
    if (!bodyResult.ok) return bodyResult.response;

    const body: any = bodyResult.data;

    // Prefer Integration Core backend service (mock/live Bring), then optionally fall back to calling Bring directly.
    const coreBaseUrl = process.env.INTEGRATION_CORE_URL || getIntegrationCoreBaseUrl();
    const coreUrl = coreBaseUrl
      ? `${coreBaseUrl.replace(/\/+$/, '')}/v1/shipping/bring/products`
      : '';

    const firstConsignment = Array.isArray(body?.consignments) ? body.consignments[0] : null;

    const fromCountryCode = (body?.fromCountryCode || firstConsignment?.fromCountryCode || 'NO').toString();
    const toCountryCode = (body?.toCountryCode || firstConsignment?.toCountryCode || 'NO').toString();
    const fromPostalCode = (body?.fromPostalCode || firstConsignment?.fromPostalCode || '').toString();
    const toPostalCode = (body?.toPostalCode || firstConsignment?.toPostalCode || '').toString();
    const packages = normalizePackages(body?.packages || firstConsignment?.packages);

    const language = (body?.language || 'en').toString();
    const customerNumber = (body?.customerNumber || '5').toString();

    if (coreUrl && fromPostalCode && toPostalCode && packages.length > 0) {
      const response = await fetch(coreUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromCountryCode,
          toCountryCode,
          fromPostalCode,
          toPostalCode,
          packages,
          language,
          customerNumber,
        }),
        cache: 'no-store',
      });

      const result = await response.json().catch(() => null);
      if (response.ok) {
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // If the Integration Core is configured but returns an error, surface it.
      const message = result?.error || response.statusText || 'Error fetching rates';
      return new Response(JSON.stringify({ error: message }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Optional fallback: call Bring directly (requires credentials). Keep for legacy deployments.
    if (!bringApiUID || !bringApiKey) {
      return new Response(
        JSON.stringify({
          error:
            'Integration Core backend is not configured/available and Bring API credentials are missing. Set NEXT_PUBLIC_INTEGRATION_CORE_URL (or INTEGRATION_CORE_URL) or BRING_SHIPPING_API_UID/BRING_SHIPPING_API_KEY.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(body?.consignments) || body.consignments.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid request. Missing consignments.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const requestBody: BringShippingRequestBody = body;

    // Prefer actual request origin if available; fallback to a reasonable default.
    const fallbackClientUrl =
      process.env.NODE_ENV === 'development' ? 'http://localhost:3000/' : 'https://www.veggat.com/';
    const clientUrl = req.headers.get('origin') || fallbackClientUrl;

    const response = await fetch('https://api.bring.com/shippingguide/api/v2/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Mybring-API-Uid': bringApiUID,
        'X-Mybring-API-Key': bringApiKey,
        'X-Bring-Client-URL': clientUrl,
      },
      body: JSON.stringify(requestBody),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: errorText || 'Error fetching from Bring API' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data: BringApiResponse = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Exception when fetching Bring API:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}