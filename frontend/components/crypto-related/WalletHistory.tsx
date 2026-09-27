"use client";

/**
 * @fileOverview  Live history: what your wallets did on-chain, read from the
 *                block explorer's index rather than from the app's records.
 *                Filter by any connected wallet or see them all together;
 *                rows that match an app record (P2P, transfer, DEX) carry its
 *                badge. The chain follows the active network.
 * @stability     experimental
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChainId, useChains, useConnections } from "wagmi";
import { FiArrowDownLeft, FiArrowUpRight, FiCode, FiExternalLink, FiRefreshCw, FiRepeat, FiAlertTriangle } from "react-icons/fi";
import { TokenIcon } from "@/components/ui/token-icon";
import { useWalletAddressBook } from "@/hooks/use-wallet-address-book";
import { describeEvent, type ChainEvent } from "@/lib/onchain-history";
import { formatTokenAmount, shortAddress } from "@/lib/send-stacks";
import { getExplorerTxUrl } from "@/lib/token-icons";
import { cn } from "@/lib/utils";

type AppRecord = { txHash: string | null; mode: string };
const MODE_LABEL: Record<string, string> = { P2P: "P2P trade", SELF: "Transfer", DEX: "DEX swap", LOCAL: "Local" };

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function WalletHistory({ className }: { className?: string }) {
  const chainId = useChainId();
  const chains = useChains();
  const connections = useConnections();
  const { getDisplayName } = useWalletAddressBook();
  const chain = chains.find((c) => c.id === chainId);
  const nativeSymbol = chain?.nativeCurrency.symbol ?? "ETH";

  const wallets = useMemo(() => {
    const seen = new Set<string>();
    return connections.flatMap((c) => c.accounts.map((a) => ({ address: a as string, wallet: c.connector.name })))
      .filter((w) => !seen.has(w.address.toLowerCase()) && seen.add(w.address.toLowerCase()));
  }, [connections]);

  const [selected, setSelected] = useState<string | "all">("all");
  const [events, setEvents] = useState<ChainEvent[]>([]);
  const [records, setRecords] = useState<Map<string, AppRecord>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);

  const targets = useMemo(() => (selected === "all" ? wallets : wallets.filter((w) => w.address.toLowerCase() === selected)), [selected, wallets]);
  const targetsKey = targets.map((w) => w.address.toLowerCase()).sort().join(",");
  const lastLoad = useRef<{ key: string; ts: number }>({ key: "", ts: 0 });

  const load = useCallback(async (force = false) => {
    if (!targets.length) { setEvents([]); return; }
    // wagmi republishes the connections while it settles; one load per wallet set per 15 s is enough.
    const key = `${chainId}:${targetsKey}`;
    if (!force && lastLoad.current.key === key && Date.now() - lastLoad.current.ts < 15_000) return;
    lastLoad.current = { key, ts: Date.now() };
    setLoading(true); setError(null);
    try {
      const results = await Promise.all(targets.map(async (w) => {
        const res = await fetch(`/api/wallets/evm/history?chainId=${chainId}&address=${w.address}`, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) throw new Error(`history ${res.status}`);
        return (await res.json()) as { events: ChainEvent[]; partial?: boolean };
      }));
      const merged = new Map<string, ChainEvent>();
      for (const r of results) for (const e of r.events) if (!merged.has(e.id + e.wallet)) merged.set(e.id + e.wallet, e);
      setEvents(Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp));
      setPartial(results.some((r) => r.partial));
    } catch (err) {
      setError(err instanceof Error && /429/.test(err.message) ? "Too many requests; try again in a minute." : "The explorer did not answer. Try again.");
    } finally { setLoading(false); }
  }, [targets, targetsKey, chainId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    // App records give rows their P2P / transfer / DEX badge.
    fetch("/api/trades/history?limit=100").then((r) => (r.ok ? r.json() : null)).then((data: { records?: AppRecord[] } | null) => {
      const map = new Map<string, AppRecord>();
      for (const rec of data?.records ?? []) if (rec.txHash) map.set(rec.txHash.toLowerCase(), rec);
      setRecords(map);
    }).catch(() => undefined);
  }, []);

  const walletLabel = (address: string) => { const name = getDisplayName(address); return name !== shortAddress(address) ? name : shortAddress(address); };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Wallets</span>
        <button type="button" onClick={() => setSelected("all")} aria-pressed={selected === "all"}
          className={cn("min-h-8 rounded-full border px-3 text-[11px] font-medium transition-[background-color,border-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected === "all" ? "border-brand-accent/40 bg-brand-accent/12 text-foreground" : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground")}>
          All connected ({wallets.length})
        </button>
        {wallets.map((w) => (
          <button key={w.address} type="button" onClick={() => setSelected(w.address.toLowerCase())} aria-pressed={selected === w.address.toLowerCase()} title={w.address}
            className={cn("min-h-8 rounded-full border px-3 text-[11px] font-medium transition-[background-color,border-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected === w.address.toLowerCase() ? "border-brand-accent/40 bg-brand-accent/12 text-foreground" : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground")}>
            <span className="font-mono">{shortAddress(w.address)}</span> <span className="opacity-70">{w.wallet}</span>
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          {chain?.name ?? `Chain ${chainId}`}
          <button type="button" onClick={() => void load(true)} aria-label="Refresh history" disabled={loading} className="grid size-8 place-items-center rounded-lg border border-border/60 text-muted-foreground transition-[background-color,color] duration-150 hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50">
            <FiRefreshCw className={cn("h-3.5 w-3.5", loading && "motion-safe:animate-spin")} />
          </button>
        </span>
      </div>

      {!wallets.length && <p className="rounded-xl border border-border/60 bg-foreground/[0.03] p-4 text-sm text-muted-foreground">Connect a wallet to see its on-chain history.</p>}
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">{error}</p>}
      {partial && !error && <p className="text-[11px] text-amber-700 dark:text-amber-300">The explorer answered only partly; some rows may be missing.</p>}
      {loading && !events.length && <div role="status" aria-label="Loading history" className="h-40 rounded-xl bg-foreground/[0.04] motion-safe:animate-pulse" />}
      {!loading && wallets.length > 0 && !events.length && !error && <p className="rounded-xl border border-border/60 bg-foreground/[0.03] p-4 text-sm text-muted-foreground">No activity found for {selected === "all" ? "these wallets" : "this wallet"} on {chain?.name ?? "this chain"}.</p>}

      {events.length > 0 && (
        <ol className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60 bg-card/60">
          {events.map((e) => {
            const rec = records.get(e.hash.toLowerCase());
            const scam = e.tokens.some((t) => t.isScam);
            const Icon = e.kind === "send" ? FiArrowUpRight : e.kind === "receive" ? FiArrowDownLeft : e.kind === "swap" ? FiRepeat : FiCode;
            const tone = e.status === "error" ? "text-red-600 dark:text-red-400" : e.kind === "receive" ? "text-brand-accent-hover dark:text-brand-accent-light" : e.kind === "send" ? "text-foreground" : "text-muted-foreground";
            const primaryToken = e.tokens[0];
            return (
              <li key={e.id + e.wallet} className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-foreground/[0.05]", tone)} aria-hidden="true">
                  {primaryToken ? <TokenIcon address={primaryToken.address} chainId={e.chainId} symbol={primaryToken.symbol} logo={primaryToken.logo ?? undefined} size={20} /> : <Icon className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className={cn("truncate font-semibold", tone)}>{describeEvent(e, nativeSymbol, formatTokenAmount)}</span>
                    {rec && <span className="rounded-md bg-brand-accent/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-brand-accent-hover dark:text-brand-accent-light">{MODE_LABEL[rec.mode] ?? rec.mode}</span>}
                    {scam && <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-300"><FiAlertTriangle className="h-2.5 w-2.5" aria-hidden="true" /> flagged token</span>}
                    {e.status === "error" && <span className="rounded-md bg-red-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">failed</span>}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {e.kind === "receive" ? "from" : e.kind === "send" ? "to" : "with"}{" "}
                    <span className="font-mono text-foreground/80">{e.counterparty ? (e.counterpartyName ?? shortAddress(e.counterparty)) : "—"}</span>
                    {targets.length > 1 && <> · <span className="font-mono">{walletLabel(e.wallet)}</span></>}
                    {e.feeWei && <> · fee {formatTokenAmount(e.feeWei, 18)} {nativeSymbol}</>}
                  </span>
                </span>
                <span className="shrink-0 text-right text-[11px] text-muted-foreground">
                  <span className="block">{timeAgo(e.timestamp)}</span>
                  <a href={getExplorerTxUrl(e.chainId, e.hash)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] underline-offset-2 hover:text-foreground hover:underline" aria-label={`Transaction ${e.hash} on the explorer`}>
                    {e.hash.slice(0, 8)}… <FiExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                  </a>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
