import type { NextRequest } from 'next/server';
import { parseJsonOrError } from '@/lib/api-validate';
import { getIntegrationCoreBaseUrl } from '@/lib/integration-core';
import { defaultBringLiveEnabled, getRuntimeConfig } from '@/lib/runtime-config';
import { z } from 'zod';

export type ShippingPackage = {
  length: number;
  width: number;
  height: number;
  grossWeight: number;
};

export interface BringShippingRequestBody {
  language: string;
  withPrice: boolean;
  withExpectedDelivery: boolean;
  withGuiInformation: boolean;
  numberOfAlternativeDeliveryDates: number;
  edi: boolean;
  postingAtPostOffice: boolean;
  trace: boolean;
  consignments: unknown[];
  productSpecifications?: ShippingPackage;
}

interface BringApiResponse {
  consignments: unknown[];
}

type IntegrationCoreBody = {
  fromCountryCode?: string;
  toCountryCode?: string;
  fromPostalCode: string;
  toPostalCode: string;
  packages: ShippingPackage[];
  language?: string;
  customerNumber?: string;
};

const IntegrationCoreRequestSchema = z
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
  .passthrough();

const LegacyBringShippingSchema = z
  .object({
    language: z.string().trim().min(2).max(10).optional(),
    consignments: z.array(z.unknown()).min(1).max(100),
  })
  .passthrough();

const BringShippingInputSchema = z.union([
  IntegrationCoreRequestSchema,
  LegacyBringShippingSchema,
]);

type BringShippingInput = z.infer<typeof BringShippingInputSchema>;

type LegacyConsignment = {
  fromCountryCode?: string;
  toCountryCode?: string;
  fromPostalCode?: string;
  toPostalCode?: string;
  packages?: unknown;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

const bringApiUID = process.env.BRING_SHIPPING_API_UID;
const bringApiKey = process.env.BRING_SHIPPING_API_KEY;

function normalizePackages(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const pkg = asObject(item);
      return {
        length: Number(pkg?.length ?? 0),
        width: Number(pkg?.width ?? 0),
        height: Number(pkg?.height ?? 0),
        grossWeight: Number(pkg?.grossWeight ?? 0),
      };
    })
    .filter((p) => Number.isFinite(p.length) && p.length > 0)
    .filter((p) => Number.isFinite(p.width) && p.width > 0)
    .filter((p) => Number.isFinite(p.height) && p.height > 0)
    .filter((p) => Number.isFinite(p.grossWeight) && p.grossWeight > 0) as ShippingPackage[];
}

export async function POST(req: NextRequest) {
  try {
    const bodyResult = await parseJsonOrError(req, BringShippingInputSchema);
    if (!bodyResult.ok) return bodyResult.response;

    const body: BringShippingInput = bodyResult.data;
    const runtime = await getRuntimeConfig();
    const bringLiveEnabled = runtime.bringLiveEnabled ?? defaultBringLiveEnabled();

    // Prefer Integration Core backend service (mock/live Bring), then optionally fall back to calling Bring directly.
    const coreBaseUrl = process.env.INTEGRATION_CORE_URL || getIntegrationCoreBaseUrl();
    const coreUrl = coreBaseUrl
      ? `${coreBaseUrl.replace(/\/+$/, '')}/v1/shipping/bring/products`
      : '';

    const firstConsignment = Array.isArray(body?.consignments)
      ? (body.consignments[0] as LegacyConsignment | undefined)
      : undefined;

    const fromCountryCode = (
      ('fromCountryCode' in body ? body.fromCountryCode : undefined) ||
      firstConsignment?.fromCountryCode ||
      'NO'
    ).toString();
    const toCountryCode = (
      ('toCountryCode' in body ? body.toCountryCode : undefined) ||
      firstConsignment?.toCountryCode ||
      'NO'
    ).toString();
    const fromPostalCode = (
      ('fromPostalCode' in body ? body.fromPostalCode : undefined) ||
      firstConsignment?.fromPostalCode ||
      ''
    ).toString();
    const toPostalCode = (
      ('toPostalCode' in body ? body.toPostalCode : undefined) ||
      firstConsignment?.toPostalCode ||
      ''
    ).toString();
    const packages = normalizePackages(
      ('packages' in body ? body.packages : undefined) || firstConsignment?.packages
    );

    const language = (body.language || 'en').toString();
    const customerNumber = (
      ('customerNumber' in body ? body.customerNumber : undefined) ||
      (bringLiveEnabled ? process.env.BRING_CUSTOMER_NUMBER : undefined) ||
      '5'
    ).toString();

    if (coreUrl && fromPostalCode && toPostalCode && packages.length > 0) {
      const coreRequestBody: IntegrationCoreBody = {
        fromCountryCode,
        toCountryCode,
        fromPostalCode,
        toPostalCode,
        packages,
        language,
        customerNumber,
      };

      const response = await fetch(coreUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coreRequestBody),
        cache: 'no-store',
      });

      const result = await response.json().catch(() => null) as { error?: string } | null;
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

    const requestBody: BringShippingRequestBody = body as unknown as BringShippingRequestBody;

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
        'X-Bring_Client_URL': clientUrl,
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