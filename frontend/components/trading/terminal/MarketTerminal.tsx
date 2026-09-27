"use client";

/**
 * @fileOverview  MarketTerminal — the paper trading workspace: market list,
 *                candlestick chart with drawing tools, order ticket (market /
 *                limit / stop) and portfolio panels, in one screen. Replaces
 *                the old "info → next → start" flow: the chart is live for
 *                everyone, and a signed-in user starts a portfolio in one click
 *                right next to it.
 * @stability     experimental
 */

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChartArea, ChartCandlestick, ChartLine, ChevronDown, Layers, Maximize2, Minimize2, Minus, MousePointer2, MoveUpRight, RefreshCw, RotateCcw, Square, Trash2, TrendingUp,
} from "lucide-react";
import { useCurrentUserWithStatus } from "@/hooks/use-current-user";
import { isDemoUserId } from "@/lib/demo-policy";
import { useConfirm } from "@/components/providers/confirm-dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HeaderTip } from "@/components/uicustom/chrome/header-tip";
import { CHARTABLE_MARKETS, INTERVALS, marketBySymbol, type Interval, type Market } from "@/lib/market/symbols";
import { useCandles, useTickers } from "@/hooks/use-market-data";
import { CandleChart, type ChartType } from "@/components/trading/chart/CandleChart";
import { TOOLS, formatCompact, formatPrice, loadDrawings, saveDrawings, type Drawing, type DrawingTool } from "@/components/trading/chart/drawings";
import { MarketList } from "./MarketList";
import { OrderTicket, type TicketOrder } from "./OrderTicket";
import { TerminalPanels } from "./TerminalPanels";
import { createPaperPortfolio, getPaperPortfolio, paperBuy, paperSell, resetPaperPortfolio } from "@/actions/paper-trade";
import { cancelPaperOrder, listPaperOrders, placePaperOrder, settlePaperOrders, type PaperOrderRow } from "@/actions/paper-orders";
import type { PaperPortfolioSnapshot } from "@/lib/paper/read";
import { cn } from "@/lib/utils";

const SYMBOL_KEY = "veggat:terminal:symbol";
const INTERVAL_KEY = "veggat:terminal:interval";
const TOOL_ICONS: Record<DrawingTool, React.ComponentType<{ className?: string }>> = { cursor: MousePointer2, trend: TrendingUp, ray: MoveUpRight, hline: Minus, rect: Square, fib: Layers };

function readStored<T extends string>(key: string, valid: (v: string) => v is T, fallback: T): T {
  try { const v = localStorage.getItem(key); return v && valid(v) ? v : fallback; } catch { return fallback; }
}

const iconBtn = "grid size-8 place-items-center rounded-lg text-muted-foreground transition-[background-color,color] duration-150 hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";
const iconBtnActive = "bg-brand-accent/12 text-brand-accent-hover ring-1 ring-inset ring-brand-accent/30 dark:text-brand-accent-light";

