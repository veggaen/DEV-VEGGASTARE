/**
 * @fileOverview  Server-side market data for the paper terminal: OHLCV candles
 *                and 24h tickers. Binance public spot endpoints first (real
 *                intervals, volume), CoinGecko as the fallback (coarser
 *                granularity, no volume). Short in-memory caches keep the free
 *                tiers happy; nothing here needs an API key.
 * @stability     experimental
 */

import "server-only";
import {
  marketBySymbol,
  type Candle,
  type CandleResponse,
  type Interval,
  type Ticker,
  INTERVAL_MS,
} from "./symbols";

const BINANCE = "https://api.binance.com/api/v3";
const COINGECKO = process.env.COINGECKO_API_KEY ? "https://pro-api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3";
const cgHeaders: Record<string, string> = { Accept: "application/json" };
if (process.env.COINGECKO_API_KEY) cgHeaders["x-cg-pro-api-key"] = process.env.COINGECKO_API_KEY;

const CANDLE_TTL: Record<Interval, number> = { "1m": 5_000, "5m": 10_000, "15m": 15_000, "1h": 30_000, "4h": 60_000, "1d": 120_000, "1w": 300_000 };
const TICKER_TTL = 10_000;
const MAX_LIMIT = 1000;

const candleCache = new Map<string, { at: number; data: CandleResponse }>();
const tickerCache = new Map<string, { at: number; data: Ticker }>();

async function getJson<T>(url: string, headers: Record<string, string> = { Accept: "application/json" }, timeoutMs = 6000): Promise<T> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

// ── Candles ────────────────────────────────────────────────────────────────

type BinanceKline = [number, string, string, string, string, string, number, string, number, string, string, string];

async function candlesFromBinance(pair: string, interval: Interval, limit: number): Promise<Candle[]> {
  const rows = await getJson<BinanceKline[]>(`${BINANCE}/klines?symbol=${pair}&interval=${interval}&limit=${limit}`);
  return rows.map((r) => ({ t: r[0], o: Number(r[1]), h: Number(r[2]), l: Number(r[3]), c: Number(r[4]), v: Number(r[5]) }));
}

/** CoinGecko OHLC granularity is fixed by the day range: 30 min (1-2 d), 4 h (3-30 d), 4 d (31+ d). */
async function candlesFromCoinGecko(cgId: string, interval: Interval): Promise<{ candles: Candle[]; approximate: boolean }> {
  const days = interval === "1m" || interval === "5m" || interval === "15m" ? 1 : interval === "1h" || interval === "4h" ? 30 : 365;
  const rows = await getJson<Array<[number, number, number, number, number]>>(`${COINGECKO}/coins/${cgId}/ohlc?vs_currency=usd&days=${days}`, cgHeaders, 8000);
  let candles: Candle[] = rows.map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: 0 }));
  if (interval === "1w") candles = aggregate(candles, INTERVAL_MS["1w"]);
  const native = interval === "4h" && days === 30 ? true : false;
  return { candles, approximate: !native };
}

function aggregate(candles: Candle[], bucketMs: number): Candle[] {
  const out: Candle[] = [];
  for (const c of candles) {
    const t = Math.floor(c.t / bucketMs) * bucketMs;
    const last = out[out.length - 1];
    if (last && last.t === t) { last.h = Math.max(last.h, c.h); last.l = Math.min(last.l, c.l); last.c = c.c; last.v += c.v; }
    else out.push({ ...c, t });
  }
  return out;
}

