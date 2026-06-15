"use client";

/**
 * @fileOverview  PaperTradeHistory — paginated trade log for paper trades.
 * @stability     experimental
 */

import React, { useState, useTransition, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiClock, FiRefreshCw } from "react-icons/fi";
import { getPaperTradeHistory } from "@/actions/paper-trade";

type TradeRow = {
  id: string;
  type: string;
  sellToken: string | null;
  sellDisplayAmt: string | null;
  sellPriceUsd: number | null;
  buyToken: string | null;
  buyDisplayAmt: string | null;
  buyPriceUsd: number | null;
  feeUsd: number | null;
  executedAt: Date;
};

const PAGE_SIZE = 50;

const TYPE_COLORS: Record<string, string> = {
  BUY: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  SELL: "text-rose-400 bg-rose-500/10 border-rose-500/30",
  SWAP: "text-sky-400 bg-sky-500/10 border-sky-500/30",
  FAUCET: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  P2P_SEND: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  P2P_RECEIVE: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
};

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export function PaperTradeHistory() {
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [isPending, startTransition] = useTransition();

  const fetchTrades = useCallback(() => {
    startTransition(async () => {
      const result = await getPaperTradeHistory({ limit: PAGE_SIZE });
      if (result.success && result.data) {
        setTrades(result.data as unknown as TradeRow[]);
      }
    });
  }, []);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <FiClock className="h-4 w-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Trade History
          </h3>
          {trades.length > 0 && (
            <span className="text-[10px] text-zinc-500 font-mono">
              {trades.length} trades
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => fetchTrades()}
          disabled={isPending}
          className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
        >
          <FiRefreshCw
            className={`h-3.5 w-3.5 text-zinc-400 ${isPending ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Trade rows */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50 max-h-105 overflow-y-auto">
        <AnimatePresence mode="wait">
          {trades.length === 0 && !isPending ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-10 text-center text-xs text-zinc-500"
            >
              No trades yet. Execute your first trade!
            </motion.div>
          ) : (
            trades.map((trade, i) => (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
              >
                {/* Type badge */}
                <span
                  className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TYPE_COLORS[trade.type] ?? "text-zinc-400 bg-zinc-500/10 border-zinc-500/30"}`}
                >
                  {trade.type}
                </span>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  {trade.type === "BUY" && (
                    <p className="text-xs text-zinc-900 dark:text-zinc-200 truncate">
                      Bought <span className="font-semibold text-emerald-400">{formatAmount(trade.buyDisplayAmt)} {trade.buyToken}</span>
                      {" "}for <span className="font-mono text-zinc-400">${trade.sellPriceUsd != null && trade.sellDisplayAmt ? (parseFloat(trade.sellDisplayAmt)).toFixed(2) : "—"}</span>
                    </p>
                  )}
                  {trade.type === "SELL" && (
                    <p className="text-xs text-zinc-900 dark:text-zinc-200 truncate">
                      Sold <span className="font-semibold text-rose-400">{formatAmount(trade.sellDisplayAmt)} {trade.sellToken}</span>
                      {" "}for <span className="font-mono text-zinc-400">${trade.buyPriceUsd != null && trade.buyDisplayAmt ? parseFloat(trade.buyDisplayAmt).toFixed(2) : "—"}</span>
                    </p>
                  )}
                  {trade.type === "SWAP" && (
                    <p className="text-xs text-zinc-900 dark:text-zinc-200 truncate">
                      <span className="font-semibold">{formatAmount(trade.sellDisplayAmt)} {trade.sellToken}</span>
                      {" → "}
                      <span className="font-semibold text-sky-400">{formatAmount(trade.buyDisplayAmt)} {trade.buyToken}</span>
                    </p>
                  )}
                  {(trade.type === "FAUCET" || trade.type === "P2P_SEND" || trade.type === "P2P_RECEIVE") && (
                    <p className="text-xs text-zinc-900 dark:text-zinc-200 truncate">
                      {trade.type === "FAUCET" && <>Faucet: {formatAmount(trade.buyDisplayAmt)} {trade.buyToken}</>}
                      {trade.type === "P2P_SEND" && <>Sent {formatAmount(trade.sellDisplayAmt)} {trade.sellToken}</>}
                      {trade.type === "P2P_RECEIVE" && <>Received {formatAmount(trade.buyDisplayAmt)} {trade.buyToken}</>}
                    </p>
                  )}
                </div>

                {/* Fee + time */}
                <div className="text-right shrink-0">
                  {trade.feeUsd != null && trade.feeUsd > 0 && (
                    <p className="text-[10px] text-zinc-500 font-mono">
                      fee ${trade.feeUsd.toFixed(2)}
                    </p>
                  )}
                  <p className="text-[10px] text-zinc-500">
                    {formatRelativeTime(trade.executedAt)}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Footer note */}
      {trades.length >= PAGE_SIZE && (
        <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 text-center">
          <span className="text-[10px] text-zinc-500">
            Showing last {PAGE_SIZE} trades
          </span>
        </div>
      )}
    </div>
  );
}

/** Format token amount (trim trailing zeros, max 6 decimals) */
function formatAmount(val: string | null): string {
  if (!val) return "0";
  const n = parseFloat(val);
  if (Number.isNaN(n)) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}
