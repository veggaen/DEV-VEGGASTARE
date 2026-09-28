"use client";

/**
 * @fileOverview  Portfolio over time: the value of your live wallets (per
 *                chain) or of the paper account, charted from the points the
 *                hub records whenever it has a fresh total. Filter Live | Paper,
 *                one account or all of them summed, and a time range.
 * @stability     experimental
 */

import { useEffect, useMemo, useState } from "react";
import { useChains } from "wagmi";
import { FiInfo } from "react-icons/fi";
import { CandleChart } from "@/components/trading/chart/CandleChart";
import { useCurrentUser } from "@/hooks/use-current-user";
import { SNAPSHOT_EVENT, combineSeries, listSnapshotIds, readSnapshots, toCandles, type Snapshot, type SnapshotKind } from "@/lib/portfolio-snapshots";
import { formatUsd } from "@/lib/stack-value";
import { shortAddress } from "@/lib/send-stacks";
import { cn } from "@/lib/utils";

type Range = "1d" | "1w" | "1m" | "all";
const RANGE_MS: Record<Range, number> = { "1d": 86_400_000, "1w": 7 * 86_400_000, "1m": 30 * 86_400_000, all: Infinity };
const chip = (on: boolean) => cn("min-h-8 rounded-full border px-3 text-[11px] font-medium transition-[background-color,border-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", on ? "border-brand-accent/40 bg-brand-accent/12 text-foreground" : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground");

export function PortfolioPanel({ className }: { className?: string }) {
  const chains = useChains();
  const user = useCurrentUser();
  const [kind, setKind] = useState<SnapshotKind>("live");
  const [account, setAccount] = useState<string | "all">("all");
  const [range, setRange] = useState<Range>("1w");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(SNAPSHOT_EVENT, bump);
    return () => window.removeEventListener(SNAPSHOT_EVENT, bump);
  }, []);

  const ids = useMemo(() => listSnapshotIds(kind), [kind, tick]); // eslint-disable-line react-hooks/exhaustive-deps -- tick re-reads storage
  const labelFor = (id: string) => {
    if (kind === "paper") return "Paper account";
    const [chain, address] = id.split(":");
    return `${chains.find((c) => c.id === Number(chain))?.name ?? `Chain ${chain}`} · ${address ? shortAddress(address) : id}`;
  };

  const points: Snapshot[] = useMemo(() => {
    const selected = account === "all" ? ids : ids.filter((id) => id === account);
    const series = selected.map((id) => readSnapshots(kind, id));
    const merged = series.length === 1 ? series[0] : combineSeries(series, 30 * 60_000);
    // The range counts back from the latest recorded point (pure: no clock read during render).
    const end = merged[merged.length - 1]?.t ?? 0;
    const from = end - RANGE_MS[range];
    return merged.filter((p) => p.t >= from);
  }, [ids, account, kind, range, tick]); // eslint-disable-line react-hooks/exhaustive-deps -- tick re-reads storage

  const bucket = range === "1d" ? 30 * 60_000 : range === "1w" ? 3_600_000 : 86_400_000;
  const candles = useMemo(() => toCandles(points, bucket), [points, bucket]);
  const first = points[0]?.usd, last = points[points.length - 1]?.usd;
  const change = first !== undefined && last !== undefined ? last - first : null;
  const changePct = change !== null && first ? (change / first) * 100 : null;
  const high = points.length ? Math.max(...points.map((p) => p.usd)) : null;
  const low = points.length ? Math.min(...points.map((p) => p.usd)) : null;

  return (
    <section className={cn("space-y-3", className)} aria-label="Portfolio over time">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">Portfolio</h2>
        <div role="tablist" aria-label="Account type" className="flex items-center gap-0.5 rounded-full border border-border/60 bg-foreground/[0.04] p-0.5">
          {(["live", "paper"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setAccount("all"); }}
              className={cn("min-h-7 rounded-full px-3 text-[11px] font-semibold uppercase tracking-wider transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", kind === k ? (k === "paper" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-brand-accent/15 text-brand-accent-hover dark:text-brand-accent-light") : "text-muted-foreground hover:text-foreground")}>
              {k === "live" ? "Live" : "Paper"}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Range" className="ml-auto flex items-center gap-1">
          {(["1d", "1w", "1m", "all"] as const).map((r) => <button key={r} type="button" onClick={() => setRange(r)} aria-pressed={range === r} className={chip(range === r)}>{r.toUpperCase()}</button>)}
        </div>
      </header>

      {ids.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setAccount("all")} aria-pressed={account === "all"} className={chip(account === "all")}>All ({ids.length})</button>
          {ids.map((id) => <button key={id} type="button" onClick={() => setAccount(id)} aria-pressed={account === id} className={chip(account === id)}>{labelFor(id)}</button>)}
        </div>
      )}

      {points.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-foreground/[0.03] p-4 text-sm text-muted-foreground">
          {ids.length === 0
            ? kind === "live" ? "No live points yet. Open the hub with a connected wallet and a value is recorded each visit; the curve builds from there." : `No paper points yet${user?.id ? "" : " (sign in and open the terminal)"}. Each terminal visit records the paper account's value.`
            : "Nothing recorded in this range yet."}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["Value", last !== undefined ? formatUsd(last) : "—"], ["Change", change === null ? "—" : `${change >= 0 ? "+" : "−"}${formatUsd(Math.abs(change))}${changePct !== null ? ` (${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%)` : ""}`], ["High", high !== null ? formatUsd(high) : "—"], ["Low", low !== null ? formatUsd(low) : "—"]].map(([k, v], i) => (
              <div key={k} className="rounded-xl border border-border/60 bg-foreground/[0.03] px-3 py-2"><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt><dd className={cn("text-sm font-semibold tabular-nums", i === 1 && change !== null ? (change >= 0 ? "text-chart-up" : "text-chart-down") : "text-foreground")}>{v}</dd></div>
            ))}
          </dl>
          <div className="relative h-[340px] overflow-hidden rounded-xl border border-border/60 bg-card/60">
            <CandleChart candles={candles} interval={bucket >= 86_400_000 ? "1d" : "1h"} chartType="area" tool="cursor" drawings={[]} onDrawingsChange={() => undefined} showVolume={false} fitKey={`${kind}:${account}:${range}`} className="absolute inset-0" />
          </div>
        </>
      )}
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground"><FiInfo className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />Points are recorded in this browser each time the hub has a fresh total (at most every 30 minutes per account). Live values follow the same rule as the inventory: flagged tokens do not count until you choose to count them.</p>
    </section>
  );
}
