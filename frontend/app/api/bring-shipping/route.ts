// frontend/app/api/bring-shipping/route.ts
import type { NextRequest } from 'next/server';

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

export async function POST(req: NextRequest) {
  try {
    if (!bringApiUID || !bringApiKey) {
      return new Response(
        JSON.stringify({
          error:
            'Bring API credentials are missing. Set BRING_SHIPPING_API_UID and BRING_SHIPPING_API_KEY in the server env.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const requestBody: BringShippingRequestBody = await req.json();

    //console.log('Request body to Bring API:', requestBody);
    // Prefer actual request origin if available; fallback to a reasonable default.
    const fallbackClientUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000/'
      : 'https://www.veggat.com/';
    const clientUrl = req.headers.get('origin') || fallbackClientUrl;

    console.log('Bring clientUrl:', clientUrl);
    const response = await fetch('https://api.bring.com/shippingguide/api/v2/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Mybring-API-Uid': bringApiUID,
        'X-Mybring-API-Key': bringApiKey,
        'X-Bring-Client-URL': clientUrl,
      },
      body: JSON.stringify(requestBody),
      cache: 'no-store',
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response from Bring API:', errorText);
      return new Response(JSON.stringify({ error: errorText || 'Error fetching from Bring API' }), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const data: BringApiResponse = await response.json();
    // console.log('Response data from Bring API data:', data);
    // console.log('Response data from Bring API data.consignments[0].products[0]:', data.consignments[0].products[0]);
    // console.log('Response data from Bring API data.consignments[0].products[0]:', data.consignments[0].products[0].price.listPrice.priceWithoutAdditionalServices);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
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