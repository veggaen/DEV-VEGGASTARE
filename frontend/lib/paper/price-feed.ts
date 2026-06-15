/**
 * @fileOverview  Paper trading price-feed service.
 *               Fetches real-time crypto prices from CoinGecko (primary)
 *               with a simple in-memory cache (30s TTL).
 *               Falls back to cached values on network failure.
 * @stability     experimental
 */

// ── CoinGecko token ID mapping ──────────────────────────────────────────────
// Maps our internal symbol → CoinGecko API ID.
// See https://api.coingecko.com/api/v3/coins/list for full list.
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  ETH: "ethereum",
  BTC: "bitcoin",
  WBTC: "wrapped-bitcoin",
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
  MKR: "maker",
  COMP: "compound-governance-token",
  CRV: "curve-dao-token",
  SNX: "havven",
  SUSHI: "sushi",
  YFI: "yearn-finance",
  HEX: "hex",
  PLS: "pulsechain",
  SOL: "solana",
  MATIC: "matic-network",
  ARB: "arbitrum",
  OP: "optimism",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  ATOM: "cosmos",
  NEAR: "near",
  APT: "aptos",
  SUI: "sui",
  DOGE: "dogecoin",
  SHIB: "shiba-inu",
  PEPE: "pepe",
};

// ── Cache ───────────────────────────────────────────────────────────────────

interface CachedPrice {
  usd: number;
  fetchedAt: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds
const priceCache = new Map<string, CachedPrice>();

// ── Public API ──────────────────────────────────────────────────────────────

export interface PriceQuote {
  symbol: string;
  usd: number;
  source: "coingecko" | "cache" | "fallback";
  staleMs?: number; // how old the cached value is
}

/**
 * Get the current USD price for a token symbol.
 * Uses CoinGecko free API with 30s caching.
 *
 * @param symbol - Token symbol (e.g. "ETH", "USDC")
 * @returns Price quote with source metadata
 */
export async function getTokenPrice(symbol: string): Promise<PriceQuote> {
  const key = symbol.toUpperCase();

  // Stablecoins — always $1.00 (avoids wasting API calls)
  if (key === "USDC" || key === "USDT" || key === "DAI" || key === "USD") {
    return { symbol: key, usd: 1.0, source: "fallback" };
  }

  // Check cache
  const cached = priceCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { symbol: key, usd: cached.usd, source: "cache" };
  }

  // Fetch from CoinGecko
  const cgId = SYMBOL_TO_COINGECKO_ID[key];
  if (!cgId) {
    // Unknown token — return cached if available, else 0
    if (cached) {
      return {
        symbol: key,
        usd: cached.usd,
        source: "cache",
        staleMs: Date.now() - cached.fetchedAt,
      };
    }
    return { symbol: key, usd: 0, source: "fallback" };
  }

  try {
    const apiKey = process.env.COINGECKO_API_KEY;
    const baseUrl = apiKey
      ? "https://pro-api.coingecko.com/api/v3"
      : "https://api.coingecko.com/api/v3";

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (apiKey) {
      headers["x-cg-pro-api-key"] = apiKey;
    }

    const url = `${baseUrl}/simple/price?ids=${cgId}&vs_currencies=usd`;
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    if (!res.ok) {
      throw new Error(`CoinGecko ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as Record<string, { usd?: number }>;
    const price = data[cgId]?.usd;

    if (price != null) {
      priceCache.set(key, { usd: price, fetchedAt: Date.now() });
      return { symbol: key, usd: price, source: "coingecko" };
    }

    throw new Error("No price data in response");
  } catch (err) {
    console.warn(`[price-feed] CoinGecko fetch failed for ${key}:`, err);
    // Fall back to cache (even if stale)
    if (cached) {
      return {
        symbol: key,
        usd: cached.usd,
        source: "cache",
        staleMs: Date.now() - cached.fetchedAt,
      };
    }
    return { symbol: key, usd: 0, source: "fallback" };
  }
}

/**
 * Batch-fetch USD prices for multiple symbols.
 * Groups CoinGecko IDs into a single API call for efficiency.
 *
 * @param symbols - Array of token symbols
 * @returns Map of symbol → PriceQuote
 */
export async function getTokenPrices(
  symbols: string[],
): Promise<Map<string, PriceQuote>> {
  const results = new Map<string, PriceQuote>();
  const toFetch: { symbol: string; cgId: string }[] = [];

  // Resolve from cache or stablecoins first
  for (const raw of symbols) {
    const key = raw.toUpperCase();

    // Stablecoins
    if (key === "USDC" || key === "USDT" || key === "DAI" || key === "USD") {
      results.set(key, { symbol: key, usd: 1.0, source: "fallback" });
      continue;
    }

    // Cached?
    const cached = priceCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      results.set(key, { symbol: key, usd: cached.usd, source: "cache" });
      continue;
    }

    // Need to fetch
    const cgId = SYMBOL_TO_COINGECKO_ID[key];
    if (cgId) {
      toFetch.push({ symbol: key, cgId });
    } else if (cached) {
      results.set(key, {
        symbol: key,
        usd: cached.usd,
        source: "cache",
        staleMs: Date.now() - cached.fetchedAt,
      });
    } else {
      results.set(key, { symbol: key, usd: 0, source: "fallback" });
    }
  }

  // Batch fetch from CoinGecko
  if (toFetch.length > 0) {
    try {
      const apiKey = process.env.COINGECKO_API_KEY;
      const baseUrl = apiKey
        ? "https://pro-api.coingecko.com/api/v3"
        : "https://api.coingecko.com/api/v3";

      const headers: Record<string, string> = { Accept: "application/json" };
      if (apiKey) headers["x-cg-pro-api-key"] = apiKey;

      const ids = toFetch.map((t) => t.cgId).join(",");
      const url = `${baseUrl}/simple/price?ids=${ids}&vs_currencies=usd`;

      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = (await res.json()) as Record<string, { usd?: number }>;
        const now = Date.now();

        for (const { symbol, cgId } of toFetch) {
          const price = data[cgId]?.usd;
          if (price != null) {
            priceCache.set(symbol, { usd: price, fetchedAt: now });
            results.set(symbol, { symbol, usd: price, source: "coingecko" });
          } else {
            // Use stale cache as fallback
            const cached = priceCache.get(symbol);
            results.set(symbol, cached
              ? { symbol, usd: cached.usd, source: "cache", staleMs: now - cached.fetchedAt }
              : { symbol, usd: 0, source: "fallback" }
            );
          }
        }
      } else {
        throw new Error(`CoinGecko ${res.status}`);
      }
    } catch (err) {
      console.warn("[price-feed] Batch CoinGecko fetch failed:", err);
      // Fall back to stale cache for all
      for (const { symbol } of toFetch) {
        if (results.has(symbol)) continue;
        const cached = priceCache.get(symbol);
        results.set(symbol, cached
          ? { symbol, usd: cached.usd, source: "cache", staleMs: Date.now() - cached.fetchedAt }
          : { symbol, usd: 0, source: "fallback" }
        );
      }
    }
  }

  return results;
}

/**
 * Get all supported token symbols.
 */
export function getSupportedSymbols(): string[] {
  return Object.keys(SYMBOL_TO_COINGECKO_ID);
}

/**
 * Check if a symbol is a known stablecoin (pegged to $1).
 */
export function isStablecoin(symbol: string): boolean {
  const key = symbol.toUpperCase();
  return key === "USDC" || key === "USDT" || key === "DAI" || key === "USD";
}
