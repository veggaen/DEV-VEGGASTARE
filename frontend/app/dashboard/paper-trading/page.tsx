"use client";

/**
 * @fileOverview  Paper Trading dashboard — portfolio overview + swap panel + trade history.
 *               Accessible at /dashboard/paper-trading.
 * @stability     experimental
 */

import React, { useCallback, useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
<<<<<<< HEAD
import { useConfirm } from "@/components/providers/confirm-dialog";
=======
>>>>>>> dev
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

// ── Types ──
type PortfolioData = {
  portfolio: {
    id: string;
    startingBalance: number;
    cashBalance: number;
    resetCount: number;
  };
  positions: Array<{
    tokenSymbol: string;
    tokenAddress: string;
    chainId: number;
    displayAmount: string;
    avgEntryPrice: number;
    currentPriceUsd: number;
    valueUsd: number;
    pnlUsd: number;
    pnlPercent: number;
  }>;
  totalValueUsd: number;
  totalPnlUsd: number;
  totalPnlPercent: number;
};

type TabId = "portfolio" | "trade" | "history";

export default function PaperTradingPage() {
  const { mode, setMode } = useTradeMode();
<<<<<<< HEAD
  const confirm = useConfirm();
=======
>>>>>>> dev
  const [activeTab, setActiveTab] = useState<TabId>("portfolio");
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [startingBalance, setStartingBalance] = useState("100000");

  // Auto-enable paper mode when on this page
  useEffect(() => {
    if (mode !== "paper") setMode("paper");
  }, [mode, setMode]);

  // Fetch portfolio data
  const refreshPortfolio = useCallback(() => {
    startTransition(async () => {
      const result = await getPaperPortfolio();
      if (result.success && result.data) {
        setPortfolio(result.data);
      } else {
        setPortfolio(null);
      }
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    refreshPortfolio();
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
<<<<<<< HEAD
  const handleReset = useCallback(async () => {
    if (!(await confirm({
      title: "Reset paper portfolio?",
      description: "This deletes all positions and trade history. You have limited resets per week.",
      confirmLabel: "Reset portfolio",
      destructive: true,
    }))) return;
=======
  const handleReset = useCallback(() => {
    if (
      !confirm(
        "Reset paper portfolio? This deletes all positions and trade history. You have limited resets per week.",
      )
    )
      return;
>>>>>>> dev
    startTransition(async () => {
      const result = await resetPaperPortfolio();
      if (result.success) {
        toast.success("Portfolio reset to starting balance");
        refreshPortfolio();
      } else {
        toast.error(result.error);
      }
    });
<<<<<<< HEAD
  }, [refreshPortfolio, confirm]);
=======
  }, [refreshPortfolio]);
>>>>>>> dev

  // ── No portfolio → onboarding ─────────────────────────────────────────────
  if (!isLoading && !portfolio) {
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
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Paper Trading
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
              Trade crypto with virtual USD at real market prices. No risk, real
              learning. Track your P&L and sharpen your strategy.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Starting Balance (USD)
            </label>
            <div className="flex gap-2">
              {["10000", "100000", "1000000"].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setStartingBalance(val)}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                    startingBalance === val
                      ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  ${parseInt(val).toLocaleString()}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              placeholder="Custom amount..."
              min={1000}
              max={10000000}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending}
            className="w-full rounded-xl bg-linear-to-r from-amber-500 to-amber-600 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/25 transition-all hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
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

          <p className="text-[10px] text-zinc-500">
            Prices from CoinGecko · 0.3% simulated fees · Up to 200 trades/day
          </p>
        </motion.div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
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
  const pnlIsPositive = totalPnlUsd >= 0;

  return (
    <div className="space-y-4 px-1 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            📝 Paper Trading
            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500 uppercase tracking-wider">
              Simulated
            </span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Real prices · Virtual money · Zero risk
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshPortfolio}
            disabled={isPending}
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
            title="Refresh prices"
          >
            <FiRefreshCw
              className={`h-4 w-4 text-zinc-400 ${isPending ? "animate-spin" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-500/30 text-xs font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-40"
            title="Reset portfolio"
          >
            <FiRotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total Value"
          value={`$${totalValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
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
          value={`${pnlIsPositive ? "+" : ""}$${totalPnlUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          icon={
            pnlIsPositive ? (
              <FiTrendingUp className="h-4 w-4" />
            ) : (
              <FiTrendingDown className="h-4 w-4" />
            )
          }
          color={pnlIsPositive ? "emerald" : "rose"}
        />
        <StatCard
          label="P&L %"
          value={`${pnlIsPositive ? "+" : ""}${totalPnlPercent.toFixed(2)}%`}
          icon={<FiZap className="h-4 w-4" />}
          color={pnlIsPositive ? "emerald" : "rose"}
        />
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
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
                : "text-zinc-400 hover:text-zinc-300"
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
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No positions yet. Go to the <button type="button" onClick={() => setActiveTab("trade")} className="text-amber-500 hover:underline font-medium">Trade</button> tab to buy your first token.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg overflow-hidden">
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <span>Token</span>
                  <span className="text-right">Amount</span>
                  <span className="text-right">Avg Entry</span>
                  <span className="text-right">Current</span>
                  <span className="text-right">Value</span>
                  <span className="text-right">P&L</span>
                </div>
                {positions.map((pos, i) => (
                  <motion.div
                    key={pos.tokenSymbol}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors items-center"
                  >
                    {/* Token */}
                    <div>
                      <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        {pos.tokenSymbol}
                      </span>
                    </div>
                    {/* Amount */}
                    <div className="text-right text-xs font-mono text-zinc-600 dark:text-zinc-300">
                      {formatAmount(pos.displayAmount)}
                    </div>
                    {/* Avg Entry */}
                    <div className="text-right text-xs font-mono text-zinc-500 hidden sm:block">
                      ${pos.avgEntryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    {/* Current Price */}
                    <div className="text-right text-xs font-mono text-zinc-500 hidden sm:block">
                      ${pos.currentPriceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    {/* Value */}
                    <div className="text-right text-xs font-mono font-semibold text-zinc-900 dark:text-zinc-100 hidden sm:block">
                      ${pos.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    {/* P&L */}
                    <div
                      className={`text-right text-xs font-mono font-semibold ${
                        pos.pnlUsd >= 0
                          ? "text-emerald-500"
                          : "text-rose-500"
                      }`}
                    >
                      {pos.pnlUsd >= 0 ? "+" : ""}
                      ${pos.pnlUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      <span className="text-[10px] ml-1 opacity-75">
                        ({pos.pnlPercent >= 0 ? "+" : ""}
                        {pos.pnlPercent.toFixed(1)}%)
                      </span>
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
    zinc: "text-zinc-400 bg-zinc-500/10 border-zinc-200 dark:border-zinc-700",
    sky: "text-sky-400 bg-sky-500/10 border-sky-200 dark:border-sky-500/30",
    emerald:
      "text-emerald-400 bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30",
    rose: "text-rose-400 bg-rose-500/10 border-rose-200 dark:border-rose-500/30",
  };

  return (
    <div
      className={`rounded-xl border p-3 ${colorMap[color]} bg-white dark:bg-zinc-950`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider opacity-75">
          {label}
        </span>
      </div>
      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-mono">
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
