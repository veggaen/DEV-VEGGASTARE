"use client";

/**
 * @fileOverview  Portfolio over time, rebuilt from facts: today's holdings
 *                walked back through each wallet's on-chain transfers give the
 *                balance of every asset on every past day, daily prices turn
 *                those into value, and flagged tokens never count (same rule
 *                as the inventory). Live shows the connected wallets on the
 *                active chain, one or all; Paper replays the paper account's
 *                trade log against daily closes.
 * @stability     experimental
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId, useChains, useConfig, useConnections } from "wagmi";
import { getBalance } from "wagmi/actions";
import type { Address } from "viem";
import { FiInfo, FiRefreshCw } from "react-icons/fi";
import { CandleChart } from "@/components/trading/chart/CandleChart";
import { TokenIcon } from "@/components/ui/token-icon";
import { useActiveWalletOverride } from "@/contexts/active-wallet-context";
import { useTokenBalances } from "@/hooks/use-token-balances";
import { getPaperEquityCurve, type EquityCurve } from "@/actions/paper-equity";
import type { ChainEvent } from "@/lib/onchain-history";
import { DAY_MS, allocationOf, buildValueSeries, movementsFromEvents, type Holding, type PricePoint, type ValuePoint } from "@/lib/portfolio-history";
import { loadWalletHoldings, type WalletHolding } from "@/lib/wallet-holdings";
import { marketBySymbol, type Candle } from "@/lib/market/symbols";
import { formatUsd } from "@/lib/stack-value";
import { formatTokenAmount, shortAddress } from "@/lib/send-stacks";
import { TRUSTED_TOKENS_EVENT, readFlaggedTokens, readTrustedTokens } from "@/lib/trusted-tokens";
import { cn } from "@/lib/utils";

type Kind = "live" | "paper";
type Range = 30 | 90 | 365;
type WalletSeries = { holdings: WalletHolding[]; series: ValuePoint[]; partial: boolean };

const chip = (on: boolean) => cn("min-h-8 rounded-full border px-3 text-[11px] font-medium transition-[background-color,border-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", on ? "border-brand-accent/40 bg-brand-accent/12 text-foreground" : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground");

/** Daily closes for a holding: the market feed for listed markets, the token's top DEX pool otherwise. */
async function priceSeriesFor(h: Holding, chainId: number, days: number, signal?: AbortSignal): Promise<PricePoint[]> {
  const market = marketBySymbol(h.symbol);
  const listed = market && !market.stable && (h.key === "native" || market.chainId === chainId || market.address === "0x0");
  if (market?.stable) return [{ t: 0, p: 1 }];
  try {
    if (listed) {
      const res = await fetch(`/api/market/candles?symbol=${encodeURIComponent(market.symbol)}&interval=1d&limit=${days + 2}`, { signal });
      if (res.ok) { const data = (await res.json()) as { candles?: Candle[] }; const pts = (data.candles ?? []).map((c) => ({ t: c.t, p: c.c })); if (pts.length) return pts; }
    }
    const res = await fetch(`/api/wallets/evm/price-history?chainId=${chainId}&address=${h.key === "native" ? "native" : h.key}&days=${days}`, { signal });
    if (res.ok) { const data = (await res.json()) as { points?: PricePoint[] }; if (data.points?.length) return data.points; }
  } catch { /* fall through: valued flat at today's price */ }
  return h.usdPrice ? [{ t: 0, p: h.usdPrice }] : [];
}

function toCandles(points: ValuePoint[]): Candle[] {
  return points.map((p, i) => { const prev = points[i - 1]?.usd ?? p.usd; return { t: p.t, o: prev, h: Math.max(prev, p.usd), l: Math.min(prev, p.usd), c: p.usd, v: 0 }; });
}