export async function getCandles(symbolInput: string, interval: Interval, limitInput = 500): Promise<CandleResponse> {
  const market = marketBySymbol(symbolInput);
  if (!market || market.stable) throw new Error("Unknown market");
  const limit = Math.min(MAX_LIMIT, Math.max(2, Math.floor(limitInput)));
  const key = `${market.symbol}:${interval}:${limit}`;
  const cached = candleCache.get(key);
  if (cached && Date.now() - cached.at < CANDLE_TTL[interval]) return cached.data;

  let data: CandleResponse | null = null;
  if (market.pair) {
    try {
      data = { symbol: market.symbol, interval, source: "binance", approximate: false, candles: await candlesFromBinance(market.pair, interval, limit), fetchedAt: Date.now() };
    } catch (err) {
      console.warn(`[market] Binance candles failed for ${market.symbol}:`, err instanceof Error ? err.message : err);
    }
  }
  if (!data && market.cgId) {
    const { candles, approximate } = await candlesFromCoinGecko(market.cgId, interval);
    data = { symbol: market.symbol, interval, source: "coingecko", approximate, candles: candles.slice(-limit), fetchedAt: Date.now() };
  }
  if (!data) {
    if (cached) return cached.data;
    throw new Error("No candle source available");
  }
  candleCache.set(key, { at: Date.now(), data });
  return data;
}

// ── Tickers ────────────────────────────────────────────────────────────────

type Binance24h = { symbol: string; lastPrice: string; priceChangePercent: string; highPrice: string; lowPrice: string; quoteVolume: string };
type GeckoMarket = { id: string; current_price: number; price_change_percentage_24h: number | null; high_24h: number | null; low_24h: number | null; total_volume: number | null };

export async function getTickers(symbols: string[]): Promise<Ticker[]> {
  const wanted = Array.from(new Set(symbols.map((s) => s.toUpperCase()))).map(marketBySymbol).filter((m): m is NonNullable<typeof m> => Boolean(m));
  const out = new Map<string, Ticker>();
  const now = Date.now();
  const missing = wanted.filter((m) => {
    if (m.stable) { out.set(m.symbol, { symbol: m.symbol, price: 1, change24h: 0, high24h: 1, low24h: 1, volume24h: null, source: "stable" }); return false; }
    const cached = tickerCache.get(m.symbol);
    if (cached && now - cached.at < TICKER_TTL) { out.set(m.symbol, cached.data); return false; }
    return true;
  });

  const binanceMarkets = missing.filter((m) => m.pair);
  if (binanceMarkets.length) {
    try {
      const rows = await getJson<Binance24h[]>(`${BINANCE}/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(binanceMarkets.map((m) => m.pair)))}`);
      for (const m of binanceMarkets) {
        const row = rows.find((r) => r.symbol === m.pair);
        if (!row) continue;
        const t: Ticker = { symbol: m.symbol, price: Number(row.lastPrice), change24h: Number(row.priceChangePercent), high24h: Number(row.highPrice), low24h: Number(row.lowPrice), volume24h: Number(row.quoteVolume), source: "binance" };
        tickerCache.set(m.symbol, { at: now, data: t }); out.set(m.symbol, t);
      }
    } catch (err) {
      console.warn("[market] Binance tickers failed:", err instanceof Error ? err.message : err);
    }
  }

  const geckoMarkets = missing.filter((m) => !out.has(m.symbol) && m.cgId);
  if (geckoMarkets.length) {
    try {
      const rows = await getJson<GeckoMarket[]>(`${COINGECKO}/coins/markets?vs_currency=usd&ids=${geckoMarkets.map((m) => m.cgId).join(",")}&price_change_percentage=24h`, cgHeaders, 8000);
      for (const m of geckoMarkets) {
        const row = rows.find((r) => r.id === m.cgId);
        if (!row) continue;
        const t: Ticker = { symbol: m.symbol, price: row.current_price, change24h: row.price_change_percentage_24h ?? 0, high24h: row.high_24h, low24h: row.low_24h, volume24h: row.total_volume, source: "coingecko" };
        tickerCache.set(m.symbol, { at: now, data: t }); out.set(m.symbol, t);
      }
    } catch (err) {
      console.warn("[market] CoinGecko tickers failed:", err instanceof Error ? err.message : err);
    }
  }

  // Serve stale cache rather than a hole in the list.
  for (const m of missing) if (!out.has(m.symbol)) { const stale = tickerCache.get(m.symbol); if (stale) out.set(m.symbol, stale.data); }
  return wanted.map((m) => out.get(m.symbol)).filter((t): t is Ticker => Boolean(t));
}
