/**
 * GET /api/paper/price?symbol=ETH
 * Lightweight proxy to the CoinGecko price feed.
 * Returns { usd, source, symbol } or 400/500.
 * @stability experimental
 */

import { NextRequest, NextResponse } from "next/server";
import { getTokenPrice } from "@/lib/paper/price-feed";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol || symbol.length > 20) {
    return NextResponse.json(
      { error: "Missing or invalid symbol param" },
      { status: 400 },
    );
  }

  try {
    const quote = await getTokenPrice(symbol.toUpperCase());
    return NextResponse.json(quote, {
      headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" },
    });
  } catch {
    return NextResponse.json(
      { error: "Price fetch failed" },
      { status: 502 },
    );
  }
}
