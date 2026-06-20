'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// Fallback fiat rates (used while loading or if API fails)
const FALLBACK_FIAT_RATES: Record<string, number> = {
  USD: 1,
  NOK: 0.091,
  EUR: 1.08,
  GBP: 1.27,
  SEK: 0.093,
  DKK: 0.145,
  CHF: 1.13,
  JPY: 0.0067,
  CAD: 0.74,
  AUD: 0.65,
};

// Fallback crypto prices in USD
const FALLBACK_CRYPTO_PRICES: Record<string, number> = {
  ETH: 3300,
  BTC: 97000,
  SOL: 200,
  PLS: 0.0002,
  USDC: 1,
  USDT: 1,
};

interface CurrencyRatesContextValue {
  // Fiat rates
  fiatRates: Record<string, number>;
  // Crypto prices in USD
  cryptoPrices: Record<string, number>;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isFiatStale: boolean;
  isCryptoStale: boolean;
  // Fiat conversions
  convertToUSD: (amount: number, fromCurrency: string) => number;
  convertFromUSD: (amountUSD: number, toCurrency: string) => number;
  convertCurrency: (amount: number, from: string, to: string) => number;
  // Crypto conversions
  convertUSDToCrypto: (amountUSD: number, cryptoSymbol: string) => number;
  convertCryptoToUSD: (amount: number, cryptoSymbol: string) => number;
  convertFiatToCrypto: (amount: number, fiatCurrency: string, cryptoSymbol: string) => number;
  // Refresh
  refreshRates: () => Promise<void>;
}

const CurrencyRatesContext = createContext<CurrencyRatesContextValue | null>(null);

const CACHE_KEY = 'veggastare_currency_rates';
const FIAT_CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const CRYPTO_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CachedData {
  fiatRates: Record<string, number>;
  cryptoPrices: Record<string, number>;
  fiatTimestamp: number;
  cryptoTimestamp: number;
}

