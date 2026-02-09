/**
 * Bring Address API proxy
 * https://developer.bring.com/api/address/
 * 
 * Proxies requests to Bring's address services to:
 * 1. Keep API keys secure (server-side only)
 * 2. Handle CORS issues
 * 3. Provide consistent error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit as sharedRateLimit, rateLimitedResponse, getClientIdentifier } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Bring API configuration
const BRING_API_URL = 'https://api.bring.com/address/api';

function getBringCredentials(): { uid: string; key: string; hasCredentials: boolean } {
  const uid = process.env.MYBRING_API_UID || process.env.BRING_API_UID || process.env.BRING_SHIPPING_API_UID || '';
  const key = process.env.MYBRING_API_KEY || process.env.BRING_API_KEY || process.env.BRING_SHIPPING_API_KEY || '';
  return { uid, key, hasCredentials: Boolean(uid && key) };
}

function jsonNoStore(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store, max-age=0');
  return NextResponse.json(body, { ...init, headers });
}

// Query parameter schemas
const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  country: z.string().length(2).default('NO'),
});

const PostalCodeQuerySchema = z.object({
  postalCode: z.string().min(4).max(10),
  country: z.string().length(2).default('NO'),
});

const ValidateQuerySchema = z.object({
  street: z.string().max(200),
  postal_code: z.string().max(10),
  city: z.string().max(100),
  country: z.string().length(2).default('NO'),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string[] }> }
) {
  try {
    // Rate limiting
    const ip = getClientIdentifier(request);
    const rlResult = await sharedRateLimit(ip, 'external');
    if (!rlResult.success) {
      return rateLimitedResponse(rlResult);
    }

    const { action } = await params;
    const actionPath = action?.[0];
    const searchParams = request.nextUrl.searchParams;

    // Bring endpoints use lowercase country codes in the URL path.
    const normalizeCountry = (country: string) => country.toLowerCase();

    const { uid: bringApiUid, key: bringApiKey, hasCredentials } = getBringCredentials();

    // Check if Bring API is configured
    if (!hasCredentials) {
      console.warn('[bring-address] API credentials not configured');
      return jsonNoStore({
        suggestions: [],
        postal_codes: [],
        error: 'Address service temporarily unavailable',
      });
    }

    const headers: HeadersInit = {
      'Accept': 'application/json',
      'X-MyBring-API-Uid': bringApiUid,
      'X-MyBring-API-Key': bringApiKey,
      // Many Bring APIs expect a client URL identifier. Safe to include.
      'X-Bring-Client-URL': request.nextUrl.origin,
    };

    switch (actionPath) {
      case 'search': {
        const query = SearchQuerySchema.safeParse({
          q: searchParams.get('q'),
          country: searchParams.get('country') || 'NO',
        });

        if (!query.success) {
          return NextResponse.json(
            { error: 'Invalid query parameters', details: query.error.flatten() },
            { status: 400 }
          );
        }

        // Bring's single-input suggestion endpoint (street/place/po box)
        // https://developer.bring.com/api/address/#get-address-suggestions-get
        const url = `${BRING_API_URL}/${normalizeCountry(query.data.country)}/addresses/suggestions?q=${encodeURIComponent(query.data.q)}`;
        
        const response = await fetch(url, {
          headers,
          cache: 'no-store',
          next: { revalidate: 0 },
        });
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.error('[bring-address] Search API error:', response.status, errorText);
          return jsonNoStore({
            suggestions: [],
            error: `Bring Address API error (${response.status})`,
            status: response.status,
          });
        }

        const data = await response.json();

        const raw = (data?.addresses || data?.suggestions || []) as Array<Record<string, unknown>>;

        // Transform Bring's response to our format.
        // Bring uses snake_case (street_name, house_number, postal_code, coordinate).
        const suggestions = raw.map((item) => {
          const street = (item.street || item.street_name || item.streetName || item.name || '') as string;
          const streetNumber = item.street_number ?? item.house_number ?? item.streetNumber ?? item.houseNumber;
          const letter = (item.letter || item.house_letter || '') as string;
          const postalCode = (item.postal_code || item.postalCode || item.zipCode || '') as string;
          const city = (item.city || item.postal_place || item.postalPlace || '') as string;
          const municipality = (item.municipality || '') as string;
          const county = (item.county || '') as string;

          const coordinate = (item.coordinate || item.geoCoordinate || item.coords || null) as
            | { latitude?: unknown; longitude?: unknown }
            | null;
          const latitude = (item.latitude ?? coordinate?.latitude ?? '') as string | number;
          const longitude = (item.longitude ?? coordinate?.longitude ?? '') as string | number;

          return {
            street,
            street_number: streetNumber != null ? String(streetNumber) : '',
            letter: letter ? String(letter) : '',
            postal_code: postalCode ? String(postalCode) : '',
            city: city ? String(city) : '',
            municipality: municipality ? String(municipality) : '',
            county: county ? String(county) : '',
            country: query.data.country,
            latitude: latitude != null ? String(latitude) : '',
            longitude: longitude != null ? String(longitude) : '',
          };
        });

        return jsonNoStore({ suggestions });
      }

      case 'postal-code': {
        const query = PostalCodeQuerySchema.safeParse({
          postalCode: searchParams.get('postalCode'),
          country: searchParams.get('country') || 'NO',
        });

        if (!query.success) {
          return NextResponse.json(
            { error: 'Invalid query parameters', details: query.error.flatten() },
            { status: 400 }
          );
        }

        // Bring's postal code lookup endpoint
        const url = `${BRING_API_URL}/${normalizeCountry(query.data.country)}/postal-codes/${query.data.postalCode}`;
        
        const response = await fetch(url, {
          headers,
          cache: 'no-store',
          next: { revalidate: 0 },
        });
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.error('[bring-address] Postal code API error:', response.status, errorText);
          return jsonNoStore({
            postal_codes: [],
            error: `Bring Address API error (${response.status})`,
            status: response.status,
          });
        }

        const data = await response.json();
        
        // Transform response
        const postalCodes = Array.isArray(data) ? data : [data];
        const formatted = postalCodes
          .filter((item: Record<string, unknown>) => item && item.postalCode)
          .map((item: Record<string, unknown>) => ({
            postal_code: item.postalCode || item.zipCode || '',
            city: item.city || item.postalPlace || '',
            municipality: item.municipality || '',
            municipalityId: item.municipalityId || '',
            county: item.county || '',
            po_box: item.poBox || false,
            latitude: item.latitude || '',
            longitude: item.longitude || '',
          }));

        return jsonNoStore({ postal_codes: formatted });
      }

      case 'validate': {
        const query = ValidateQuerySchema.safeParse({
          street: searchParams.get('street'),
          postal_code: searchParams.get('postal_code'),
          city: searchParams.get('city'),
          country: searchParams.get('country') || 'NO',
        });

        if (!query.success) {
          return NextResponse.json(
            { error: 'Invalid query parameters', details: query.error.flatten() },
            { status: 400 }
          );
        }

        // Bring validation endpoint
        // https://developer.bring.com/api/address/#validate-provided-address-get
        const url = new URL(`${BRING_API_URL}/${normalizeCountry(query.data.country)}/validation`);
        url.searchParams.set('address', `${query.data.street}, ${query.data.postal_code} ${query.data.city}`);

        const response = await fetch(url.toString(), {
          headers,
          cache: 'no-store',
          next: { revalidate: 0 },
        });
        
        if (!response.ok) {
          // Validation endpoint may return 404 for invalid addresses
          return jsonNoStore({ valid: false, status: response.status });
        }

        const data = await response.json();

        if (!data?.valid) {
          return jsonNoStore({ valid: false });
        }

        return jsonNoStore({
          valid: true,
          street: data?.address?.street_name || data?.address?.streetName || query.data.street,
          postal_code: data?.address?.postal_code || data?.address?.postalCode || query.data.postal_code,
          city: data?.address?.city || data?.address?.postal_place || query.data.city,
          municipality: data?.address?.municipality || '',
          county: data?.address?.county || '',
        });
      }

      default:
        return jsonNoStore(
          { error: 'Unknown action. Use: search, postal-code, or validate' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[bring-address] Unexpected error:', error);
    return jsonNoStore(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
