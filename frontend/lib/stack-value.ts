/**
 * @fileOverview  What a stack of tokens is worth. ERC-20s carry the indexer's
 *                USD price; native coins are priced from the display rates the
 *                app already fetches. Shared by the inventory cells, the
 *                inventory footer and the trade window totals so every number
 *                on screen agrees.
 * @stability     stable
 */
import { formatUnits } from 'viem';

export interface PricedStackToken {
  symbol: string;
  decimals: number;
  isNative: boolean;
  usdPrice?: number;
  /** False when the price is not trusted (flagged token the user has not chosen to count). */
  valueVerified?: boolean;
}

/** USD value of `rawAmount` of `token`, or null when no price is known or the price must not count. */
export function stackUsd(token: PricedStackToken, rawAmount: bigint | string, nativePrices: Record<string, number> = {}): number | null {
  if (token.valueVerified === false) return null;
  const price = token.usdPrice ?? (token.isNative ? nativePrices[token.symbol] : undefined);
  if (!price || price <= 0) return null;
  let raw: bigint;
  try { raw = typeof rawAmount === 'bigint' ? rawAmount : BigInt(rawAmount); } catch { return null; }
  const amount = Number(formatUnits(raw, token.decimals));
  if (!Number.isFinite(amount)) return null;
  return amount * price;
}

/** Sum of a list of stacks; `priced` says how many contributed (so "+" can mark an incomplete total), `unverified` how many were left out on purpose. */
export function sumStacksUsd(stacks: { token: PricedStackToken; rawAmount: bigint | string }[], nativePrices: Record<string, number> = {}) {
  let usd = 0, priced = 0, unverified = 0;
  for (const stack of stacks) {
    if (stack.token.valueVerified === false) { unverified++; continue; }
    const value = stackUsd(stack.token, stack.rawAmount, nativePrices);
    if (value === null) continue;
    usd += value; priced++;
  }
  return { usd, priced, total: stacks.length, unverified };
}

/** "$0.42", "$12.30", "$1.2K", "$636K", "$4.1M": short enough for a 70px cell. */
export function formatUsdCompact(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (usd >= 10_000) return `$${Math.round(usd / 1_000)}K`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  if (usd >= 100) return `$${Math.round(usd)}`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(2)}`;
  return '<$0.01';
}

/** "$636,811" or "$12.30": for footers and totals where there is room. */
export function formatUsd(usd: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: usd >= 1000 ? 0 : 2 }).format(usd);
}
