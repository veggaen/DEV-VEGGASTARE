// frontend/app/api/bring-shipping-suggest-postcode/route.ts
import { BringPostalCodeSuggestionsResponse } from '@/lib/BringPostalCodeSuggestionTypes';
import { NextApiRequest, NextApiResponse } from 'next';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const bringApiUID = process.env.BRING_SHIPPING_API_UID;
const bringApiKey = process.env.BRING_SHIPPING_API_KEY;
  
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('postalCode');
  const page = req.nextUrl.searchParams.get('page') || '1'; // Default to page 1 if not specified
  const countryCode = req.nextUrl.searchParams.get('countryCode') || 'no'; // Default to page 1 if not specified

  console.log('Received query parameter:', query, 'Page:', page);

  if (!query) {
    console.log('No query parameter provided.');
    return new Response(JSON.stringify({ error: 'Query parameter "postalCode" is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Include the page parameter in the API URL
    const apiURL = `https://api.bring.com/address/api/${countryCode}/postal-codes/suggestions?q=${query}&page=${page}`;
    console.log('Calling Bring API with URL:', apiURL);

    const response = await fetch(apiURL, {
      headers: {
        'X-Mybring-API-Uid': bringApiUID || '',
        'X-Mybring-API-Key': bringApiKey || '',
        'Accept': 'application/json',
      },
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
    console.log('Data received from Bring API:', data);
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