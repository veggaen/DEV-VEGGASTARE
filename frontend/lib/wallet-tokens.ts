/**
 * @fileOverview  Token discovery for a wallet. A hardcoded list of seven
 *                tokens per chain is not an inventory, so the wallet's real
 *                holdings come from Blockscout's keyless address API, are
 *                merged with the known list, and the balance reader then
 *                confirms them over RPC (with the indexed value as fallback).
 *                Pure helpers; shared by the API route and the client hook.
 * @stability     evolving
 */

/** Blockscout instances that expose `/api/v2/addresses/{address}/token-balances` (CORS *, no key). */
export const BLOCKSCOUT_HOSTS: Record<number, string> = {
  1: 'https://eth.blockscout.com',
  8453: 'https://base.blockscout.com',
  369: 'https://api.scan.pulsechain.com',
  42161: 'https://arbitrum.blockscout.com',
  10: 'https://optimism.blockscout.com',
  137: 'https://polygon.blockscout.com',
  11155111: 'https://eth-sepolia.blockscout.com',
  84532: 'https://base-sepolia.blockscout.com',
};

export interface DiscoveredToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
  /** Raw integer balance as a decimal string (indexed; may lag the chain by a block or two). */
  balance: string;
  usdRate?: number;
}

export interface KnownTokenMeta {
  address: string;
  symbol: string;
  decimals: number;
  logo?: string;
}

export interface TokenCandidate extends KnownTokenMeta {
  /** Balance the indexer reported, used when the RPC read fails for this token. */
  indexedBalance?: bigint;
  /** USD per whole token as the indexer knows it (CoinGecko-backed); undefined when unpriced. */
  indexedUsdRate?: number;
}

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

/**
 * Normalise a Blockscout `token-balances` response. Keeps ERC-20s with a
 * non-zero balance, drops tokens the indexer flags as scams, and orders by
 * USD value when a rate exists, then by raw amount. Capped: a wallet with
 * thousands of airdrops still gets a usable inventory.
 */
export function fromBlockscout(payload: unknown, limit = 60): DiscoveredToken[] {
  if (!Array.isArray(payload)) return [];
  const out: (DiscoveredToken & { usd: number; raw: bigint })[] = [];
  for (const item of payload) {
    const entry = asRecord(item);
    const token = asRecord(entry?.token);
    if (!entry || !token) continue;
    if (token.type !== undefined && token.type !== 'ERC-20') continue;
    if (token.reputation === 'scam') continue;
    const address = String(token.address_hash ?? token.address ?? '');
    if (!ADDRESS.test(address)) continue;
    const decimals = Number(token.decimals ?? 18);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) continue;
    let raw: bigint;
    try { raw = BigInt(String(entry.value ?? '0')); } catch { continue; }
    if (raw <= BigInt(0)) continue;
    const symbol = typeof token.symbol === 'string' && token.symbol.trim() ? token.symbol.trim().slice(0, 16) : null;
    if (!symbol) continue;
    const rate = Number(token.exchange_rate);
    const usdRate = Number.isFinite(rate) && rate > 0 ? rate : undefined;
    const usd = usdRate ? (Number(raw) / 10 ** decimals) * usdRate : 0;
    const icon = typeof token.icon_url === 'string' && token.icon_url.startsWith('https://') ? token.icon_url : undefined;
    out.push({
      address, symbol, decimals, usdRate, usd, raw,
      name: typeof token.name === 'string' && token.name.trim() ? token.name.trim().slice(0, 64) : symbol,
      logo: icon,
      balance: raw.toString(),
    });
  }
  out.sort((a, b) => (b.usd - a.usd) || (b.raw > a.raw ? 1 : b.raw < a.raw ? -1 : 0));
  return out.slice(0, limit).map(({ usd: _usd, raw: _raw, ...token }) => token);
}

/** Known tokens first (stable order), then discovered ones not already listed. */
export function mergeTokenCandidates(known: KnownTokenMeta[], discovered: DiscoveredToken[]): TokenCandidate[] {
  const seen = new Set(known.map((t) => t.address.toLowerCase()));
  const byAddress = new Map(discovered.map((t) => [t.address.toLowerCase(), t]));
  const result: TokenCandidate[] = known.map((t) => {
    const hit = byAddress.get(t.address.toLowerCase());
    return { ...t, logo: t.logo ?? hit?.logo, indexedBalance: hit ? safeBigInt(hit.balance) : undefined, indexedUsdRate: hit?.usdRate };
  });
  for (const t of discovered) {
    const key = t.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ address: t.address, symbol: t.symbol, decimals: t.decimals, logo: t.logo, indexedBalance: safeBigInt(t.balance), indexedUsdRate: t.usdRate });
  }
  return result;
}

function safeBigInt(value: string): bigint | undefined {
  try { return BigInt(value); } catch { return undefined; }
}
