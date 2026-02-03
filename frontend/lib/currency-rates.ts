/**
 * Currency Exchange Rates Service
 * Uses Frankfurter API for fiat (free, based on European Central Bank data)
 * Uses CoinGecko API for crypto (free tier, no API key required)
 * 
 * Rates are cached for 1 hour (fiat) and 5 minutes (crypto) to minimize API calls.
 * Falls back to hardcoded rates if API is unavailable.
 */

// Fallback rates (approximate, updated Feb 2026)
const FALLBACK_FIAT_RATES_TO_USD: Record<string, number> = {
  USD: 1,
  NOK: 0.091,   // ~10.99 NOK per USD
  EUR: 1.08,    // ~0.93 EUR per USD
  GBP: 1.27,    // ~0.79 GBP per USD
  SEK: 0.093,   // ~10.75 SEK per USD
  DKK: 0.145,   // ~6.90 DKK per USD
  CHF: 1.13,    // ~0.89 CHF per USD
  JPY: 0.0067,  // ~150 JPY per USD
  CAD: 0.74,    // ~1.35 CAD per USD
  AUD: 0.65,    // ~1.54 AUD per USD
};

// Fallback crypto prices in USD
const FALLBACK_CRYPTO_PRICES_USD: Record<string, number> = {
  ETH: 3300,    // ~$3,300 per ETH
  BTC: 97000,   // ~$97,000 per BTC
  SOL: 200,     // ~$200 per SOL
  USDC: 1,      // Stablecoin ~$1
  USDT: 1,      // Stablecoin ~$1
};

// Cache configuration
const FIAT_CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour
const CRYPTO_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes (crypto is more volatile)

interface CachedRates {
  rates: Record<string, number>; // Rates TO USD (e.g., NOK -> USD = 0.091)
  timestamp: number;
  base: string;
}

interface CachedCryptoPrices {
  prices: Record<string, number>; // Crypto prices in USD (e.g., ETH = 3300)
  timestamp: number;
}

let cachedFiatRates: CachedRates | null = null;
let cachedCryptoPrices: CachedCryptoPrices | null = null;

/**
 * Fetch latest fiat exchange rates from Frankfurter API
 * Returns rates relative to USD (how much 1 unit of each currency is worth in USD)
 */
async function fetchFiatRatesFromAPI(): Promise<Record<string, number> | null> {
  try {
    const response = await fetch(
      'https://api.frankfurter.dev/v1/latest?base=USD&symbols=NOK,EUR,GBP,SEK,DKK,CHF,JPY,CAD,AUD',
      { 
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) {
      console.warn('[currency-rates] Frankfurter API returned non-OK status:', response.status);
      return null;
    }

    const data = await response.json();
    const ratesToUSD: Record<string, number> = { USD: 1 };
    
    for (const [currency, rate] of Object.entries(data.rates)) {
      ratesToUSD[currency] = 1 / (rate as number);
    }

    console.log('[currency-rates] Fetched fresh fiat rates');
    return ratesToUSD;
  } catch (error) {
    console.warn('[currency-rates] Failed to fetch fiat rates:', error);
    return null;
  }
}

/**
 * Fetch latest crypto prices from CoinGecko API (free, no key required)
 * Returns prices in USD
 */
async function fetchCryptoPricesFromAPI(): Promise<Record<string, number> | null> {
  try {
    // CoinGecko free API - no key needed, rate limited to 10-30 calls/min
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,solana,usd-coin,tether&vs_currencies=usd',
      { 
        next: { revalidate: 300 }, // Cache for 5 minutes
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) {
      console.warn('[currency-rates] CoinGecko API returned non-OK status:', response.status);
      return null;
    }

    const data = await response.json();
    
    // Map CoinGecko IDs to our symbols
    const prices: Record<string, number> = {
      ETH: data.ethereum?.usd ?? FALLBACK_CRYPTO_PRICES_USD.ETH,
      BTC: data.bitcoin?.usd ?? FALLBACK_CRYPTO_PRICES_USD.BTC,
      SOL: data.solana?.usd ?? FALLBACK_CRYPTO_PRICES_USD.SOL,
      USDC: data['usd-coin']?.usd ?? 1,
      USDT: data.tether?.usd ?? 1,
    };

    console.log('[currency-rates] Fetched fresh crypto prices:', prices);
    return prices;
  } catch (error) {
    console.warn('[currency-rates] Failed to fetch crypto prices:', error);
    return null;
  }
}

/**
 * Get current fiat exchange rates (to USD)
 */
export async function getExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();

  if (cachedFiatRates && (now - cachedFiatRates.timestamp) < FIAT_CACHE_DURATION_MS) {
    return cachedFiatRates.rates;
  }

  const freshRates = await fetchFiatRatesFromAPI();

  if (freshRates) {
    cachedFiatRates = {
      rates: freshRates,
      timestamp: now,
      base: 'USD',
    };
    return freshRates;
  }

  if (cachedFiatRates) {
    console.warn('[currency-rates] Using stale cached fiat rates');
    return cachedFiatRates.rates;
  }

  console.warn('[currency-rates] Using fallback fiat rates');
  return FALLBACK_FIAT_RATES_TO_USD;
}

