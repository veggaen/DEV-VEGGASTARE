"use client";

/**
 * @fileOverview  Order ticket for the paper terminal: buy/sell, market /
 *                limit / stop, USD or unit sizing with quick percentages, a
 *                fee estimate and a leverage control that is visibly spot-only
 *                until margin paper trading exists.
 * @stability     experimental
 */

import * as React from "react";
import type { Market } from "@/lib/market/symbols";
import { formatPrice } from "@/components/trading/chart/drawings";
import { cn } from "@/lib/utils";

export type TicketSide = "buy" | "sell";
export type TicketType = "market" | "limit" | "stop";
export type TicketOrder = { side: TicketSide; type: TicketType; amountUsd: number | null; units: number | null; triggerPrice: number | null; leverage: number };

const FEE = 0.003;

function parseNum(v: string): number { const n = Number(v.replace(/,/g, "")); return Number.isFinite(n) ? n : 0; }

export function OrderTicket({ market, price, cash, positionUnits, disabled = false, disabledReason, onSubmit, className }: {
  market: Market;
  price: number | null;
  cash: number;
  positionUnits: number;
  disabled?: boolean;
  disabledReason?: React.ReactNode;
  onSubmit: (order: TicketOrder) => Promise<boolean>;
  className?: string;
}) {
  const [side, setSide] = React.useState<TicketSide>("buy");
  const [type, setType] = React.useState<TicketType>("market");
  const [sizeIn, setSizeIn] = React.useState<"usd" | "units">("usd");
  const [amount, setAmount] = React.useState("");
  const [trigger, setTrigger] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [leverage, setLeverage] = React.useState(1);

  // Prefill the trigger with the live price when switching to limit/stop or market.
  React.useEffect(() => { if (type !== "market" && price && !trigger) setTrigger(formatPrice(price).replace(/,/g, "")); }, [type, price, trigger]);
  React.useEffect(() => { setTrigger(""); setAmount(""); }, [market.symbol]);

  const ref = type === "market" ? price : parseNum(trigger) || price;
  const n = parseNum(amount);
  const usd = sizeIn === "usd" ? n : ref ? n * ref : 0;
  const units = sizeIn === "units" ? n : ref ? n / ref : 0;
  const fee = usd * FEE;
  const max = side === "buy" ? cash : positionUnits;
  const maxLabel = side === "buy" ? `${cash.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD` : `${positionUnits.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${market.symbol}`;
  const tooMuch = side === "buy" ? usd > cash + 1e-9 : units > positionUnits + 1e-9;
  const valid = n > 0 && !tooMuch && !!ref && (type === "market" || parseNum(trigger) > 0);

  const pct = (p: number) => {
    if (side === "buy") { const v = cash * p; setSizeIn("usd"); setAmount(v > 0 ? (Math.floor(v * 100) / 100).toString() : ""); }
    else { const v = positionUnits * p; setSizeIn("units"); setAmount(v > 0 ? v.toString() : ""); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!valid || busy || disabled) return;
    setBusy(true);
    try {
      const ok = await onSubmit({ side, type, amountUsd: side === "buy" ? usd : null, units: side === "sell" ? units : null, triggerPrice: type === "market" ? null : parseNum(trigger), leverage });
      if (ok) setAmount("");
    } finally { setBusy(false); }
  };

  const sideBtn = (s: TicketSide, label: string) => (
    <button
      key={s}
      type="button"
      role="tab"
      aria-selected={side === s}
      onClick={() => { setSide(s); setAmount(""); }}
      className={cn(
        "min-h-10 flex-1 rounded-lg text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        side === s ? (s === "buy" ? "bg-chart-up text-white shadow-e1" : "bg-chart-down text-white shadow-e1") : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  const inputClass = "h-10 w-full rounded-lg border border-border/60 bg-foreground/[0.04] px-3 text-sm tabular-nums text-foreground transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground focus-visible:border-brand-accent/60 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_hsl(var(--brand-accent)/0.14)] disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-3", className)} aria-label="Order ticket">
      <div role="tablist" aria-label="Side" className="flex gap-1 rounded-xl border border-border/60 bg-foreground/[0.03] p-1">
        {sideBtn("buy", "Buy")}{sideBtn("sell", "Sell")}
      </div>

      <div role="tablist" aria-label="Order type" className="flex gap-0.5 rounded-lg bg-foreground/[0.04] p-0.5">
        {(["market", "limit", "stop"] as TicketType[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={type === t} onClick={() => setType(t)}
            className={cn("min-h-8 flex-1 rounded-md text-xs font-medium capitalize transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", type === t ? "bg-card text-foreground shadow-e1" : "text-muted-foreground hover:text-foreground")}>
            {t}
          </button>
        ))}
      </div>

      {type !== "market" && (
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{type === "limit" ? "Limit price" : "Stop price"} (USD)</span>
          <input type="text" inputMode="decimal" value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder={price ? formatPrice(price) : "0.00"} className={inputClass} disabled={disabled} />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {type === "limit"
              ? side === "buy" ? "Fills when the price drops to your limit or lower." : "Fills when the price rises to your limit or higher."
              : side === "buy" ? "Fills when the price rises through your stop." : "Fills when the price falls through your stop."}
          </span>
        </label>
      )}

      <label className="block">
        <span className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Amount
          <span className="inline-flex gap-0.5 rounded-md bg-foreground/[0.05] p-0.5 normal-case tracking-normal">
            {(["usd", "units"] as const).map((u) => (
              <button key={u} type="button" onClick={() => { setSizeIn(u); setAmount(""); }} aria-pressed={sizeIn === u}
                className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors", sizeIn === u ? "bg-card text-foreground shadow-e1" : "text-muted-foreground hover:text-foreground")}>
                {u === "usd" ? "USD" : market.symbol}
              </button>
            ))}
          </span>
        </span>
        <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" aria-invalid={tooMuch || undefined} className={cn(inputClass, tooMuch && "border-chart-down/60")} disabled={disabled} />
        <span className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Available {maxLabel}</span>
          {tooMuch && <span className="text-chart-down">Over your balance</span>}
        </span>
      </label>

      <div className="grid grid-cols-4 gap-1">
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <button key={p} type="button" onClick={() => pct(p)} disabled={disabled || max <= 0}
            className="min-h-8 rounded-md border border-border/60 text-[11px] font-medium text-muted-foreground transition-[background-color,color,border-color] duration-150 hover:border-brand-accent/40 hover:bg-foreground/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
            {p * 100}%
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border/60 bg-foreground/[0.03] p-2.5">
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="font-medium uppercase tracking-[0.14em] text-muted-foreground">Leverage</span>
          <span className="tabular-nums text-muted-foreground">{leverage}×</span>
        </div>
        <input type="range" min={1} max={20} step={1} value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} disabled aria-label="Leverage (spot only for now)" className="w-full accent-[hsl(var(--brand-accent))] disabled:opacity-40" />
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">Spot only for now. Margin paper trading with liquidation arrives later; the slider is here so you know where it will live.</p>
      </div>

      <dl className="space-y-1 text-[12px] tabular-nums">
        <div className="flex justify-between"><dt className="text-muted-foreground">{type === "market" ? "Est. price" : "Trigger"}</dt><dd className="text-foreground">{ref ? `$${formatPrice(ref)}` : "—"}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">{side === "buy" ? "You get" : "You receive"}</dt><dd className="text-foreground">{side === "buy" ? `${units ? units.toLocaleString(undefined, { maximumSignificantDigits: 6 }) : "0"} ${market.symbol}` : `$${usd ? formatPrice(usd) : "0.00"}`}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Fee (0.3%)</dt><dd className="text-muted-foreground">≈ ${fee.toFixed(2)}</dd></div>
      </dl>

      {disabled && disabledReason ? (
        <p className="rounded-lg border border-border/60 bg-foreground/[0.03] p-3 text-xs leading-relaxed text-muted-foreground">{disabledReason}</p>
      ) : (
        <button type="submit" disabled={!valid || busy || disabled}
          className={cn("min-h-11 rounded-xl text-sm font-semibold text-white shadow-e2 transition-[background-color,transform,box-shadow,opacity] duration-200 motion-safe:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40 disabled:shadow-none motion-safe:disabled:hover:translate-y-0",
            side === "buy" ? "bg-chart-up hover:brightness-110" : "bg-chart-down hover:brightness-110")}>
          {busy ? "Placing…" : `${type === "market" ? "" : type === "limit" ? "Limit " : "Stop "}${side === "buy" ? "Buy" : "Sell"} ${market.symbol}`}
        </button>
      )}
    </form>
  );
}
