// frontend/app/api/bring-shipping/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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
    const requestBody: BringShippingRequestBody = await req.json();

    //console.log('Request body to Bring API:', requestBody);
    // Simplified environment detection
    const whatENV = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000/' 
      : '/';

    console.log('whatENV:', whatENV);
    const response = await fetch('https://api.bring.com/shippingguide/api/v2/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mybring-API-Uid': bringApiUID!,
        'X-Mybring-API-Key': bringApiKey!,
        'X-Bring-Client-URL': whatENV,
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error response from Bring API:', errorData);
      return new Response(JSON.stringify({ error: errorData.description || 'Error fetching from Bring API' }), {
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