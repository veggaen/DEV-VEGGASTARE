/**
 * @fileOverview  Portfolio value over time, rebuilt from facts instead of
 *                waiting for recorded points: today's balances walked back
 *                through the wallet's transfer history give the balance of
 *                every holding on every past day, and daily prices turn those
 *                into value. Pure maths; the panel fetches the inputs.
 * @stability     experimental
 */
import type { ChainEvent } from '@/lib/onchain-history';

export type Holding = {
  /** `native` or the lower-cased token address. */
  key: string;
  symbol: string;
  decimals: number;
  balance: bigint;
  usdPrice?: number;
  /** False when the token is flagged and must not count (same rule as the inventory). */
  counts: boolean;
};

/** One balance change for one holding: positive in, negative out, from the wallet's point of view. */
export type Movement = { t: number; key: string; delta: bigint };

/** Daily closes, ascending. */
export type PricePoint = { t: number; p: number };

export const DAY_MS = 86_400_000;

/** Movements the events imply for the wallet (token transfers, native value, fees paid). */
export function movementsFromEvents(events: ChainEvent[], wallet: string): Movement[] {
  const w = wallet.toLowerCase();
  const out: Movement[] = [];
  for (const e of events) {
    if (e.wallet.toLowerCase() !== w) continue;
    const nativeIn = safeBigInt(e.nativeIn), nativeOut = safeBigInt(e.nativeOut), fee = safeBigInt(e.feeWei ?? '0');
    const nativeDelta = nativeIn - nativeOut - fee;
    if (nativeDelta !== BigInt(0)) out.push({ t: e.timestamp, key: 'native', delta: nativeDelta });
    for (const m of e.tokens) {
      const v = safeBigInt(m.value);
      if (v === BigInt(0)) continue;
      out.push({ t: e.timestamp, key: m.address.toLowerCase(), delta: m.direction === 'in' ? v : -v });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

function safeBigInt(v: string): bigint { try { return BigInt(v); } catch { return BigInt(0); } }

/** Balance of `key` at time `t`, walking today's balance back through later movements. */
export function balanceAt(current: bigint, movements: Movement[], key: string, t: number): bigint {
  let b = current;
  for (let i = movements.length - 1; i >= 0; i--) {
    const m = movements[i];
    if (m.key !== key || m.t <= t) continue;
    b -= m.delta;
  }
  return b < BigInt(0) ? BigInt(0) : b;
}

/** Last close at or before `t`; the first close when `t` predates the series. */
export function priceAt(series: PricePoint[] | undefined, t: number): number | undefined {
  if (!series?.length) return undefined;
  if (t < series[0].t) return series[0].p;
  let lo = 0, hi = series.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (series[mid].t <= t) lo = mid; else hi = mid - 1; }
  return series[lo].p;
}

export type ValuePoint = { t: number; usd: number; parts: Record<string, number> };

/** Daily value of the holdings from `fromT` to `toT` (inclusive of today), oldest first. */
export function buildValueSeries(args: {
  holdings: Holding[];
  movements: Movement[];
  prices: Map<string, PricePoint[]>;
  fromT: number;
  toT: number;
  stepMs?: number;
}): ValuePoint[] {
  const step = args.stepMs ?? DAY_MS;
  const out: ValuePoint[] = [];
  const start = Math.floor(args.fromT / step) * step;
  for (let t = start; t <= args.toT; t += step) {
    const at = Math.min(t + step - 1, args.toT);
    let usd = 0;
    const parts: Record<string, number> = {};
    for (const h of args.holdings) {
      if (!h.counts) continue;
      const balance = balanceAt(h.balance, args.movements, h.key, at);
      if (balance <= BigInt(0)) continue;
      const price = priceAt(args.prices.get(h.key), at) ?? h.usdPrice;
      if (!price) continue;
      const value = Number(balance) / 10 ** h.decimals * price;
      if (!Number.isFinite(value)) continue;
      parts[h.key] = value; usd += value;
    }
    out.push({ t, usd, parts });
  }
  return out;
}

/** Today's allocation from the last point, largest first, with the share of the total. */
export function allocationOf(point: ValuePoint | undefined, holdings: Holding[]): Array<{ key: string; symbol: string; usd: number; share: number }> {
  if (!point || point.usd <= 0) return [];
  return Object.entries(point.parts)
    .map(([key, usd]) => ({ key, symbol: holdings.find((h) => h.key === key)?.symbol ?? key.slice(0, 8), usd, share: usd / point.usd }))
    .sort((a, b) => b.usd - a.usd);
}
