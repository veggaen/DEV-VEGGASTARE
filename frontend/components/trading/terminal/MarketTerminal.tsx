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
  Activity, ChartArea, ChartCandlestick, ChartLine, ChevronDown, Crosshair, GitCompare, Layers, Maximize2, Minimize2, Minus, MousePointer2, MoveHorizontal, MoveUpRight, RefreshCw, RotateCcw, SeparatorVertical, Square, Trash2, TrendingUp, X,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { INDICATOR_CATALOGUE, defaultIndicator, indicatorLabel, loadIndicators, saveIndicators, type IndicatorConfig } from "@/components/trading/chart/indicators";
import { useCurrentUserWithStatus } from "@/hooks/use-current-user";
import { useAccount } from "wagmi";
import { useActiveWalletOverride } from "@/contexts/active-wallet-context";
import { DexSwapPanel } from "@/components/crypto-related/DexSwapPanel";
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
const TRADE_MODE_KEY = "veggat:terminal:tradeMode";
type TerminalTradeMode = "paper" | "live";
const INTERVAL_KEY = "veggat:terminal:interval";
const TOOL_ICONS: Record<DrawingTool, React.ComponentType<{ className?: string }>> = { cursor: MousePointer2, trend: TrendingUp, ray: MoveUpRight, extended: MoveHorizontal, hline: Minus, vline: SeparatorVertical, crossline: Crosshair, rect: Square, fib: Layers };
const menuContent = "z-[120] min-w-60 rounded-xl border-border/70 bg-popover/95 p-1 shadow-e3 backdrop-blur-xl";
const menuItem = "min-h-9 gap-2 rounded-lg px-2.5 text-xs";

function readStored<T extends string>(key: string, valid: (v: string) => v is T, fallback: T): T {
  try { const v = localStorage.getItem(key); return v && valid(v) ? v : fallback; } catch { return fallback; }
}

