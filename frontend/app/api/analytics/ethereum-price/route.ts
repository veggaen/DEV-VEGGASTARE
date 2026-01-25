import { NextResponse } from 'next/server';
import { parseQueryOrError } from '@/lib/api-validate';
import { z } from 'zod';

export async function GET(request: Request) {
  const queryResult = parseQueryOrError(
    request,
    z.object({
      vs_currency: z.string().trim().min(2).max(10).optional().default('usd'),
      days: z.union([z.literal('max'), z.coerce.number().int().min(1).max(365)]).optional().default(365),
      interval: z.string().trim().optional().default('daily'),
    })
  );
  if (!queryResult.ok) return queryResult.response;

  const vs_currency = queryResult.data.vs_currency;
  const days = queryResult.data.days;
  const interval = queryResult.data.interval;

  // Handle the 'days=max' condition for the CoinGecko API free tier limitation
  const adjustedDays = days === 'max' ? '365' : String(days);

  // Handle unsupported intervals by the CoinGecko API
  const supportedIntervals = ['daily', 'weekly', 'monthly'];
  const adjustedInterval = supportedIntervals.includes(interval) ? interval : 'daily';

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=${vs_currency}&days=${adjustedDays}&interval=${adjustedInterval}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch Ethereum historical data`);
    }

    const result = await response.json();

    // Ensure data is valid and transform it
    const transformedData = result.prices
      .map((price: [number, number]) => {
        const date = new Date(price[0]);
        return {
          date: !isNaN(date.getTime()) ? date.toISOString() : null, // Ensure valid ISO format
          price: price[1],
        };
      })
      .filter((datum: { date: string | null }) => datum.date !== null); // Filter out invalid dates

    return NextResponse.json({
      data: transformedData,
    });
  } catch (error) {
    console.error('Error fetching Ethereum historical data:', error);
    return NextResponse.json({ error: 'Failed to fetch Ethereum historical data' }, { status: 500 });
  }
}