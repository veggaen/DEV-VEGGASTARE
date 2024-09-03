import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const vs_currency = searchParams.get('vs_currency') || 'usd';
  const crypto = searchParams.get('crypto') || 'ethereum';  // Default to 'ethereum' if not provided
  const interval = searchParams.get('interval') || 'daily';
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');

  // Set default days to 365 to avoid CoinGecko's time range restriction
  const days = searchParams.get('days') || '365';

  // Restrict days to a maximum of 365 for free CoinGecko API tier
  const adjustedDays = Math.min(parseInt(days), 365);

  // Build API URL for CoinGecko
  const apiUrl = `https://api.coingecko.com/api/v3/coins/${crypto}/market_chart?vs_currency=${vs_currency}&days=${adjustedDays}&interval=${interval}`;
  console.log('Fetching from URL:', apiUrl);  // Log the URL for debugging

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
        return (!fromDate || date >= new Date(fromDate)) && (!toDate || date <= new Date(toDate));
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