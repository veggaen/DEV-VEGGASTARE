"use client";

/**
 * @fileOverview  Client hooks for the paper terminal: candles (with a light
 *                poll that only refreshes the newest bars) and 24h tickers.
 *                Both keep the last good data on transient failures.
 * @stability     experimental
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Candle, CandleResponse, Interval, Ticker } from "@/lib/market/symbols";

const POLL_MS: Record<Interval, number> = { "1m": 5_000, "5m": 10_000, "15m": 15_000, "1h": 20_000, "4h": 30_000, "1d": 60_000, "1w": 120_000 };

function mergeTail(existing: Candle[], tail: Candle[]): Candle[] {
  if (!tail.length) return existing;
  const firstT = tail[0].t;
  const kept = existing.filter((c) => c.t < firstT);
  return [...kept, ...tail];
}

export function useCandles(symbol: string, interval: Interval, limit = 500) {
  const [data, setData] = useState<CandleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const load = useCallback(async (mode: "full" | "tail") => {
    const id = ++request.current;
    const n = mode === "full" ? limit : 3;
    try {
      const res = await fetch(`/api/market/candles?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${n}`, { cache: "no-store" });
      if (id !== request.current) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next = (await res.json()) as CandleResponse;
      if (id !== request.current) return;
      setData((prev) => (mode === "tail" && prev && prev.symbol === next.symbol && prev.interval === next.interval ? { ...prev, candles: mergeTail(prev.candles, next.candles), fetchedAt: next.fetchedAt } : next));
      setError(null);
    } catch (err) {
      if (id !== request.current) return;
      setError(err instanceof Error ? err.message : "Candles unavailable");
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [symbol, interval, limit]);

  useEffect(() => {
    setLoading(true); setData(null);
    void load("full");
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load("tail"); }, POLL_MS[interval]);
    const sequence = request;
    return () => { clearInterval(timer); ++sequence.current; };
  }, [load, interval]);

  return { data, candles: data?.candles ?? [], loading, error, refresh: () => load("full") };
}

export function useTickers(symbols: string[], pollMs = 10_000) {
  const key = symbols.join(",");
  const [tickers, setTickers] = useState<Map<string, Ticker>>(new Map());
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/market/ticker?symbols=${encodeURIComponent(key)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { tickers: Ticker[] };
        if (!alive) return;
        setTickers((prev) => { const next = new Map(prev); for (const t of body.tickers) next.set(t.symbol, t); return next; });
        setError(null);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Tickers unavailable");
      }
    };
    void load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, pollMs);
    return () => { alive = false; clearInterval(timer); };
  }, [key, pollMs]);
  return { tickers, error };
}
