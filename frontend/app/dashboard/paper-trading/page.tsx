"use client";

/**
 * @fileOverview  Paper Trading dashboard — portfolio overview + swap panel + trade history.
 *               Accessible at /dashboard/paper-trading.
 * @stability     experimental
 */

import React, { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from 'next/link';
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';
import { isDemoUserId } from '@/lib/demo-policy';
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useConfirm } from "@/components/providers/confirm-dialog";
import {
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
  FiRefreshCw,
  FiZap,
  FiBarChart2,
  FiRotateCcw,
  FiClock,
} from "react-icons/fi";
import { useTradeMode } from "@/contexts/trade-mode-context";
import {
  createPaperPortfolio,
  getPaperPortfolio,
  resetPaperPortfolio,
} from "@/actions/paper-trade";
import { PaperSwapPanel } from "@/components/crypto-related/PaperSwapPanel";
import { PaperTradeHistory } from "@/components/crypto-related/PaperTradeHistory";
import type { PaperPortfolioSnapshot } from '@/lib/paper/read';
import { Button } from '@/components/ui/button';

// ── Types ──
type PortfolioData = PaperPortfolioSnapshot;

type TabId = "portfolio" | "trade" | "history";

export default function PaperTradingPage() {
  const { user, isLoading } = useCurrentUserWithStatus();
  if (isLoading) return <div role="status" aria-label="Loading paper trading" className="m-6 h-48 rounded-xl bg-muted motion-safe:animate-pulse" />;
  if (isDemoUserId(user?.id)) return <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Experimental module</p>
    <h1 className="mt-3 text-3xl font-semibold">Paper trading</h1>
    <p className="mt-4 text-muted-foreground">Practice trading uses a separate virtual portfolio. Portfolio creation and trading are disabled in the read-only interview demo; no money or wallet is needed for the marketplace tour.</p>
    <Link href="/products" className="mt-6 inline-flex min-h-11 items-center underline underline-offset-4">Explore the demo marketplace</Link>
  </section>;
  if (!user?.id) return <section className="mx-auto max-w-xl px-4 py-12">
    <h1 className="text-2xl font-semibold">Paper trading</h1>
    <p className="mt-3 text-muted-foreground">Sign in to open your saved paper account.</p>
    <Button asChild className="mt-6"><Link href="/auth/login?callbackUrl=%2Fdashboard%2Fpaper-trading">Sign in</Link></Button>
  </section>;
  return <PaperTradingWorkspace key={`${user.id}:${user.sessionVersion}`} />;
}

