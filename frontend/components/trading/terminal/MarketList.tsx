"use client";

/**
 * @fileOverview  Market list for the paper terminal: searchable symbols with
 *                last price and 24h change, the selected one highlighted.
 * @stability     experimental
 */

import * as React from "react";
import { FiSearch } from "react-icons/fi";
import { CHARTABLE_MARKETS, type Market, type Ticker } from "@/lib/market/symbols";
import { formatPrice } from "@/components/trading/chart/drawings";
import { cn } from "@/lib/utils";

export function MarketList({ selected, tickers, onSelect, className }: { selected: string; tickers: Map<string, Ticker>; onSelect: (m: Market) => void; className?: string }) {
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const rows = CHARTABLE_MARKETS.filter((m) => !q || m.symbol.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <label className="relative block shrink-0 p-2">
        <FiSearch aria-hidden="true" className="pointer-events-none absolute left-4.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search markets"
          aria-label="Search markets"
          className="h-9 w-full rounded-lg border border-border/60 bg-foreground/[0.04] pl-8 pr-2 text-[13px] text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-200 focus-visible:border-brand-accent/60 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_hsl(var(--brand-accent)/0.14)] [&::-webkit-search-cancel-button]:appearance-none"
        />
      </label>
      <ul role="listbox" aria-label="Markets" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-2">
        {rows.map((m) => {
          const t = tickers.get(m.symbol); const active = m.symbol === selected;
          const up = (t?.change24h ?? 0) >= 0;
          return (
            <li key={m.symbol} role="option" aria-selected={active}>
              <button
                type="button"
                onClick={() => onSelect(m)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-brand-accent/10 text-foreground ring-1 ring-inset ring-brand-accent/30" : "text-foreground/90 hover:bg-foreground/[0.05]",
                )}
              >
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold leading-tight">{m.symbol}</span>
                  <span className="block truncate text-[11px] leading-tight text-muted-foreground">{m.name}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[12px] font-medium tabular-nums leading-tight">{t ? formatPrice(t.price) : "—"}</span>
                  <span className={cn("block text-[11px] tabular-nums leading-tight", t ? (up ? "text-chart-up" : "text-chart-down") : "text-muted-foreground")}>
                    {t ? `${up ? "+" : ""}${t.change24h.toFixed(2)}%` : "…"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {!rows.length && <li className="px-3 py-6 text-center text-xs text-muted-foreground">No market matches “{query}”.</li>}
      </ul>
    </div>
  );
}
