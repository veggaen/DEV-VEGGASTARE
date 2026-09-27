"use client";

/**
 * @fileOverview  Bottom panels of the paper terminal: positions (with one-click
 *                close), open/recent orders (cancel) and the saved history.
 * @stability     experimental
 */

import * as React from "react";
import type { PaperPortfolioSnapshot } from "@/lib/paper/read";
import type { PaperOrderRow } from "@/actions/paper-orders";
import { PaperTradeHistory } from "@/components/crypto-related/PaperTradeHistory";
import { formatPrice } from "@/components/trading/chart/drawings";
import { cn } from "@/lib/utils";

type Tab = "positions" | "orders" | "history";

function Pnl({ value, pct }: { value: number | null; pct?: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const up = value >= 0;
  return <span className={cn("tabular-nums", up ? "text-chart-up" : "text-chart-down")}>{up ? "+" : "−"}${formatPrice(Math.abs(value))}{pct != null && <span className="ml-1 text-[11px] opacity-80">({up ? "+" : ""}{pct.toFixed(2)}%)</span>}</span>;
}

export function TerminalPanels({ portfolio, orders, ordersLoading, onSelectSymbol, onClosePosition, onCancelOrder, className }: {
  portfolio: PaperPortfolioSnapshot | null;
  orders: PaperOrderRow[];
  ordersLoading: boolean;
  onSelectSymbol: (symbol: string) => void;
  onClosePosition: (symbol: string, units: number) => Promise<void>;
  onCancelOrder: (id: string) => Promise<void>;
  className?: string;
}) {
  const [tab, setTab] = React.useState<Tab>("positions");
  const [busy, setBusy] = React.useState<string | null>(null);
  const positions = portfolio?.positions ?? [];
  const open = orders.filter((o) => o.status === "OPEN");
  const done = orders.filter((o) => o.status !== "OPEN").slice(0, 20);

  const tabs: Array<[Tab, string, number | null]> = [["positions", "Positions", positions.length], ["orders", "Orders", open.length], ["history", "History", null]];
  const th = "px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground";
  const td = "px-3 py-2 text-[13px] tabular-nums";

  return (
    <section aria-label="Portfolio panels" className={cn("flex min-h-0 flex-col", className)}>
      <div role="tablist" aria-label="Panels" className="flex shrink-0 items-center gap-0.5 border-b border-border/60 px-2">
        {tabs.map(([id, label, count]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={cn("relative min-h-10 px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === id ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {label}{count != null && count > 0 && <span className="ml-1.5 rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground">{count}</span>}
            {tab === id && <span aria-hidden="true" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-accent" />}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "positions" && (
          positions.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No open positions. Buy something from the ticket to see it here.</p> : (
            <table className="w-full min-w-[640px] border-collapse">
              <thead><tr className="border-b border-border/60"><th className={th}>Market</th><th className={th}>Units</th><th className={th}>Avg entry</th><th className={th}>Price</th><th className={th}>Value</th><th className={th}>P&amp;L</th><th className={th}></th></tr></thead>
              <tbody>
                {positions.map((p) => {
                  const units = Number(p.displayAmount);
                  return (
                    <tr key={`${p.tokenSymbol}-${p.chainId}`} className="border-b border-border/40 transition-colors hover:bg-foreground/[0.03]">
                      <td className={td}><button type="button" onClick={() => onSelectSymbol(p.tokenSymbol)} className="font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{p.tokenSymbol}</button></td>
                      <td className={td}>{units.toLocaleString(undefined, { maximumSignificantDigits: 8 })}</td>
                      <td className={td}>${formatPrice(p.avgEntryPrice)}</td>
                      <td className={td}>{p.currentPriceUsd != null ? `$${formatPrice(p.currentPriceUsd)}` : "—"}</td>
                      <td className={td}>{p.valueUsd != null ? `$${formatPrice(p.valueUsd)}` : "—"}</td>
                      <td className={td}><Pnl value={p.pnlUsd} pct={p.pnlPercent} /></td>
                      <td className={cn(td, "text-right")}>
                        <button type="button" disabled={busy === p.tokenSymbol || units <= 0} onClick={async () => { setBusy(p.tokenSymbol); try { await onClosePosition(p.tokenSymbol, units); } finally { setBusy(null); } }}
                          className="min-h-8 rounded-md border border-border/60 px-2.5 text-xs font-medium text-muted-foreground transition-[background-color,color,border-color] duration-150 hover:border-chart-down/50 hover:bg-chart-down/10 hover:text-chart-down focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
                          {busy === p.tokenSymbol ? "Closing…" : "Close"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}
        {tab === "orders" && (
          ordersLoading && !orders.length ? <p role="status" className="p-6 text-center text-sm text-muted-foreground">Loading orders…</p>
          : !orders.length ? <p className="p-6 text-center text-sm text-muted-foreground">No orders yet. Limit and stop orders you place rest here until the price crosses them.</p> : (
            <table className="w-full min-w-[640px] border-collapse">
              <thead><tr className="border-b border-border/60"><th className={th}>Placed</th><th className={th}>Market</th><th className={th}>Side</th><th className={th}>Type</th><th className={th}>Trigger</th><th className={th}>Amount</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {[...open, ...done].map((o) => (
                  <tr key={o.id} className="border-b border-border/40 transition-colors hover:bg-foreground/[0.03]">
                    <td className={cn(td, "text-muted-foreground")}>{new Date(o.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className={cn(td, "font-semibold")}>{o.tokenSymbol}</td>
                    <td className={cn(td, o.side === "BUY" ? "text-chart-up" : "text-chart-down")}>{o.side === "BUY" ? "Buy" : "Sell"}</td>
                    <td className={cn(td, "capitalize")}>{o.type.toLowerCase()}</td>
                    <td className={td}>${formatPrice(o.triggerPrice)}</td>
                    <td className={td}>{o.side === "BUY" ? `$${formatPrice(o.amount)}` : `${o.amount.toLocaleString(undefined, { maximumSignificantDigits: 8 })} ${o.tokenSymbol}`}</td>
                    <td className={td}>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", o.status === "OPEN" ? "bg-brand-accent/12 text-brand-accent-hover dark:text-brand-accent-light" : o.status === "FILLED" ? "bg-chart-up/12 text-chart-up" : o.status === "FAILED" ? "bg-chart-down/12 text-chart-down" : "bg-foreground/[0.06] text-muted-foreground")}>
                        {o.status === "FILLED" && o.filledPriceUsd ? `Filled @ $${formatPrice(o.filledPriceUsd)}` : o.status === "FAILED" ? `Failed${o.failReason ? ` · ${o.failReason}` : ""}` : o.status.charAt(0) + o.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className={cn(td, "text-right")}>
                      {o.status === "OPEN" && (
                        <button type="button" disabled={busy === o.id} onClick={async () => { setBusy(o.id); try { await onCancelOrder(o.id); } finally { setBusy(null); } }}
                          className="min-h-8 rounded-md border border-border/60 px-2.5 text-xs font-medium text-muted-foreground transition-[background-color,color,border-color] duration-150 hover:border-border hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
                          {busy === o.id ? "Cancelling…" : "Cancel"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
        {tab === "history" && <div className="p-2"><PaperTradeHistory /></div>}
      </div>
    </section>
  );
}
