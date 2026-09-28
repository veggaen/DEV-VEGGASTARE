/**
 * @fileOverview  Holdings of any wallet on a chain, read-only and gated by
 *                the same rules as the inventory: indexer balances, DEX
 *                prices and liquidity, GoPlus and Honeypot.is verdicts, and
 *                the user's own trust/flag lists. Used by the Portfolio panel
 *                for wallets other than the active one (the active wallet
 *                comes from the balance hook, which polls).
 * @stability     experimental
 */
import { KNOWN_TOKENS } from '@/hooks/use-token-balances';
import type { DiscoveredToken } from '@/lib/wallet-tokens';
import { assessToken, valueCounts, type GoPlusSecurity, type HoneypotVerdict } from '@/lib/token-risk';
import { trustedTokenKey } from '@/lib/trusted-tokens';
import type { Holding } from '@/lib/portfolio-history';

export type WalletHolding = Holding & { address: string; isNative: boolean; logo?: string; level: string };

const HONEYPOT_CHAINS = new Set([1, 56, 8453]);

export async function loadWalletHoldings(args: {
  chainId: number;
  address: string;
  nativeSymbol: string;
  nativeBalance: bigint;
  trusted: Set<string>;
  flagged: Set<string>;
  signal?: AbortSignal;
}): Promise<WalletHolding[]> {
  const { chainId, address, signal } = args;
  const get = async <T,>(url: string): Promise<T | null> => {
    const res = await fetch(url, { signal });
    return res.ok ? ((await res.json()) as T) : null;
  };
  const discovered = (await get<{ tokens?: DiscoveredToken[] }>(`/api/wallets/evm/tokens?chainId=${chainId}&address=${address}`))?.tokens ?? [];
  const known = new Set((KNOWN_TOKENS[chainId] ?? []).map((t) => t.address.toLowerCase()));
  const erc20 = discovered.filter((t) => { try { return BigInt(t.balance) > BigInt(0); } catch { return false; } });
  const addresses = erc20.map((t) => t.address.toLowerCase());

  const prices = await get<{ prices?: Record<string, number>; liquidity?: Record<string, number>; volume24h?: Record<string, number>; native?: number | null }>(`/api/wallets/evm/prices?chainId=${chainId}&addresses=${addresses.slice(0, 90).join(',')}`);
  const security = (await get<{ tokens?: Record<string, GoPlusSecurity> }>(`/api/wallets/evm/security?chainId=${chainId}&addresses=${addresses.slice(0, 120).join(',')}`))?.tokens ?? {};
  const suspects = erc20.filter((t) => { const a = t.address.toLowerCase(); return !known.has(a) && ((prices?.prices?.[a] ?? t.usdRate ?? 0) > 0) && security[a]?.trust_list !== '1'; }).map((t) => t.address.toLowerCase());
  const honeypot = HONEYPOT_CHAINS.has(chainId) && suspects.length ? ((await get<{ tokens?: Record<string, HoneypotVerdict> }>(`/api/wallets/evm/honeypot?chainId=${chainId}&addresses=${suspects.slice(0, 40).join(',')}`))?.tokens ?? {}) : {};

  const out: WalletHolding[] = [];
  const nativeRisk = assessToken({ isNative: true });
  out.push({ key: 'native', address: '0x0000000000000000000000000000000000000000', symbol: args.nativeSymbol, decimals: 18, balance: args.nativeBalance, isNative: true, usdPrice: prices?.native ?? undefined, counts: true, level: nativeRisk.level });
  for (const t of erc20) {
    const a = t.address.toLowerCase();
    const usdPrice = prices?.prices?.[a] ?? t.usdRate ?? undefined;
    const risk = assessToken({
      isKnown: known.has(a),
      flaggedByUser: args.flagged.has(trustedTokenKey(chainId, a)),
      goplus: security[a] ?? null,
      honeypot: honeypot[a] ?? null,
      liquidityUsd: prices?.liquidity?.[a],
      volume24hUsd: prices?.volume24h?.[a],
      hasPrice: usdPrice !== undefined,
    });
    out.push({ key: a, address: t.address, symbol: t.symbol || '???', decimals: t.decimals, balance: BigInt(t.balance), isNative: false, logo: t.logo ?? undefined, usdPrice, counts: valueCounts(risk.level, args.trusted.has(trustedTokenKey(chainId, a))), level: risk.level });
  }
  return out;
}
