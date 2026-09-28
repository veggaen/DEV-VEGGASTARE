/**
 * GET /api/market/candles?symbol=BTC&interval=1h&limit=500
 * OHLCV candles for the paper terminal (Binance, CoinGecko fallback). Public read.
 * @stability experimental
 */

import { NextRequest, NextResponse } from "next/server";
import { getCandles } from "@/lib/market/feed";
import { isInterval, marketBySymbol } from "@/lib/market/symbols";

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") ?? "").toUpperCase();
  const interval = req.nextUrl.searchParams.get("interval") ?? "1h";
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "500");
  const market = symbol ? marketBySymbol(symbol) : undefined;
  if (!market || market.stable || !isInterval(interval) || !Number.isFinite(limit)) {
    return NextResponse.json({ error: "Unknown market or interval" }, { status: 400 });
  }
  try {
    const data = await getCandles(market.symbol, interval, limit);
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } });
  } catch {
    return NextResponse.json({ error: "Candles are unavailable right now" }, { status: 502 });
  }
}