const iconBtn = "grid size-8 place-items-center rounded-lg text-muted-foreground transition-[background-color,color] duration-150 hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";
const iconBtnActive = "bg-brand-accent/12 text-brand-accent-hover ring-1 ring-inset ring-brand-accent/30 dark:text-brand-accent-light";
const textBtn = "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-muted-foreground transition-[background-color,color] duration-150 hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function MarketTerminal({ className }: { className?: string }) {
  const { user, status } = useCurrentUserWithStatus();
  const confirm = useConfirm();
  const isDemo = isDemoUserId(user?.id);
  const canTrade = status === "authenticated" && !!user?.id && !isDemo;

  // ── Paper vs Live ────────────────────────────────────────────────────────
  // Live = your real wallet through the DEX aggregator on the current network
  // (the same DexSwapPanel as the hub's DEX tab). Paper is the extra you
  // switch on. A connected wallet makes Live the default until you choose.
  const { isConnected: walletConnected } = useAccount();
  const { override: localOverride } = useActiveWalletOverride();
  const [tradeMode, setTradeModeState] = React.useState<TerminalTradeMode>("paper");
  const tradeModeChosen = React.useRef(false);
  React.useEffect(() => {
    const stored = readStored(TRADE_MODE_KEY, (v): v is TerminalTradeMode => v === "paper" || v === "live", "paper");
    let chosen = false;
    try { chosen = localStorage.getItem(TRADE_MODE_KEY) !== null; } catch { /* optional */ }
    tradeModeChosen.current = chosen;
    if (chosen) setTradeModeState(stored);
  }, []);
  React.useEffect(() => { if (!tradeModeChosen.current) setTradeModeState(walletConnected ? "live" : "paper"); }, [walletConnected]);
  const setTradeMode = React.useCallback((m: TerminalTradeMode) => { tradeModeChosen.current = true; setTradeModeState(m); try { localStorage.setItem(TRADE_MODE_KEY, m); } catch { /* optional */ } }, []);
  const live = tradeMode === "live";

  // ── Market + chart state ─────────────────────────────────────────────────
  const [symbol, setSymbol] = React.useState<string>("BTC");
  const [interval, setInterval_] = React.useState<Interval>("1h");
  const [chartType, setChartType] = React.useState<ChartType>("candles");
  const [tool, setTool] = React.useState<DrawingTool>("cursor");
  const [drawings, setDrawings] = React.useState<Drawing[]>([]);
  const [listOpen, setListOpen] = React.useState(false);
  const [full, setFull] = React.useState(false);
  const [indicators, setIndicators] = React.useState<IndicatorConfig[]>([]);
  const updateIndicators = React.useCallback((next: IndicatorConfig[]) => { setIndicators(next); saveIndicators(next); }, []);
  const [compareSymbol, setCompareSymbol] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Restore the last market/timeframe once, after mount (localStorage is
    // client-only). Persisting happens in the change handlers, not an effect,
    // so a StrictMode double run can never overwrite the stored value.
    const s = readStored(SYMBOL_KEY, (v): v is string => Boolean(marketBySymbol(v)), "BTC");
    const i = readStored(INTERVAL_KEY, (v): v is Interval => (INTERVALS as readonly string[]).includes(v), "1h");
    setSymbol(s); setInterval_(i); setDrawings(loadDrawings(s)); setIndicators(loadIndicators());
  }, []);
  const setInterval = React.useCallback((iv: Interval) => { setInterval_(iv); try { localStorage.setItem(INTERVAL_KEY, iv); } catch { /* optional */ } }, []);

  const market: Market = marketBySymbol(symbol) ?? CHARTABLE_MARKETS[0];
  const { tickers } = useTickers(React.useMemo(() => CHARTABLE_MARKETS.map((m) => m.symbol), []));
  const ticker = tickers.get(market.symbol);
  const { candles, data: candleData, loading: candlesLoading, error: candlesError, refresh: refreshCandles } = useCandles(market.symbol, interval);
  const livePrice = ticker?.price ?? candles[candles.length - 1]?.c ?? null;
  // Compare: a second market on a percent basis from the first visible bar.
  const compareMarket = compareSymbol && compareSymbol !== market.symbol ? marketBySymbol(compareSymbol) : undefined;
  const { candles: compareCandles } = useCandles(compareMarket?.symbol ?? "", interval);
  const compare = compareMarket ? { symbol: compareMarket.symbol, candles: compareCandles, color: compareMarket.color } : null;

  const selectMarket = React.useCallback((m: Market) => {
    setSymbol(m.symbol); setDrawings(loadDrawings(m.symbol)); setTool("cursor"); setListOpen(false);
    try { localStorage.setItem(SYMBOL_KEY, m.symbol); } catch { /* optional */ }
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
    try { const r = await listPaperOrders(); if (r.success) setOrders(r.data); } catch { /* keep the last list; the next refresh retries */ } finally { setOrdersLoading(false); }
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
                <button key={iv} type="button" role="tab" aria-selected={interval === iv} onClick={() => setInterval(iv)}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Indicators" className={cn(textBtn, indicators.length > 0 && iconBtnActive)}>
                  <Activity className="size-4" /> Indicators{indicators.length > 0 && <span className="tabular-nums">· {indicators.length}</span>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className={menuContent}>
                {indicators.length > 0 && (
                  <>
                    <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">On the chart · click to remove</p>
                    {indicators.map((c) => (
                      <DropdownMenuItem key={c.id} onSelect={(e) => { e.preventDefault(); updateIndicators(indicators.filter((x) => x.id !== c.id)); }} className={cn(menuItem, "justify-between")}>
                        <span>{indicatorLabel(c)}</span><X className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      </DropdownMenuItem>
                    ))}
                    <div className="my-1 h-px bg-border/60" role="separator" />
                  </>
                )}
                <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Add</p>
                {INDICATOR_CATALOGUE.map((m) => (
                  <DropdownMenuItem key={m.type} onSelect={(e) => { e.preventDefault(); updateIndicators([...indicators, defaultIndicator(m.type)]); }} className={menuItem}>
                    <span className="min-w-0 flex-1">{m.label}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.placement === "pane" ? "pane" : "overlay"}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Compare with another market" className={cn(textBtn, compare && iconBtnActive)}>
                  <GitCompare className="size-4" /> {compare ? `vs ${compare.symbol}` : "Compare"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className={cn(menuContent, "max-h-80 overflow-y-auto")}>
                <DropdownMenuItem onSelect={() => setCompareSymbol(null)} className={cn(menuItem, !compare && "bg-brand-accent/[0.08]")}>None</DropdownMenuItem>
                {CHARTABLE_MARKETS.filter((m) => m.symbol !== market.symbol).map((m) => (
                  <DropdownMenuItem key={m.symbol} onSelect={() => setCompareSymbol(m.symbol)} className={cn(menuItem, compare?.symbol === m.symbol && "bg-brand-accent/[0.08]")}>
                    <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="font-semibold">{m.symbol}</span><span className="min-w-0 flex-1 truncate text-muted-foreground">{m.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {!live && portfolio && (
              <dl className="hidden items-center gap-4 text-[11px] tabular-nums md:flex">
                <div><dt className="text-muted-foreground">Value</dt><dd className="font-semibold text-foreground">{portfolio.totalValueUsd != null ? `$${formatPrice(portfolio.totalValueUsd)}` : "—"}</dd></div>
                <div><dt className="text-muted-foreground">Cash</dt><dd className="font-semibold text-foreground">${formatPrice(cash)}</dd></div>
                <div><dt className="text-muted-foreground">P&amp;L</dt><dd className={cn("font-semibold", portfolio.totalPnlUsd == null ? "text-muted-foreground" : portfolio.totalPnlUsd >= 0 ? "text-chart-up" : "text-chart-down")}>{portfolio.totalPnlUsd == null ? "—" : `${portfolio.totalPnlUsd >= 0 ? "+" : "−"}${Math.abs(portfolio.totalPnlUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}{portfolio.totalPnlPercent != null && <span className="ml-1 opacity-80">({portfolio.totalPnlPercent >= 0 ? "+" : ""}{portfolio.totalPnlPercent.toFixed(2)}%)</span>}</dd></div>
              </dl>
            )}
            <div role="tablist" aria-label="Trading account" className="flex items-center gap-0.5 rounded-full border border-border/60 bg-foreground/[0.04] p-0.5">
              {(["live", "paper"] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={tradeMode === m} onClick={() => setTradeMode(m)}
                  className={cn("min-h-7 rounded-full px-3 text-[11px] font-semibold uppercase tracking-wider transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    tradeMode === m ? (m === "paper" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-brand-accent/15 text-brand-accent-hover dark:text-brand-accent-light") : "text-muted-foreground hover:text-foreground")}>
                  {m === "live" ? "Live" : "Paper"}
                </button>
              ))}
            </div>
            <HeaderTip label="Refresh prices and portfolio"><button type="button" aria-label="Refresh" onClick={() => { void refreshCandles(); void refreshPortfolio(); void refreshOrders(); }} className={iconBtn}><RefreshCw className={cn("size-4", candlesLoading && "motion-safe:animate-spin")} /></button></HeaderTip>
            {!live && portfolio && <HeaderTip label="Reset paper portfolio"><button type="button" aria-label="Reset paper portfolio" disabled={busy} onClick={() => void resetPortfolio()} className={iconBtn}><RotateCcw className="size-4" /></button></HeaderTip>}
            <HeaderTip label={full ? "Exit full screen" : "Full screen"}><button type="button" aria-label={full ? "Exit full screen" : "Full screen"} onClick={() => setFull((f) => !f)} className={iconBtn}>{full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</button></HeaderTip>
          </div>
        </header>

        {/* ── Body ─────────────────────────────────────────── */}
        <div className={cn("grid min-h-0 flex-1 grid-cols-1", live ? "lg:grid-cols-[232px_minmax(0,1fr)_400px]" : "lg:grid-cols-[232px_minmax(0,1fr)_300px]")}>
          <aside className="hidden min-h-0 border-r border-border/60 lg:flex lg:flex-col" aria-label="Market list">
            <MarketList selected={market.symbol} tickers={tickers} onSelect={selectMarket} className="min-h-0 flex-1" />
          </aside>

          <div className="flex min-h-0 flex-col">
            <div className="relative min-h-[360px] flex-1 lg:min-h-0">
              <CandleChart candles={candles} interval={interval} chartType={chartType} tool={tool} onToolDone={() => setTool("cursor")} drawings={drawings} onDrawingsChange={updateDrawings} indicators={indicators} compare={compare} fitKey={market.symbol} className="absolute inset-0" />
              {candlesLoading && !candles.length && <div role="status" className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Loading {market.symbol} candles…</div>}
              {candlesError && !candles.length && <div role="alert" className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">Candles are unavailable right now. <button type="button" onClick={() => void refreshCandles()} className="ml-1 underline underline-offset-4 hover:text-foreground">Try again</button></div>}
              {candleData?.approximate && <p className="pointer-events-none absolute bottom-8 left-3 rounded-md bg-card/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">Approximate bars from CoinGecko for this market and timeframe.</p>}
            </div>
            {live ? (
              <div className="flex h-[120px] shrink-0 items-center justify-center border-t border-border/60 px-6 text-center text-sm text-muted-foreground">
                Live trades settle in your wallet. Positions are your on-chain balances (see Inventory on the hub); switch to Paper for the virtual account, orders and history.
              </div>
            ) : (
              <TerminalPanels portfolio={portfolio} orders={orders} ordersLoading={ordersLoading} onSelectSymbol={(s) => { const m = marketBySymbol(s); if (m) selectMarket(m); }} onClosePosition={closePosition} onCancelOrder={cancelOrder} className="h-[240px] shrink-0 border-t border-border/60" />
            )}
          </div>

          <aside className="min-h-0 overflow-y-auto border-t border-border/60 p-3 lg:border-l lg:border-t-0" aria-label="Order ticket">
            {live ? (
              <div className="space-y-3">
                {localOverride && !walletConnected && (
                  <p className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-xs leading-relaxed text-orange-800 dark:text-orange-200">
                    Your active wallet is a local dev-chain account. DEX routing needs a browser wallet on a live network; use Internal Transfer or Local Chain on the hub for test-chain moves.
                  </p>
                )}
                <DexSwapPanel />
              </div>
            ) : status === "loading" || portfolioState === "loading" ? (
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
