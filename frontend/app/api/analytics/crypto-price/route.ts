import { NextResponse } from 'next/server';
import { parseQueryOrError } from '@/lib/api-validate';
import { z } from 'zod';

export async function GET(request: Request) {
  const queryResult = parseQueryOrError(
    request,
    z.object({
      vs_currency: z.string().trim().min(2).max(10).optional().default('usd'),
      crypto: z.string().trim().regex(/^[a-z0-9-]{1,50}$/).optional().default('ethereum'),
      interval: z.enum(['daily', 'weekly', 'monthly']).optional().default('daily'),
      fromDate: z.string().trim().optional(),
      toDate: z.string().trim().optional(),
      days: z.coerce.number().int().min(1).max(365).optional().default(365),
    })
  );
  if (!queryResult.ok) return queryResult.response;

  const { vs_currency, crypto, interval, fromDate, toDate, days } = queryResult.data;
  const adjustedDays = days;

  // Build API URL for CoinGecko
  const apiUrl = `https://api.coingecko.com/api/v3/coins/${crypto}/market_chart?vs_currency=${vs_currency}&days=${adjustedDays}&interval=${interval}`;
  // Avoid noisy URL logs in prod

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorText = await response.text();  // Get the error text for better debugging
      throw new Error(`Failed to fetch ${crypto} historical data. Status: ${response.status}. Response: ${errorText}`);
    }

    const result = await response.json();

    // Ensure data is filtered by the date range provided
    const filteredData = result.prices
      .filter((price: [number, number]) => {
        const date = new Date(price[0]);
        const fromOk = !fromDate || date >= new Date(fromDate);
        const toOk = !toDate || date <= new Date(toDate);
        return fromOk && toOk;
      })
      .map((price: [number, number]) => ({
        date: new Date(price[0]).toISOString(),
        price: price[1],
      }));

    return NextResponse.json({ data: filteredData });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error fetching ${crypto} historical data:`, error.message);
      return NextResponse.json({ error: `Failed to fetch ${crypto} historical data. Reason: ${error.message}` }, { status: 500 });
    } else {
      console.error('Unexpected error:', error);
      return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
    }
  }
}