/**
 * Get current crypto prices in USD
 */
export async function getCryptoPrices(): Promise<Record<string, number>> {
  const now = Date.now();

  if (cachedCryptoPrices && (now - cachedCryptoPrices.timestamp) < CRYPTO_CACHE_DURATION_MS) {
    return cachedCryptoPrices.prices;
  }

  const freshPrices = await fetchCryptoPricesFromAPI();

  if (freshPrices) {
    cachedCryptoPrices = {
      prices: freshPrices,
      timestamp: now,
    };
    return freshPrices;
  }

  if (cachedCryptoPrices) {
    console.warn('[currency-rates] Using stale cached crypto prices');
    return cachedCryptoPrices.prices;
  }

  console.warn('[currency-rates] Using fallback crypto prices');
  return FALLBACK_CRYPTO_PRICES_USD;
}

/**
 * Convert an amount from one fiat currency to USD
 */
export function convertToUSD(amount: number, fromCurrency: string, rates?: Record<string, number>): number {
  const effectiveRates = rates ?? cachedFiatRates?.rates ?? FALLBACK_FIAT_RATES_TO_USD;
  const rate = effectiveRates[fromCurrency] ?? 1;
  return amount * rate;
}

/**
 * Convert an amount from USD to another fiat currency
 */
export function convertFromUSD(amountUSD: number, toCurrency: string, rates?: Record<string, number>): number {
  const effectiveRates = rates ?? cachedFiatRates?.rates ?? FALLBACK_FIAT_RATES_TO_USD;
  const rate = effectiveRates[toCurrency] ?? 1;
  return amountUSD / rate;
}

/**
 * Convert USD to crypto amount
 */
export function convertUSDToCrypto(amountUSD: number, cryptoSymbol: string, prices?: Record<string, number>): number {
  const effectivePrices = prices ?? cachedCryptoPrices?.prices ?? FALLBACK_CRYPTO_PRICES_USD;
  const price = effectivePrices[cryptoSymbol] ?? 1;
  return amountUSD / price;
}

/**
 * Convert crypto amount to USD
 */
export function convertCryptoToUSD(amount: number, cryptoSymbol: string, prices?: Record<string, number>): number {
  const effectivePrices = prices ?? cachedCryptoPrices?.prices ?? FALLBACK_CRYPTO_PRICES_USD;
  const price = effectivePrices[cryptoSymbol] ?? 1;
  return amount * price;
}

/**
 * Convert between any two fiat currencies
 */
export function convertCurrency(
  amount: number, 
  fromCurrency: string, 
  toCurrency: string,
  rates?: Record<string, number>
): number {
  if (fromCurrency === toCurrency) return amount;
  const usd = convertToUSD(amount, fromCurrency, rates);
  return convertFromUSD(usd, toCurrency, rates);
}

/**
 * Get the current cached fiat rates (for synchronous access)
 */
export function getCachedRates(): Record<string, number> {
  return cachedFiatRates?.rates ?? FALLBACK_FIAT_RATES_TO_USD;
}

/**
 * Get the current cached crypto prices (for synchronous access)
 */
export function getCachedCryptoPrices(): Record<string, number> {
  return cachedCryptoPrices?.prices ?? FALLBACK_CRYPTO_PRICES_USD;
}

/**
 * Check if fiat rates are fresh
 */
export function areRatesFresh(): boolean {
  if (!cachedFiatRates) return false;
  return (Date.now() - cachedFiatRates.timestamp) < FIAT_CACHE_DURATION_MS;
}

/**
 * Check if crypto prices are fresh
 */
export function areCryptoPricesFresh(): boolean {
  if (!cachedCryptoPrices) return false;
  return (Date.now() - cachedCryptoPrices.timestamp) < CRYPTO_CACHE_DURATION_MS;
}

/**
 * Get the timestamp of the last fiat rate update
 */
export function getRatesTimestamp(): number | null {
  return cachedFiatRates?.timestamp ?? null;
}

/**
 * Get the timestamp of the last crypto price update
 */
export function getCryptoPricesTimestamp(): number | null {
  return cachedCryptoPrices?.timestamp ?? null;
}
