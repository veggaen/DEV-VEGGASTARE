// frontend/app/api/bring-shipping-suggest-postcode/route.ts
import { BringPostalCodeSuggestionsResponse } from '@/lib/BringPostalCodeSuggestionTypes';
import type { NextRequest } from 'next/server';
import { parseQueryOrError } from '@/lib/api-validate';
import { z } from 'zod';
import { getIntegrationCoreBaseUrl } from '@/lib/integration-core';

const bringApiUID = process.env.BRING_SHIPPING_API_UID;
const bringApiKey = process.env.BRING_SHIPPING_API_KEY;
  
export async function GET(req: NextRequest) {
  const queryResult = parseQueryOrError(
    req,
    z.object({
      postalCode: z.string().trim().min(1).max(20),
      page: z.coerce.number().int().min(1).max(100).optional().default(1),
      countryCode: z.string().trim().min(2).max(2).optional().default('no'),
    })
  );
  if (!queryResult.ok) return queryResult.response;

  const query = queryResult.data.postalCode;
  const page = String(queryResult.data.page ?? 1);
  const countryCode = (queryResult.data.countryCode ?? 'no').toLowerCase();

  try {
    const coreBaseUrl = getIntegrationCoreBaseUrl();
    if (coreBaseUrl) {
      const coreUrl = `${coreBaseUrl}/v1/shipping/postal-codes/suggestions?countryCode=${encodeURIComponent(
        countryCode
      )}&q=${encodeURIComponent(query)}&page=${encodeURIComponent(page)}`;

      const coreRes = await fetch(coreUrl, { cache: 'no-store' });
      const coreJson = (await coreRes.json().catch(() => null)) as any;

      if (!coreRes.ok) {
        const msg = coreJson?.error || coreRes.statusText || 'Integration Core error';
        throw new Error(msg);
      }

      const suggestions = Array.isArray(coreJson?.suggestions) ? coreJson.suggestions : [];
      const data: BringPostalCodeSuggestionsResponse = {
        navigation: {
          total_hits: suggestions.length,
          self: coreUrl,
          first: coreUrl,
          last: coreUrl,
        },
        postal_codes: suggestions.map((s: any) => ({
          postal_code: String(s?.postalCode ?? ''),
          city: String(s?.city ?? ''),
          municipalityId: '',
          municipality: '',
          county: '',
          po_box: false,
          latitude: '',
          longitude: '',
        })),
      };

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fallback: call Bring directly (requires credentials)
    if (!bringApiUID || !bringApiKey) {
      return new Response(
        JSON.stringify({
          error:
            'Integration Core not configured and Bring API credentials are missing. Set NEXT_PUBLIC_INTEGRATION_CORE_URL (recommended) or BRING_SHIPPING_API_UID/KEY.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiURL = `https://api.bring.com/address/api/${countryCode}/postal-codes/suggestions?q=${query}&page=${page}`;
    console.log('Calling Bring API with URL:', apiURL);

    const fallbackClientUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000/'
      : 'https://www.veggat.com/';
    const clientUrl = req.headers.get('origin') || fallbackClientUrl;

    const response = await fetch(apiURL, {
      headers: {
        'X-Mybring-API-Uid': bringApiUID || '',
        'X-Mybring-API-Key': bringApiKey || '',
        'X-Bring_Client_URL': clientUrl,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      // Handle non-2xx responses
      const errorText = await response.text();
      console.error('Non-2xx response from Bring API:', errorText);
      return new Response(errorText, {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data: BringPostalCodeSuggestionsResponse = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching postal code suggestions:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch postal code suggestions.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}