export function PortfolioPanel({ className }: { className?: string }) {
  const config = useConfig();
  const chainId = useChainId();
  const chains = useChains();
  const connections = useConnections();
  const { address: connected } = useAccount();
  const { override } = useActiveWalletOverride();
  const activeAddress = (override?.address ?? connected)?.toLowerCase();
  const { tokens: activeTokens, loading: activeLoading } = useTokenBalances();
  const nativeSymbol = chains.find((c) => c.id === chainId)?.nativeCurrency.symbol ?? "ETH";
  const chainName = chains.find((c) => c.id === chainId)?.name ?? `Chain ${chainId}`;

  const [kind, setKind] = useState<Kind>("live");
  const [range, setRange] = useState<Range>(90);
  const [selected, setSelected] = useState<string | "all">("all");
  const [data, setData] = useState<Map<string, WalletSeries>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paper, setPaper] = useState<EquityCurve | null>(null);
  const [paperError, setPaperError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const priceCache = useRef(new Map<string, PricePoint[]>());
  const eventsCache = useRef(new Map<string, ChainEvent[]>());

  useEffect(() => { const bump = () => setTick((n) => n + 1); window.addEventListener(TRUSTED_TOKENS_EVENT, bump); return () => window.removeEventListener(TRUSTED_TOKENS_EVENT, bump); }, []);

  const wallets = useMemo(() => {
    const seen = new Set<string>();
    const list = connections.flatMap((c) => c.accounts.map((a) => ({ address: (a as string).toLowerCase(), wallet: c.connector.name })));
    if (override?.address) list.unshift({ address: override.address.toLowerCase(), wallet: override.label ?? "Local account" });
    return list.filter((w) => !seen.has(w.address) && seen.add(w.address));
  }, [connections, override?.address, override?.label]);
  const targets = useMemo(() => (selected === "all" ? wallets : wallets.filter((w) => w.address === selected)), [selected, wallets]);

  // Holdings of the active wallet come from the polling hook (full gating); other wallets are loaded on demand.
  const activeHoldings = useMemo<WalletHolding[]>(() => activeTokens.map((t) => ({
    key: t.isNative ? "native" : t.address.toLowerCase(), address: t.address, symbol: t.symbol, decimals: t.decimals, balance: t.rawBalance, isNative: t.isNative, logo: t.logo, usdPrice: t.usdPrice, counts: t.valueVerified !== false, level: t.risk?.level ?? "unknown",
  })), [activeTokens]);

  const compute = useCallback(async (signal: AbortSignal) => {
    if (kind !== "live" || !targets.length) return;
    setLoading(true); setError(null);
    const trusted = readTrustedTokens(), flagged = readFlaggedTokens();
    const now = Date.now();
    const next = new Map<string, WalletSeries>();
    try {
      for (const w of targets) {
        const isActive = w.address === activeAddress;
        let holdings: WalletHolding[];
        if (isActive && activeHoldings.length) holdings = activeHoldings;
        else {
          const nativeBalance = await getBalance(config, { address: w.address as Address, chainId }).then((b) => b.value).catch(() => BigInt(0));
          holdings = await loadWalletHoldings({ chainId, address: w.address, nativeSymbol, nativeBalance, trusted, flagged, signal });
        }
        const eventsKey = `${chainId}:${w.address}`;
        let events = eventsCache.current.get(eventsKey);
        let partial = false;
        if (!events) {
          const res = await fetch(`/api/wallets/evm/history?chainId=${chainId}&address=${w.address}&pages=3`, { signal });
          if (res.ok) { const body = (await res.json()) as { events: ChainEvent[]; partial?: boolean }; events = body.events; partial = Boolean(body.partial); eventsCache.current.set(eventsKey, events); }
          else { events = []; partial = true; }
        }
        const prices = new Map<string, PricePoint[]>();
        await Promise.all(holdings.filter((h) => h.counts).slice(0, 16).map(async (h) => {
          const key = `${chainId}:${h.key}:${range}`;
          let pts = priceCache.current.get(key);
          if (!pts) { pts = await priceSeriesFor(h, chainId, range, signal); priceCache.current.set(key, pts); }
          prices.set(h.key, pts);
        }));
        const series = buildValueSeries({ holdings, movements: movementsFromEvents(events, w.address), prices, fromT: now - range * DAY_MS, toT: now });
        next.set(w.address, { holdings, series, partial });
      }
      if (!signal.aborted) setData(next);
    } catch (err) {
      if (!signal.aborted) setError(err instanceof Error && /429/.test(err.message) ? "Too many requests; try again in a minute." : "Could not rebuild the history. Try again.");
    } finally { if (!signal.aborted) setLoading(false); }
  }, [kind, targets, activeAddress, activeHoldings, config, chainId, nativeSymbol, range]);

  useEffect(() => {
    if (kind !== "live") return;
    if (activeLoading && targets.some((w) => w.address === activeAddress)) return; // wait for a complete active-wallet read
    const controller = new AbortController();
    void compute(controller.signal);
    return () => controller.abort();
  }, [compute, kind, activeLoading, targets, activeAddress, tick]);

  useEffect(() => {
    if (kind !== "paper") return;
    let cancelled = false;
    setPaper(null); setPaperError(null);
    getPaperEquityCurve({ days: range }).then((r) => { if (cancelled) return; if (r.success) setPaper(r.data); else setPaperError(r.error); }).catch(() => { if (!cancelled) setPaperError("The paper account's history is temporarily unavailable."); });
    return () => { cancelled = true; };
  }, [kind, range]);

  // ── Combine ──────────────────────────────────────────────────────────────
  const combined = useMemo<ValuePoint[]>(() => {
    if (kind === "paper") return paper ? paper.points.map((p) => ({ t: p.t, usd: p.usd, parts: {} })) : [];
    const lists = targets.map((w) => data.get(w.address)?.series).filter((s): s is ValuePoint[] => Boolean(s?.length));
    if (!lists.length) return [];
    const byT = new Map<number, ValuePoint>();
    for (const s of lists) for (const p of s) { const cur = byT.get(p.t) ?? { t: p.t, usd: 0, parts: {} }; cur.usd += p.usd; for (const [k, v] of Object.entries(p.parts)) cur.parts[k] = (cur.parts[k] ?? 0) + v; byT.set(p.t, cur); }
    return Array.from(byT.values()).sort((a, b) => a.t - b.t);
  }, [kind, paper, targets, data]);
  const holdings = useMemo<WalletHolding[]>(() => {
    const merged = new Map<string, WalletHolding>();
    for (const w of targets) for (const h of data.get(w.address)?.holdings ?? []) { const cur = merged.get(h.key); merged.set(h.key, cur ? { ...cur, balance: cur.balance + h.balance, counts: cur.counts || h.counts } : { ...h }); }
    return Array.from(merged.values());
  }, [targets, data]);
  const allocation = useMemo(() => (kind === "paper" ? (paper?.allocation ?? []).map((a) => ({ key: a.symbol, symbol: a.symbol, usd: a.usd, share: a.share })) : allocationOf(combined[combined.length - 1], holdings)), [kind, paper, combined, holdings]);
  const candles = useMemo(() => toCandles(combined), [combined]);
  const first = combined[0]?.usd, last = combined[combined.length - 1]?.usd;
  const change = first !== undefined && last !== undefined ? last - first : null;
  const changePct = change !== null && first ? (change / first) * 100 : null;
  const high = combined.length ? Math.max(...combined.map((p) => p.usd)) : null;
  const low = combined.length ? Math.min(...combined.map((p) => p.usd)) : null;
  const leftOut = holdings.filter((h) => !h.counts && (h.usdPrice ?? 0) > 0);
  const partial = targets.some((w) => data.get(w.address)?.partial);

  return (
    <section className={cn("space-y-3", className)} aria-label="Portfolio over time">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">Portfolio</h2>
        <div role="tablist" aria-label="Account type" className="flex items-center gap-0.5 rounded-full border border-border/60 bg-foreground/[0.04] p-0.5">
          {(["live", "paper"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
              className={cn("min-h-7 rounded-full px-3 text-[11px] font-semibold uppercase tracking-wider transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", kind === k ? (k === "paper" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-brand-accent/15 text-brand-accent-hover dark:text-brand-accent-light") : "text-muted-foreground hover:text-foreground")}>
              {k === "live" ? "Live" : "Paper"}
            </button>
          ))}
        </div>
        {kind === "live" && <span className="text-[11px] text-muted-foreground">{chainName}</span>}
        <div role="group" aria-label="Range" className="ml-auto flex items-center gap-1">
          {([30, 90, 365] as const).map((r) => <button key={r} type="button" onClick={() => setRange(r)} aria-pressed={range === r} className={chip(range === r)}>{r === 365 ? "1Y" : `${r}D`}</button>)}
          <button type="button" onClick={() => { eventsCache.current.clear(); priceCache.current.clear(); setTick((n) => n + 1); }} disabled={loading} aria-label="Rebuild" className="grid size-8 place-items-center rounded-lg border border-border/60 text-muted-foreground transition-[background-color,color] duration-150 hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50">
            <FiRefreshCw className={cn("h-3.5 w-3.5", loading && "motion-safe:animate-spin")} />
          </button>
        </div>
      </header>

      {kind === "live" && wallets.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setSelected("all")} aria-pressed={selected === "all"} className={chip(selected === "all")}>All wallets ({wallets.length})</button>
          {wallets.map((w) => <button key={w.address} type="button" onClick={() => setSelected(w.address)} aria-pressed={selected === w.address} className={chip(selected === w.address)}><span className="font-mono">{shortAddress(w.address)}</span> <span className="opacity-70">{w.wallet}</span></button>)}
        </div>
      )}

      {kind === "live" && !wallets.length && <p className="rounded-xl border border-border/60 bg-foreground/[0.03] p-4 text-sm text-muted-foreground">Connect a wallet to see its value over time.</p>}
      {kind === "live" && error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">{error}</p>}
      {kind === "paper" && paperError && <p className="rounded-xl border border-border/60 bg-foreground/[0.03] p-4 text-sm text-muted-foreground">{paperError}</p>}
      {(loading || (kind === "paper" && !paper && !paperError)) && !combined.length && <div role="status" aria-label="Rebuilding history" className="h-[340px] rounded-xl bg-foreground/[0.04] motion-safe:animate-pulse" />}

      {combined.length > 0 && (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["Value now", last !== undefined ? formatUsd(last) : "—"], [`Change · ${range === 365 ? "1Y" : `${range}D`}`, change === null ? "—" : `${change >= 0 ? "+" : "−"}${formatUsd(Math.abs(change))}${changePct !== null ? ` (${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%)` : ""}`], ["High", high !== null ? formatUsd(high) : "—"], ["Low", low !== null ? formatUsd(low) : "—"]].map(([k, v], i) => (
              <div key={k} className="rounded-xl border border-border/60 bg-foreground/[0.03] px-3 py-2"><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt><dd className={cn("text-sm font-semibold tabular-nums", i === 1 && change !== null ? (change >= 0 ? "text-chart-up" : "text-chart-down") : "text-foreground")}>{v}</dd></div>
            ))}
          </dl>
          <div className="relative h-[360px] overflow-hidden rounded-xl border border-border/60 bg-card/60">
            <CandleChart candles={candles} interval="1d" chartType="area" tool="cursor" drawings={[]} onDrawingsChange={() => undefined} showVolume={false} fitKey={`${kind}:${selected}:${range}:${chainId}:${combined.length}`} className="absolute inset-0" />
            {loading && <span role="status" className="absolute right-3 top-3 rounded-md bg-card/85 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">Rebuilding…</span>}
          </div>

          {allocation.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-foreground/[0.03] p-3">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Holdings today</h3>
              <ol className="space-y-1.5">
                {allocation.slice(0, 12).map((a) => {
                  const h = holdings.find((x) => x.key === a.key);
                  return (
                    <li key={a.key} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 text-xs">
                      {h && !h.isNative ? <TokenIcon address={h.address} chainId={chainId} symbol={h.symbol} logo={h.logo} size={18} /> : <span className="grid size-[18px] place-items-center rounded-full bg-foreground/[0.08] text-[9px] font-bold text-muted-foreground">{a.symbol.slice(0, 1)}</span>}
                      <span className="min-w-0">
                        <span className="flex items-center justify-between gap-2"><span className="font-semibold text-foreground">{a.symbol}</span><span className="tabular-nums text-muted-foreground">{h ? `${formatTokenAmount(h.balance, h.decimals)} · ` : ""}{(a.share * 100).toFixed(1)}%</span></span>
                        <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-foreground/[0.06]"><span className="block h-full rounded-full bg-brand-accent" style={{ width: `${Math.max(1, a.share * 100)}%` }} /></span>
                      </span>
                      <span className="tabular-nums text-foreground">{formatUsd(a.usd)}</span>
                      <span className="w-14 text-right text-[10px] tabular-nums text-muted-foreground">{h?.usdPrice ? `@ ${h.usdPrice >= 1 ? h.usdPrice.toFixed(2) : h.usdPrice.toPrecision(3)}` : ""}</span>
                    </li>
                  );
                })}
              </ol>
              {leftOut.length > 0 && <p className="mt-2 text-[11px] text-muted-foreground">Left out (flagged or unverified): {leftOut.map((h) => h.symbol).slice(0, 8).join(", ")}{leftOut.length > 8 ? "…" : ""}. Count a token from its inventory card to include it.</p>}
            </div>
          )}
        </>
      )}
      {kind === "live" && !loading && wallets.length > 0 && !combined.length && !error && <p className="rounded-xl border border-border/60 bg-foreground/[0.03] p-4 text-sm text-muted-foreground">Nothing to chart yet for {selected === "all" ? "these wallets" : "this wallet"} on {chainName}.</p>}

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground"><FiInfo className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        {kind === "live" ? `Rebuilt from your wallets' on-chain transfers and daily prices${partial ? " (the explorer answered only partly, so older days may be off)" : ""}. Flagged tokens do not count until you choose to count them.` : "Replays your paper trades against daily closes; the last point is the account's live value."}
      </p>
    </section>
  );
}
