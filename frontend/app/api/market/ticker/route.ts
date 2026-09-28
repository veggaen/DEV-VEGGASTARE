/**
 * GET /api/market/ticker?symbols=BTC,ETH,SOL
 * Last price and 24h change for the market list (Binance, CoinGecko fallback). Public read.
 * @stability experimental
 */

import { NextRequest, NextResponse } from "next/server";
import { getTickers } from "@/lib/market/feed";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = raw.split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z0-9]{2,12}$/.test(s)).slice(0, 60);
  if (!symbols.length) return NextResponse.json({ error: "symbols required" }, { status: 400 });
  try {
    const tickers = await getTickers(symbols);
    return NextResponse.json({ tickers, fetchedAt: Date.now() }, { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } });
  } catch {
    return NextResponse.json({ error: "Tickers are unavailable right now" }, { status: 502 });
  }
}
