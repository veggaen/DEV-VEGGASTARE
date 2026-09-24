'use client';
/** @fileOverview Shared reference rates with preserved provenance, bounded cache and safe retry. @stability stable */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { CRYPTO_RATE_TTL, DISPLAY_RATE_CACHE_KEY, displayConversions, displayRateState, emptyDisplayRates, markDisplayRatesStale, mergeDisplayRates, readDisplayRateCache, readDisplayRateResponse, type DisplayRateSnapshot } from '@/lib/display-rate-cache';

type CurrencyRatesContextValue = ReturnType<typeof displayRateState> & ReturnType<typeof displayConversions> & {
  isLoading: boolean; error: string | null; refreshRates: () => Promise<void>;
};
const CurrencyRatesContext = createContext<CurrencyRatesContextValue | null>(null);

export function CurrencyRatesProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<DisplayRateSnapshot>(emptyDisplayRates);
  const snapshotRef = useRef(snapshot);
  const [now, setNow] = useState(Date.now);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<{ controller: AbortController; promise: Promise<void> } | null>(null);

  const save = useCallback((next: DisplayRateSnapshot) => {
    snapshotRef.current = next; setSnapshot(next); setNow(Date.now());
    // Storage denial must not invalidate an otherwise usable quote.
    try { localStorage.setItem(DISPLAY_RATE_CACHE_KEY, JSON.stringify(next)); } catch { /* optional browser storage */ }
  }, []);

  const refreshRates = useCallback((): Promise<void> => {
    if (active.current) return active.current.promise;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort('timeout'), 12_000);
    setIsLoading(true);
    const promise = (async () => {
      try {
        const response = await fetch('/api/currency-rates', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Rates unavailable');
        const next = readDisplayRateResponse(await response.json());
        if (!next) throw new Error('No verified reference rates');
        if (controller.signal.aborted) return;
        save(mergeDisplayRates(snapshotRef.current, next));
        setError(!next.fiat || !next.crypto ? 'Some conversion rates are unavailable.' : null);
      } catch {
        if (controller.signal.aborted && controller.signal.reason !== 'timeout') return;
        save(markDisplayRatesStale(snapshotRef.current));
        setError('Conversion rates could not be refreshed.');
      } finally {
        window.clearTimeout(timeout);
        if (active.current?.controller === controller) { active.current = null; setIsLoading(false); }
      }
    })();
    active.current = { controller, promise };
    return promise;
  }, [save]);

  useEffect(() => {
    let cached: DisplayRateSnapshot | null = null;
    try { cached = readDisplayRateCache(JSON.parse(localStorage.getItem(DISPLAY_RATE_CACHE_KEY) ?? 'null')); } catch { /* malformed or disabled storage */ }
    if (cached) { snapshotRef.current = cached; setSnapshot(cached); setNow(Date.now()); }
    const state = displayRateState(cached ?? emptyDisplayRates());
    if (!state.isFiatStale && !state.isCryptoStale) setIsLoading(false);
    else void refreshRates();
    const interval = window.setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === 'visible') void refreshRates();
    }, CRYPTO_RATE_TTL);
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setNow(Date.now());
      const latest = displayRateState(snapshotRef.current);
      if (latest.isFiatStale || latest.isCryptoStale) void refreshRates();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisible);
      active.current?.controller.abort(); active.current = null;
    };
  }, [refreshRates]);

  const rates = useMemo(() => displayRateState(snapshot, now), [snapshot, now]);
  const conversions = useMemo(() => displayConversions(rates.fiatRates, rates.cryptoPrices), [rates.fiatRates, rates.cryptoPrices]);
  const value = useMemo(() => ({ ...rates, ...conversions, isLoading, error, refreshRates }), [rates, conversions, isLoading, error, refreshRates]);
  return <CurrencyRatesContext.Provider value={value}>{children}</CurrencyRatesContext.Provider>;
}

const fallbackRates = displayRateState(emptyDisplayRates());
const fallback: CurrencyRatesContextValue = { ...fallbackRates, ...displayConversions(fallbackRates.fiatRates, fallbackRates.cryptoPrices), isLoading: false, error: 'Conversion rates unavailable.', refreshRates: async () => {} };
export function useCurrencyRates() { return useContext(CurrencyRatesContext) ?? fallback; }
