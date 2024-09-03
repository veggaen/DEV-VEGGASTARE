import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const vs_currency = searchParams.get('vs_currency') || 'usd';
  const days = searchParams.get('days') || '365'; // Default to 1 year if no input
  const interval = searchParams.get('interval') || 'daily';

  // Handle the 'days=max' condition for the CoinGecko API free tier limitation
  const adjustedDays = days === 'max' ? '365' : days; // Limit max days to 365 for free tier

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