export function MarketTerminal({ className }: { className?: string }) {
  const { user, status } = useCurrentUserWithStatus();
  const confirm = useConfirm();
  const isDemo = isDemoUserId(user?.id);
  const canTrade = status === "authenticated" && !!user?.id && !isDemo;

  // ── Market + chart state ─────────────────────────────────────────────────
  const [symbol, setSymbol] = React.useState<string>("BTC");
  const [interval, setInterval_] = React.useState<Interval>("1h");
  const [chartType, setChartType] = React.useState<ChartType>("candles");
  const [tool, setTool] = React.useState<DrawingTool>("cursor");
  const [drawings, setDrawings] = React.useState<Drawing[]>([]);
  const [listOpen, setListOpen] = React.useState(false);
  const [full, setFull] = React.useState(false);
  const hydrated = React.useRef(false);

  React.useEffect(() => {
    // Restore the last market/timeframe once, after mount (localStorage is client-only).
    const s = readStored(SYMBOL_KEY, (v): v is string => Boolean(marketBySymbol(v)), "BTC");
    const i = readStored(INTERVAL_KEY, (v): v is Interval => (INTERVALS as readonly string[]).includes(v), "1h");
    setSymbol(s); setInterval_(i); setDrawings(loadDrawings(s)); hydrated.current = true;
  }, []);
  React.useEffect(() => { if (hydrated.current) { try { localStorage.setItem(SYMBOL_KEY, symbol); localStorage.setItem(INTERVAL_KEY, interval); } catch { /* optional */ } } }, [symbol, interval]);

  const market: Market = marketBySymbol(symbol) ?? CHARTABLE_MARKETS[0];
  const { tickers } = useTickers(React.useMemo(() => CHARTABLE_MARKETS.map((m) => m.symbol), []));
  const ticker = tickers.get(market.symbol);
  const { candles, data: candleData, loading: candlesLoading, error: candlesError, refresh: refreshCandles } = useCandles(market.symbol, interval);
  const livePrice = ticker?.price ?? candles[candles.length - 1]?.c ?? null;

  const selectMarket = React.useCallback((m: Market) => {
    setSymbol(m.symbol); setDrawings(loadDrawings(m.symbol)); setTool("cursor"); setListOpen(false);
  }, []);
  const updateDrawings = React.useCallback((next: Drawing[]) => { setDrawings(next); saveDrawings(market.symbol, next); }, [market.symbol]);

  // ── Portfolio + orders ───────────────────────────────────────────────────
  const [portfolio, setPortfolio] = React.useState<PaperPortfolioSnapshot | null>(null);
  const [portfolioState, setPortfolioState] = React.useState<"loading" | "ready" | "none" | "error">("loading");
  const [orders, setOrders] = React.useState<PaperOrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [startBalance, setStartBalance] = React.useState("100000");
  const seq = React.useRef(0);

  const refreshPortfolio = React.useCallback(async () => {
    if (!canTrade) { setPortfolioState("none"); setPortfolio(null); return; }
    const id = ++seq.current;
    try {
      const result = await getPaperPortfolio();
      if (id !== seq.current) return;
      if (result.success) { setPortfolio(result.data); setPortfolioState("ready"); }
      else if (result.code === "NOT_FOUND") { setPortfolio(null); setPortfolioState("none"); }
      else { setPortfolioState("error"); }
    } catch { if (id === seq.current) setPortfolioState("error"); }
  }, [canTrade]);

  const refreshOrders = React.useCallback(async () => {
    if (!canTrade) { setOrders([]); return; }
    setOrdersLoading(true);
    try { const r = await listPaperOrders(); if (r.success) setOrders(r.data); } finally { setOrdersLoading(false); }
  }, [canTrade]);

  const settle = React.useCallback(async () => {
    if (!canTrade) return;
    try {
      const r = await settlePaperOrders();
      if (r.success && (r.data.filled || r.data.failed)) {
        if (r.data.filled) toast.success(`${r.data.filled} resting order${r.data.filled === 1 ? "" : "s"} filled`);
        await Promise.all([refreshPortfolio(), refreshOrders()]);
      }
    } catch { /* next poll */ }
  }, [canTrade, refreshPortfolio, refreshOrders]);

  React.useEffect(() => { if (status === "loading") return; void refreshPortfolio(); void refreshOrders(); }, [status, refreshPortfolio, refreshOrders]);
  React.useEffect(() => {
    if (!canTrade || portfolioState !== "ready") return;
    void settle();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void settle(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [canTrade, portfolioState, settle]);

  const startPortfolio = async () => {
    const balance = Number(startBalance);
    if (!Number.isFinite(balance) || balance < 1000 || balance > 10_000_000) { toast.error("Starting balance must be between $1,000 and $10,000,000"); return; }
    setBusy(true);
    try {
      const r = await createPaperPortfolio({ startingBalance: balance });
      if (!r.success) { toast.error(r.error); return; }
      toast.success(`Paper account opened with $${balance.toLocaleString()}`);
      await refreshPortfolio();
    } finally { setBusy(false); }
  };

  const resetPortfolio = async () => {
    if (!(await confirm({ title: "Reset paper portfolio?", description: "Positions are cleared and the starting balance restored. Your history is kept, with a reset entry. Resets are limited.", confirmLabel: "Reset portfolio", destructive: true }))) return;
    setBusy(true);
    try { const r = await resetPaperPortfolio(); if (r.success) { toast.success("Portfolio reset"); await Promise.all([refreshPortfolio(), refreshOrders()]); } else toast.error(r.error); } finally { setBusy(false); }
  };

  const submitOrder = async (o: TicketOrder): Promise<boolean> => {
    if (!canTrade) return false;
    try {
      if (o.type === "market") {
        if (o.side === "buy") {
          const r = await paperBuy({ tokenSymbol: market.symbol, tokenAddress: market.address, chainId: market.chainId, decimals: Math.min(18, market.decimals), usdAmount: o.amountUsd ?? 0 });
          if (!r.success) { toast.error(r.error); return false; }
          toast.success(`Bought ${r.data.tokenAmount} ${market.symbol} @ $${formatPrice(r.data.priceUsd)}`);
        } else {
          const r = await paperSell({ tokenSymbol: market.symbol, chainId: market.chainId, tokenAmount: o.units ?? 0 });
          if (!r.success) { toast.error(r.error); return false; }
          toast.success(`Sold for $${formatPrice(r.data.usdReceived)} @ $${formatPrice(r.data.priceUsd)}`);
        }
        await refreshPortfolio();
        return true;
      }
      const r = await placePaperOrder({ side: o.side === "buy" ? "BUY" : "SELL", type: o.type === "limit" ? "LIMIT" : "STOP", tokenSymbol: market.symbol, tokenAddress: market.address, chainId: market.chainId, decimals: Math.min(18, market.decimals), amount: o.side === "buy" ? (o.amountUsd ?? 0) : (o.units ?? 0), triggerPrice: o.triggerPrice ?? 0, leverage: o.leverage });
      if (!r.success) { toast.error(r.error); return false; }
      toast.success(`${o.type === "limit" ? "Limit" : "Stop"} ${o.side} placed at $${formatPrice(o.triggerPrice ?? 0)}`);
      await refreshOrders(); void settle();
      return true;
    } catch { toast.error("Trade failed. Try again."); return false; }
  };

  const closePosition = async (sym: string, units: number) => {
    const m = marketBySymbol(sym);
    const r = await paperSell({ tokenSymbol: sym, chainId: m?.chainId ?? 1, tokenAmount: units });
    if (!r.success) { toast.error(r.error); return; }
    toast.success(`Closed ${sym} for $${formatPrice(r.data.usdReceived)}`);
    await refreshPortfolio();
  };
  const cancelOrder = async (id: string) => { const r = await cancelPaperOrder(id); if (!r.success) toast.error(r.error); else await refreshOrders(); };

  const positionUnits = Number(portfolio?.positions.find((p) => p.tokenSymbol === market.symbol)?.displayAmount ?? 0);
  const cash = portfolio?.portfolio.cashBalance ?? 0;
  const change = ticker?.change24h ?? 0; const up = change >= 0;

  // ── Render ───────────────────────────────────────────────────────────────
  const marketButton = (
    <button type="button" className="group flex min-h-10 items-center gap-2 rounded-xl px-2 text-left transition-colors hover:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Change market, currently ${market.name}`}>
      <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: market.color }} />
      <span className="text-base font-semibold tracking-tight text-foreground">{market.symbol}<span className="ml-1 text-sm font-normal text-muted-foreground">/ USD</span></span>
      <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-aria-expanded:rotate-180 lg:hidden" />
    </button>
  );

  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={200}>
      <div className={cn("flex flex-col overflow-hidden border border-border/60 bg-card/70 shadow-e1 backdrop-blur-xl", full ? "fixed inset-0 z-[90] rounded-none" : "min-h-[720px] rounded-2xl lg:h-[calc(100dvh-var(--app-header-offset,72px)-6rem)]", className)}>
        {/* ── Header ───────────────────────────────────────── */}
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Sheet open={listOpen} onOpenChange={setListOpen}>
              <SheetTrigger asChild className="lg:pointer-events-none">{marketButton}</SheetTrigger>
              <SheetContent side="left" accessibleTitle="Markets" accessibleDescription="Pick a market to chart and trade." className="w-[300px] p-0 sm:max-w-[300px]">
                <div className="border-b border-border/60 px-4 py-3 text-sm font-semibold">Markets</div>
                <MarketList selected={market.symbol} tickers={tickers} onSelect={selectMarket} className="h-[calc(100%-49px)]" />
              </SheetContent>
            </Sheet>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold tabular-nums tracking-tight text-foreground">{livePrice ? `$${formatPrice(livePrice)}` : "—"}</span>
              {ticker && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums", up ? "bg-chart-up/12 text-chart-up" : "bg-chart-down/12 text-chart-down")}>{up ? "+" : ""}{change.toFixed(2)}%</span>}
            </div>
            {ticker && ticker.high24h != null && (
              <dl className="hidden items-center gap-3 text-[11px] tabular-nums text-muted-foreground 2xl:flex">
                <div className="flex gap-1"><dt>24h H</dt><dd className="text-foreground">{formatPrice(ticker.high24h)}</dd></div>
                <div className="flex gap-1"><dt>L</dt><dd className="text-foreground">{formatPrice(ticker.low24h ?? 0)}</dd></div>
                {ticker.volume24h != null && <div className="flex gap-1"><dt>Vol</dt><dd className="text-foreground">${formatCompact(ticker.volume24h)}</dd></div>}
              </dl>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:ml-2">
            <div role="tablist" aria-label="Timeframe" className="flex items-center gap-0.5 rounded-lg bg-foreground/[0.04] p-0.5">
              {INTERVALS.map((iv) => (
                <button key={iv} type="button" role="tab" aria-selected={interval === iv} onClick={() => setInterval_(iv)}
                  className={cn("min-h-7 min-w-8 rounded-md px-1.5 text-[11px] font-semibold uppercase transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", interval === iv ? "bg-card text-foreground shadow-e1" : "text-muted-foreground hover:text-foreground")}>
                  {iv}
                </button>
              ))}
            </div>
            <div role="tablist" aria-label="Chart type" className="flex items-center gap-0.5 rounded-lg bg-foreground/[0.04] p-0.5">
              {([["candles", ChartCandlestick, "Candles"], ["line", ChartLine, "Line"], ["area", ChartArea, "Area"]] as const).map(([id, Icon, label]) => (
                <HeaderTip key={id} label={label}>
                  <button type="button" role="tab" aria-selected={chartType === id} aria-label={label} onClick={() => setChartType(id)} className={cn(iconBtn, "size-7", chartType === id && "bg-card text-foreground shadow-e1 hover:bg-card")}><Icon className="size-4" /></button>
                </HeaderTip>
              ))}
            </div>
            <div role="toolbar" aria-label="Drawing tools" className="flex items-center gap-0.5 rounded-lg bg-foreground/[0.04] p-0.5">
              {TOOLS.map((t) => { const Icon = TOOL_ICONS[t.id]; return (
                <HeaderTip key={t.id} label={`${t.label} · ${t.hint}`}>
                  <button type="button" aria-label={t.label} aria-pressed={tool === t.id} onClick={() => setTool(t.id)} className={cn(iconBtn, "size-7", tool === t.id && iconBtnActive)}><Icon className="size-4" /></button>
                </HeaderTip>
              ); })}
              <HeaderTip label="Remove all drawings on this market">
                <button type="button" aria-label="Clear drawings" disabled={!drawings.length} onClick={() => updateDrawings([])} className={cn(iconBtn, "size-7 hover:text-chart-down")}><Trash2 className="size-4" /></button>
              </HeaderTip>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {portfolio && (
              <dl className="hidden items-center gap-4 text-[11px] tabular-nums md:flex">
                <div><dt className="text-muted-foreground">Value</dt><dd className="font-semibold text-foreground">{portfolio.totalValueUsd != null ? `$${formatPrice(portfolio.totalValueUsd)}` : "—"}</dd></div>
                <div><dt className="text-muted-foreground">Cash</dt><dd className="font-semibold text-foreground">${formatPrice(cash)}</dd></div>
                <div><dt className="text-muted-foreground">P&amp;L</dt><dd className={cn("font-semibold", portfolio.totalPnlUsd == null ? "text-muted-foreground" : portfolio.totalPnlUsd >= 0 ? "text-chart-up" : "text-chart-down")}>{portfolio.totalPnlUsd == null ? "—" : `${portfolio.totalPnlUsd >= 0 ? "+" : "−"}$${formatPrice(Math.abs(portfolio.totalPnlUsd))}`}{portfolio.totalPnlPercent != null && <span className="ml-1 opacity-80">({portfolio.totalPnlPercent >= 0 ? "+" : ""}{portfolio.totalPnlPercent.toFixed(2)}%)</span>}</dd></div>
              </dl>
            )}
            <span className="hidden rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 sm:inline dark:text-amber-300">Paper</span>
            <HeaderTip label="Refresh prices and portfolio"><button type="button" aria-label="Refresh" onClick={() => { void refreshCandles(); void refreshPortfolio(); void refreshOrders(); }} className={iconBtn}><RefreshCw className={cn("size-4", candlesLoading && "motion-safe:animate-spin")} /></button></HeaderTip>
            {portfolio && <HeaderTip label="Reset paper portfolio"><button type="button" aria-label="Reset paper portfolio" disabled={busy} onClick={() => void resetPortfolio()} className={iconBtn}><RotateCcw className="size-4" /></button></HeaderTip>}
            <HeaderTip label={full ? "Exit full screen" : "Full screen"}><button type="button" aria-label={full ? "Exit full screen" : "Full screen"} onClick={() => setFull((f) => !f)} className={iconBtn}>{full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</button></HeaderTip>
          </div>
        </header>

        {/* ── Body ─────────────────────────────────────────── */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[232px_minmax(0,1fr)_300px]">
          <aside className="hidden min-h-0 border-r border-border/60 lg:flex lg:flex-col" aria-label="Market list">
            <MarketList selected={market.symbol} tickers={tickers} onSelect={selectMarket} className="min-h-0 flex-1" />
          </aside>

          <div className="flex min-h-0 flex-col">
            <div className="relative min-h-[360px] flex-1 lg:min-h-0">
              <CandleChart candles={candles} interval={interval} chartType={chartType} tool={tool} onToolDone={() => setTool("cursor")} drawings={drawings} onDrawingsChange={updateDrawings} fitKey={market.symbol} className="absolute inset-0" />
              {candlesLoading && !candles.length && <div role="status" className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Loading {market.symbol} candles…</div>}
              {candlesError && !candles.length && <div role="alert" className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">Candles are unavailable right now. <button type="button" onClick={() => void refreshCandles()} className="ml-1 underline underline-offset-4 hover:text-foreground">Try again</button></div>}
              {candleData?.approximate && <p className="pointer-events-none absolute bottom-8 left-3 rounded-md bg-card/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">Approximate bars from CoinGecko for this market and timeframe.</p>}
            </div>
            <TerminalPanels portfolio={portfolio} orders={orders} ordersLoading={ordersLoading} onSelectSymbol={(s) => { const m = marketBySymbol(s); if (m) selectMarket(m); }} onClosePosition={closePosition} onCancelOrder={cancelOrder} className="h-[240px] shrink-0 border-t border-border/60" />
          </div>

          <aside className="min-h-0 overflow-y-auto border-t border-border/60 p-3 lg:border-l lg:border-t-0" aria-label="Order ticket">
            {status === "loading" || portfolioState === "loading" ? (
              <div role="status" aria-label="Loading account" className="h-64 rounded-xl bg-foreground/[0.04] motion-safe:animate-pulse" />
            ) : !user?.id ? (
              <div className="rounded-xl border border-border/60 bg-foreground/[0.03] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-accent-hover dark:text-brand-accent-light">Paper trading</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">Trade with virtual money</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Real prices, no risk. Sign in to open a paper account with up to $10M of practice cash. Your positions and history are saved.</p>
                <Link href="/auth/login?callbackUrl=%2Fdashboard%2Ftrading" className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-brand-accent px-5 text-sm font-semibold text-brand-accent-foreground shadow-e2 transition-[background-color,transform] duration-200 hover:bg-brand-accent-hover motion-safe:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Sign in to start</Link>
              </div>
            ) : isDemo ? (
              <OrderTicket market={market} price={livePrice} cash={0} positionUnits={0} disabled disabledReason="The demo account is read-only, so the ticket is disabled here. Sign in with your own account to open a paper portfolio and place orders." onSubmit={async () => false} />
            ) : portfolioState === "none" ? (
              <div className="rounded-xl border border-border/60 bg-foreground/[0.03] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-accent-hover dark:text-brand-accent-light">Paper trading</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">Open your paper account</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Pick a starting balance. Trades use live prices with a simulated 0.3% fee, and everything is saved to your account.</p>
                <div className="mt-4 grid grid-cols-3 gap-1.5">
                  {["10000", "100000", "1000000"].map((v) => (
                    <button key={v} type="button" onClick={() => setStartBalance(v)} aria-pressed={startBalance === v}
                      className={cn("min-h-9 rounded-lg border text-xs font-semibold tabular-nums transition-[background-color,border-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", startBalance === v ? "border-brand-accent/40 bg-brand-accent/12 text-foreground" : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground")}>
                      ${Number(v).toLocaleString()}
                    </button>
                  ))}
                </div>
                <label className="mt-2 block">
                  <span className="sr-only">Custom starting balance</span>
                  <input type="text" inputMode="numeric" value={startBalance} onChange={(e) => setStartBalance(e.target.value.replace(/[^0-9]/g, ""))} className="h-10 w-full rounded-lg border border-border/60 bg-foreground/[0.04] px-3 text-sm tabular-nums text-foreground focus-visible:border-brand-accent/60 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_hsl(var(--brand-accent)/0.14)]" />
                </label>
                <button type="button" disabled={busy} onClick={() => void startPortfolio()} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-brand-accent px-5 text-sm font-semibold text-brand-accent-foreground shadow-e2 transition-[background-color,transform,opacity] duration-200 hover:bg-brand-accent-hover motion-safe:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                  {busy ? "Opening…" : `Start with $${Number(startBalance || 0).toLocaleString()}`}
                </button>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Prices from Binance and CoinGecko · Up to 200 trades a day · Resets are limited.</p>
              </div>
            ) : portfolioState === "error" ? (
              <div role="alert" className="rounded-xl border border-border/60 bg-foreground/[0.03] p-4 text-sm text-muted-foreground">Your paper account could not be loaded. <button type="button" onClick={() => void refreshPortfolio()} className="underline underline-offset-4 hover:text-foreground">Try again</button></div>
            ) : (
              <OrderTicket market={market} price={livePrice} cash={cash} positionUnits={positionUnits} onSubmit={submitOrder} />
            )}
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default MarketTerminal;
