/**
 * @fileOverview  Token prices for any EVM chain we show an inventory on.
 *                GeckoTerminal's keyless "simple token price" endpoint prices
 *                by DEX liquidity, so long-tail PulseChain tokens get a number
 *                the Blockscout indexer does not carry. The native coin is
 *                priced through its wrapped token. Pure helpers here; the
 *                network call lives in the API route.
 * @stability     evolving
 */

/** GeckoTerminal network slugs. */
export const GECKO_NETWORKS: Record<number, string> = {
  1: 'eth',
  369: 'pulsechain',
  8453: 'base',
  42161: 'arbitrum',
  137: 'polygon_pos',
  10: 'optimism',
  56: 'bsc',
};

/** Wrapped native token per chain: its DEX price is the native coin's price. */
export const WRAPPED_NATIVE: Record<number, string> = {
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  369: '0xA1077a294dDE1B09bB078844df40758a5D0f9a27',
  8453: '0x4200000000000000000000000000000000000006',
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  10: '0x4200000000000000000000000000000000000006',
  56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
};

export const GECKO_BATCH = 30;

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

/** Lower-cased, de-duplicated, valid addresses only. */
export function normaliseAddresses(input: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const a = raw.trim().toLowerCase();
    if (!ADDRESS.test(a) || seen.has(a)) continue;
    seen.add(a); out.push(a);
  }
  return out;
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export type GeckoSimple = {
  prices: Record<string, number>;
  /** Total DEX reserve (liquidity) in USD per address. */
  reserves: Record<string, number>;
  /** 24 h traded volume in USD per address. */
  volumes: Record<string, number>;
};

/** The full "simple token price" answer: prices plus, when requested, reserve and 24 h volume tables. */
export function parseGeckoSimple(payload: unknown): GeckoSimple {
  const attrs = ((payload as { data?: { attributes?: Record<string, unknown> } } | null)?.data?.attributes ?? {}) as Record<string, unknown>;
  const table = (key: string): Record<string, number> => {
    const out: Record<string, number> = {};
    const src = attrs[key];
    if (!src || typeof src !== 'object') return out;
    for (const [address, value] of Object.entries(src as Record<string, unknown>)) {
      const n = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(n) && n >= 0) out[address.toLowerCase()] = n;
    }
    return out;
  };
  return { prices: parseGeckoPrices(payload), reserves: table('total_reserve_in_usd'), volumes: table('h24_volume_usd') };
}

/** `{ data: { attributes: { token_prices: { addr: "0.0032" } } } }` → `{ addr: 0.0032 }` (finite, positive only). */
export function parseGeckoPrices(payload: unknown): Record<string, number> {
  const prices: Record<string, number> = {};
  const table = (payload as { data?: { attributes?: { token_prices?: Record<string, unknown> } } } | null)?.data?.attributes?.token_prices;
  if (!table || typeof table !== 'object') return prices;
  for (const [address, value] of Object.entries(table)) {
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(n) && n > 0) prices[address.toLowerCase()] = n;
  }
  return prices;
}