export function CurrencyRatesProvider({ children }: { children: React.ReactNode }) {
  const [fiatRates, setFiatRates] = useState<Record<string, number>>(FALLBACK_FIAT_RATES);
  const [cryptoPrices, setCryptoPrices] = useState<Record<string, number>>(FALLBACK_CRYPTO_PRICES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isFiatStale, setIsFiatStale] = useState(false);
  const [isCryptoStale, setIsCryptoStale] = useState(false);

  const fetchRates = useCallback(async () => {
    try {
      const response = await fetch('/api/currency-rates');
      if (!response.ok) throw new Error('Failed to fetch rates');
      
      const data = await response.json();
      if (data.success) {
        if (data.fiat?.rates) {
          setFiatRates(data.fiat.rates);
          setIsFiatStale(!data.fiat.fresh);
        } else if (data.rates) {
          // Legacy format
          setFiatRates(data.rates);
        }
        
        if (data.crypto?.prices) {
          setCryptoPrices(data.crypto.prices);
          setIsCryptoStale(!data.crypto.fresh);
        }
        
        setLastUpdated(new Date());
        setError(null);
        
        // Cache in localStorage
        const cacheData: CachedData = {
          fiatRates: data.fiat?.rates ?? data.rates ?? FALLBACK_FIAT_RATES,
          cryptoPrices: data.crypto?.prices ?? FALLBACK_CRYPTO_PRICES,
          fiatTimestamp: Date.now(),
          cryptoTimestamp: Date.now(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      }
    } catch (err) {
      console.error('[CurrencyRatesProvider] Failed to fetch rates:', err);
      setError('Failed to fetch live rates');
      setIsFiatStale(true);
      setIsCryptoStale(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load cached rates on mount, then fetch fresh ones
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data: CachedData = JSON.parse(cached);
        const now = Date.now();
        
        const fiatAge = now - data.fiatTimestamp;
        const cryptoAge = now - data.cryptoTimestamp;
        
        // Use cached data
        if (data.fiatRates) {
          setFiatRates(data.fiatRates);
          setIsFiatStale(fiatAge >= FIAT_CACHE_DURATION);
        }
        if (data.cryptoPrices) {
          setCryptoPrices(data.cryptoPrices);
          setIsCryptoStale(cryptoAge >= CRYPTO_CACHE_DURATION);
        }
        setLastUpdated(new Date(Math.max(data.fiatTimestamp, data.cryptoTimestamp)));
        
        // If both are fresh, don't fetch
        if (fiatAge < FIAT_CACHE_DURATION && cryptoAge < CRYPTO_CACHE_DURATION) {
          setIsLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn('[CurrencyRatesProvider] Could not load cached rates');
    }

    fetchRates();
  }, [fetchRates]);

  // Refresh crypto rates more frequently (every 5 min)
  useEffect(() => {
    const interval = setInterval(fetchRates, CRYPTO_CACHE_DURATION);
    return () => clearInterval(interval);
  }, [fetchRates]);

  // Fiat conversions
  const convertToUSD = useCallback((amount: number, fromCurrency: string): number => {
    const rate = fiatRates[fromCurrency] ?? fiatRates[fromCurrency.toUpperCase()] ?? 1;
    return amount * rate;
  }, [fiatRates]);

  const convertFromUSD = useCallback((amountUSD: number, toCurrency: string): number => {
    const rate = fiatRates[toCurrency] ?? fiatRates[toCurrency.toUpperCase()] ?? 1;
    return amountUSD / rate;
  }, [fiatRates]);

  const convertCurrency = useCallback((amount: number, from: string, to: string): number => {
    if (from === to) return amount;
    const usd = convertToUSD(amount, from);
    return convertFromUSD(usd, to);
  }, [convertToUSD, convertFromUSD]);

  // Crypto conversions
  const convertUSDToCrypto = useCallback((amountUSD: number, cryptoSymbol: string): number => {
    const price = cryptoPrices[cryptoSymbol] ?? cryptoPrices[cryptoSymbol.toUpperCase()] ?? 1;
    return amountUSD / price;
  }, [cryptoPrices]);

  const convertCryptoToUSD = useCallback((amount: number, cryptoSymbol: string): number => {
    const price = cryptoPrices[cryptoSymbol] ?? cryptoPrices[cryptoSymbol.toUpperCase()] ?? 1;
    return amount * price;
  }, [cryptoPrices]);

  const convertFiatToCrypto = useCallback((amount: number, fiatCurrency: string, cryptoSymbol: string): number => {
    const usd = convertToUSD(amount, fiatCurrency);
    return convertUSDToCrypto(usd, cryptoSymbol);
  }, [convertToUSD, convertUSDToCrypto]);

  const refreshRates = useCallback(async () => {
    setIsLoading(true);
    await fetchRates();
  }, [fetchRates]);

  return (
    <CurrencyRatesContext.Provider
      value={{
        fiatRates,
        cryptoPrices,
        isLoading,
        error,
        lastUpdated,
        isFiatStale,
        isCryptoStale,
        convertToUSD,
        convertFromUSD,
        convertCurrency,
        convertUSDToCrypto,
        convertCryptoToUSD,
        convertFiatToCrypto,
        refreshRates,
      }}
    >
      {children}
    </CurrencyRatesContext.Provider>
  );
}

export function useCurrencyRates() {
  const context = useContext(CurrencyRatesContext);
  if (!context) {
    // Return a fallback if used outside provider (for server components)
    return {
      fiatRates: FALLBACK_FIAT_RATES,
      cryptoPrices: FALLBACK_CRYPTO_PRICES,
      isLoading: false,
      error: null,
      lastUpdated: null,
      isFiatStale: true,
      isCryptoStale: true,
      convertToUSD: (amount: number, fromCurrency: string) => {
        const rate = FALLBACK_FIAT_RATES[fromCurrency] ?? 1;
        return amount * rate;
      },
      convertFromUSD: (amountUSD: number, toCurrency: string) => {
        const rate = FALLBACK_FIAT_RATES[toCurrency] ?? 1;
        return amountUSD / rate;
      },
      convertCurrency: (amount: number, from: string, to: string) => {
        if (from === to) return amount;
        const usd = amount * (FALLBACK_FIAT_RATES[from] ?? 1);
        return usd / (FALLBACK_FIAT_RATES[to] ?? 1);
      },
      convertUSDToCrypto: (amountUSD: number, cryptoSymbol: string) => {
        const price = FALLBACK_CRYPTO_PRICES[cryptoSymbol] ?? 1;
        return amountUSD / price;
      },
      convertCryptoToUSD: (amount: number, cryptoSymbol: string) => {
        const price = FALLBACK_CRYPTO_PRICES[cryptoSymbol] ?? 1;
        return amount * price;
      },
      convertFiatToCrypto: (amount: number, fiatCurrency: string, cryptoSymbol: string) => {
        const usd = amount * (FALLBACK_FIAT_RATES[fiatCurrency] ?? 1);
        const price = FALLBACK_CRYPTO_PRICES[cryptoSymbol] ?? 1;
        return usd / price;
      },
      refreshRates: async () => {},
    };
  }
  return context;
}