function PaperTradingWorkspace() {
  const { mode, setMode } = useTradeMode();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<TabId>("portfolio");
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasNoPortfolio, setHasNoPortfolio] = useState(false);
  const readRequest = useRef(0);
  const [isPending, startTransition] = useTransition();
  const [startingBalance, setStartingBalance] = useState("100000");

  // Auto-enable paper mode when on this page
  useEffect(() => {
    if (mode !== "paper") setMode("paper");
  }, [mode, setMode]);

  // Fetch portfolio data
  const refreshPortfolio = useCallback(() => {
    const id = ++readRequest.current;
    startTransition(async () => {
      try {
        const result = await getPaperPortfolio();
        if (id !== readRequest.current) return;
        if (result.success) {
          setPortfolio(result.data); setLoadError(null); setHasNoPortfolio(false);
        } else if (result.code === 'NOT_FOUND') {
          setPortfolio(null); setHasNoPortfolio(true); setLoadError(null);
        } else {
          setLoadError(result.error); setHasNoPortfolio(false);
          if (result.code === 'UNAUTHORIZED') setPortfolio(null);
        }
      } catch {
        if (id === readRequest.current) { setLoadError('Your saved portfolio could not be loaded. Try again.'); setHasNoPortfolio(false); }
      } finally {
        if (id === readRequest.current) setIsLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    const sequence = readRequest;
    refreshPortfolio();
    return () => { ++sequence.current; };
  }, [refreshPortfolio]);

  // Create portfolio
  const handleCreate = useCallback(() => {
    const balance = parseFloat(startingBalance);
    if (isNaN(balance) || balance < 1000 || balance > 10_000_000) {
      toast.error("Starting balance must be between $1,000 and $10,000,000");
      return;
    }
    startTransition(async () => {
      const result = await createPaperPortfolio({ startingBalance: balance });
      if (result.success) {
        toast.success(
          `Portfolio created with $${balance.toLocaleString()} starting balance`,
        );
        refreshPortfolio();
      } else {
        toast.error(result.error);
      }
    });
  }, [startingBalance, refreshPortfolio]);

  // Reset portfolio
  const handleReset = useCallback(async () => {
    if (!(await confirm({
      title: "Reset paper portfolio?",
      description: "This clears your positions and restores the starting balance. Your trade history is kept, with a reset entry. Resets are limited.",
      confirmLabel: "Reset portfolio",
      destructive: true,
    }))) return;
    startTransition(async () => {
      const result = await resetPaperPortfolio();
      if (result.success) {
        toast.success("Portfolio reset to starting balance");
        refreshPortfolio();
      } else {
        toast.error(result.error);
      }
    });
  }, [refreshPortfolio, confirm]);

  // ── No portfolio → onboarding ─────────────────────────────────────────────
  if (!isLoading && !portfolio && loadError) return <section className="mx-auto max-w-xl px-4 py-12">
    <h1 className="text-2xl font-semibold">Paper trading</h1>
    <p role="alert" className="mt-3 text-muted-foreground">{loadError}</p>
    <Button onClick={refreshPortfolio} disabled={isPending} className="mt-6">Retry portfolio</Button>
    <Link href="/auth/login?callbackUrl=%2Fdashboard%2Fpaper-trading" className="ml-4 inline-flex min-h-11 items-center text-sm underline">Sign in again</Link>
  </section>;
  if (!isLoading && !portfolio && hasNoPortfolio) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-6 text-center"
        >
          <div className="mx-auto w-16 h-16 rounded-2xl bg-linear-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
            <span className="text-3xl">📝</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Paper Trading
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
              Trade crypto with virtual USD at real market prices. No risk, real
              learning. Track your P&L and sharpen your strategy.
            </p>
          </div>

          <div className="space-y-3">
            <label htmlFor="paper-starting-balance" className="block text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Starting Balance (USD)
            </label>
            <div className="flex gap-2">
              {["10000", "100000", "1000000"].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setStartingBalance(val)}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                    startingBalance === val
                      ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                      : "bg-muted text-foreground/80 hover:bg-muted"
                  }`}
                >
                  ${parseInt(val).toLocaleString()}
                </button>
              ))}
            </div>
            <input
              id="paper-starting-balance"
              type="number"
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              placeholder="Custom amount..."
              min={1000}
              max={10000000}
              className="w-full rounded-xl border border-border bg-surface-1 px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending}
            className="w-full rounded-xl bg-linear-to-r from-amber-500 to-amber-600 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/25 transition hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <FiRefreshCw className="h-4 w-4 animate-spin" />
                Creating...
              </span>
            ) : (
              "Start Paper Trading"
            )}
          </button>

          <p className="text-[10px] text-muted-foreground">
            Prices from CoinGecko · 0.3% simulated fees · Up to 200 trades/day
          </p>
        </motion.div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading || !portfolio) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <FiRefreshCw className="h-6 w-6 text-amber-500 animate-spin" />
      </div>
    );
  }

  // ── Main dashboard ────────────────────────────────────────────────────────
  const { positions, totalValueUsd, totalPnlUsd, totalPnlPercent } = portfolio!;
  const cashBalance = portfolio!.portfolio.cashBalance;
  const startBal = portfolio!.portfolio.startingBalance;
  const pnlIsPositive = totalPnlUsd !== null && totalPnlUsd >= 0;

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            📝 Paper Trading
            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500 uppercase tracking-wider">
              Simulated
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Saved to your account · Virtual money · Experimental
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshPortfolio}
            disabled={isPending}
            className="inline-flex size-11 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
            title="Refresh prices"
            aria-label="Refresh portfolio"
          >
            <FiRefreshCw
              className={`h-4 w-4 text-muted-foreground ${isPending ? "animate-spin" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-40"
            title="Reset portfolio"
          >
            <FiRotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>
      </div>

      {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4 text-sm">
        <p>{loadError} Showing the last loaded account.</p>
        <Button variant="outline" onClick={refreshPortfolio} disabled={isPending}>Retry portfolio</Button>
      </div>}
      {totalValueUsd === null && <p role="status" className="text-sm text-muted-foreground">Some prices are unavailable. Holdings are saved; totals will return when prices refresh.</p>}
      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total Value"
          value={formatUsd(totalValueUsd)}
          icon={<FiDollarSign className="h-4 w-4" />}
          color="zinc"
        />
        <StatCard
          label="Cash Available"
          value={`$${cashBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          icon={<FiBarChart2 className="h-4 w-4" />}
          color="sky"
        />
        <StatCard
          label="Total P&L"
          value={totalPnlUsd === null ? '—' : `${pnlIsPositive ? "+" : ""}${formatUsd(totalPnlUsd)}`}
          icon={
            pnlIsPositive ? (
              <FiTrendingUp className="h-4 w-4" />
            ) : (
              <FiTrendingDown className="h-4 w-4" />
            )
          }
          color={totalPnlUsd === null ? 'zinc' : pnlIsPositive ? "emerald" : "rose"}
        />
        <StatCard
          label="P&L %"
          value={totalPnlPercent === null ? '—' : `${pnlIsPositive ? "+" : ""}${totalPnlPercent.toFixed(2)}%`}
          icon={<FiZap className="h-4 w-4" />}
          color={totalPnlUsd === null ? 'zinc' : pnlIsPositive ? "emerald" : "rose"}
        />
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-border">
        {(
          [
            { id: "portfolio" as TabId, label: "Portfolio", icon: <FiBarChart2 className="h-3.5 w-3.5" /> },
            { id: "trade" as TabId, label: "Trade", icon: <FiZap className="h-3.5 w-3.5" /> },
            { id: "history" as TabId, label: "History", icon: <FiClock className="h-3.5 w-3.5" /> },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === tab.id
                ? "text-amber-500 border-b-2 border-amber-500"
                : "text-muted-foreground hover:text-foreground/80"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === "portfolio" && (
          <motion.div
            key="portfolio"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {positions.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-muted-foreground">
                  No positions yet. Go to the <button type="button" onClick={() => setActiveTab("trade")} className="text-amber-500 hover:underline font-medium">Trade</button> tab to buy your first token.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2.5 bg-foreground/[0.05] border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>Token</span>
                  <span className="text-right">Amount</span>
                  <span className="text-right">Avg Entry</span>
                  <span className="text-right">Current</span>
                  <span className="text-right">Value</span>
                  <span className="text-right">P&L</span>
                </div>
                {positions.map((pos, i) => (
                  <motion.div
                    key={`${pos.chainId}:${pos.tokenSymbol}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-3 border-b border-border/60 hover:bg-foreground/[0.05] transition-colors items-center"
                  >
                    {/* Token */}
                    <div>
                      <span className="font-semibold text-sm text-foreground">
                        {pos.tokenSymbol}
                      </span>
                    </div>
                    {/* Amount */}
                    <div className="text-right text-xs font-mono text-foreground/80">
                      {formatAmount(pos.displayAmount)}
                    </div>
                    {/* Avg Entry */}
                    <div className="text-right text-xs font-mono text-muted-foreground hidden sm:block">
                      ${pos.avgEntryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    {/* Current Price */}
                    <div className="text-right text-xs font-mono text-muted-foreground hidden sm:block">
                      {formatUsd(pos.currentPriceUsd)}
                    </div>
                    {/* Value */}
                    <div className="text-right text-xs font-mono font-semibold text-foreground hidden sm:block">
                      {formatUsd(pos.valueUsd)}
                    </div>
                    {/* P&L */}
                    <div
                      className={`text-right text-xs font-mono font-semibold ${
                        pos.pnlUsd === null ? 'text-muted-foreground' : pos.pnlUsd >= 0
                          ? "text-brand-accent"
                          : "text-rose-500"
                      }`}
                    >
                      {pos.pnlUsd !== null && pos.pnlUsd >= 0 ? "+" : ""}
                      {formatUsd(pos.pnlUsd)}
                      {pos.pnlPercent !== null && <span className="text-[10px] ml-1 opacity-75">
                        ({pos.pnlPercent >= 0 ? "+" : ""}{pos.pnlPercent.toFixed(1)}%)
                      </span>}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "trade" && (
          <motion.div
            key="trade"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="max-w-md mx-auto"
          >
            <PaperSwapPanel
              cashBalance={cashBalance}
              positions={positions.map((p) => ({
                tokenSymbol: p.tokenSymbol,
                displayAmount: p.displayAmount,
                currentPriceUsd: p.currentPriceUsd,
              }))}
              onTradeComplete={refreshPortfolio}
            />
          </motion.div>
        )}

        {activeTab === "history" && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <PaperTradeHistory />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── StatCard component ──────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "zinc" | "sky" | "emerald" | "rose";
}) {
  const colorMap = {
    zinc: "text-muted-foreground bg-muted/10 border-border",
    sky: "text-brand-accent bg-brand-accent/10 border-brand-accent",
    emerald:
      "text-brand-accent bg-brand-accent/10 border-brand-accent",
    rose: "text-rose-400 bg-rose-500/10 border-rose-200 dark:border-rose-500/30",
  };

  return (
    <div
      className={`rounded-xl border p-3 ${colorMap[color]} bg-card`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider opacity-75">
          {label}
        </span>
      </div>
      <p className="text-sm font-bold text-foreground font-mono">
        {value}
      </p>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(val: string): string {
  const n = parseFloat(val);
  if (Number.isNaN(n)) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function formatUsd(value: number | null) {
  return value === null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}
