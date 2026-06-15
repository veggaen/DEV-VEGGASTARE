/**
 * @fileOverview  TradeHistory — unified trade history panel for the Trading Hub.
 *                Displays all TradeRecord entries with mode-color-coded rows,
 *                inline filters, pagination, and CSV export for tax reporting.
 *
 *   Design language matches the existing OsrsInventory + Trading Hub aesthetic.
 *   Norwegian Skatteetaten compliance: shows gain/loss, cost basis, NOK values.
 *
 * @stability experimental
 */

"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiClock,
  FiFilter,
  FiDownload,
  FiChevronLeft,
  FiChevronRight,
  FiRefreshCw,
  FiExternalLink,
  FiArrowRight,
  FiX,
} from "react-icons/fi";
import { Users, ArrowLeftRight, Repeat, FileText, Monitor, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PersonalTaxSummary } from "./PersonalTaxSummary";

// ── Types ───────────────────────────────────────────────────────────────────

type TradeMode = "P2P" | "SELF" | "DEX" | "PAPER" | "LOCAL";
type TradeRecordStatus = "PENDING" | "COMPLETED" | "FAILED" | "REVERTED";

interface TradeRecord {
  id: string;
  mode: TradeMode;
  sellToken: string | null;
  sellDisplayAmt: string | null;
  sellChainId: number | null;
  buyToken: string | null;
  buyDisplayAmt: string | null;
  buyChainId: number | null;
  priceUsd: number | null;
  priceNok: number | null;
  feeUsd: number | null;
  gainLossUsd: number | null;
  gainLossNok: number | null;
  txHash: string | null;
  walletAddress: string | null;
  counterpartyId: string | null;
  environment: string | null;
  status: TradeRecordStatus;
  companyId: string | null;
  executedAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface HistoryResponse {
  records: TradeRecord[];
  pagination: PaginationInfo;
}

// ── Mode visual config ──────────────────────────────────────────────────────

const MODE_CONFIG: Record<TradeMode, {
  label: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  icon: React.ReactNode;
}> = {
  P2P: {
    label: "P2P",
    color: "emerald",
    bgClass: "bg-emerald-500/10",
    textClass: "text-emerald-400",
    borderClass: "border-emerald-500/30",
    icon: <Users className="h-3 w-3" />,
  },
  SELF: {
    label: "Transfer",
    color: "purple",
    bgClass: "bg-purple-500/10",
    textClass: "text-purple-400",
    borderClass: "border-purple-500/30",
    icon: <ArrowLeftRight className="h-3 w-3" />,
  },
  DEX: {
    label: "DEX",
    color: "sky",
    bgClass: "bg-sky-500/10",
    textClass: "text-sky-400",
    borderClass: "border-sky-500/30",
    icon: <Repeat className="h-3 w-3" />,
  },
  PAPER: {
    label: "Paper",
    color: "amber",
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-400",
    borderClass: "border-amber-500/30",
    icon: <FileText className="h-3 w-3" />,
  },
  LOCAL: {
    label: "Local",
    color: "orange",
    bgClass: "bg-orange-500/10",
    textClass: "text-orange-400",
    borderClass: "border-orange-500/30",
    icon: <Monitor className="h-3 w-3" />,
  },
};

const STATUS_CONFIG: Record<TradeRecordStatus, { label: string; dotClass: string }> = {
  PENDING: { label: "Pending", dotClass: "bg-amber-400 animate-pulse" },
  COMPLETED: { label: "Completed", dotClass: "bg-emerald-400" },
  FAILED: { label: "Failed", dotClass: "bg-red-400" },
  REVERTED: { label: "Reverted", dotClass: "bg-zinc-400" },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatAmount(amt: string | null): string {
  if (!amt) return "—";
  const n = parseFloat(amt);
  if (isNaN(n)) return amt;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.001) return n.toFixed(6);
  return n.toExponential(2);
}

function formatUsd(val: number | null): string {
  if (val == null) return "—";
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNok(val: number | null): string {
  if (val == null) return "—";
  return `${val.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    const mins = Math.floor(diffMs / (1000 * 60));
    return mins <= 1 ? "Just now" : `${mins}m ago`;
  }
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  if (diffHours < 48) return "Yesterday";

  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getExplorerUrl(txHash: string, chainId: number | null): string | null {
  if (!txHash) return null;
  const explorers: Record<number, string> = {
    1: "https://etherscan.io/tx/",
    10: "https://optimistic.etherscan.io/tx/",
    137: "https://polygonscan.com/tx/",
    42161: "https://arbiscan.io/tx/",
    8453: "https://basescan.org/tx/",
    56: "https://bscscan.com/tx/",
    43114: "https://snowtrace.io/tx/",
  };
  const base = chainId ? explorers[chainId] : null;
  if (!base) return null;
  return `${base}${txHash}`;
}

function truncateHash(hash: string | null): string {
  if (!hash) return "—";
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

// ── CSV Export ──────────────────────────────────────────────────────────────

function exportToCsv(records: TradeRecord[]) {
  const headers = [
    "Date",
    "Time",
    "Mode",
    "Status",
    "Sell Token",
    "Sell Amount",
    "Buy Token",
    "Buy Amount",
    "Price (USD)",
    "Price (NOK)",
    "Fee (USD)",
    "Gain/Loss (USD)",
    "Gain/Loss (NOK)",
    "Tx Hash",
    "Wallet",
    "Chain ID",
  ];

  const rows = records.map((r) => [
    new Date(r.executedAt).toISOString().split("T")[0],
    new Date(r.executedAt).toISOString().split("T")[1]?.slice(0, 8),
    r.mode,
    r.status,
    r.sellToken ?? "",
    r.sellDisplayAmt ?? "",
    r.buyToken ?? "",
    r.buyDisplayAmt ?? "",
    r.priceUsd?.toString() ?? "",
    r.priceNok?.toString() ?? "",
    r.feeUsd?.toString() ?? "",
    r.gainLossUsd?.toString() ?? "",
    r.gainLossNok?.toString() ?? "",
    r.txHash ?? "",
    r.walletAddress ?? "",
    r.sellChainId?.toString() ?? "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `veggat-trades-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ───────────────────────────────────────────────────────────────

interface TradeHistoryProps {
  /** Called when user wants to close the history panel */
  onClose?: () => void;
}

export function TradeHistory({ onClose }: TradeHistoryProps) {
  const [records, setRecords] = useState<TradeRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, limit: 20, total: 0, totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [modeFilter, setModeFilter] = useState<TradeMode | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<TradeRecordStatus | "ALL">("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [showNok, setShowNok] = useState(false); // toggle USD/NOK
  const [showTaxPanel, setShowTaxPanel] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // ── Fetch ───────────────────────────────────────────────────────────────

  const fetchRecords = useCallback(async (page = 1) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (modeFilter !== "ALL") params.set("mode", modeFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/trades/history?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as HistoryResponse;
      setRecords(data.records);
      setPagination(data.pagination);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message ?? "Failed to load trade history");
    } finally {
      setLoading(false);
    }
  }, [modeFilter, statusFilter]);

  // Fetch on mount + filter changes
  useEffect(() => {
    fetchRecords(1);
    return () => abortRef.current?.abort();
  }, [fetchRecords]);

  // ── Summary stats (computed from current page) ────────────────────────

  const stats = useMemo(() => {
    const completed = records.filter((r) => r.status === "COMPLETED");
    const totalVolume = completed.reduce((sum, r) => sum + (r.priceUsd ?? 0), 0);
    const totalGainUsd = completed.reduce((sum, r) => sum + (r.gainLossUsd ?? 0), 0);
    const totalGainNok = completed.reduce((sum, r) => sum + (r.gainLossNok ?? 0), 0);
    const totalFees = completed.reduce((sum, r) => sum + (r.feeUsd ?? 0), 0);
    return { totalVolume, totalGainUsd, totalGainNok, totalFees, completedCount: completed.length };
  }, [records]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-4xl mx-auto space-y-3">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg ring-1 ring-zinc-600/40 bg-zinc-800/60 text-zinc-400">
            <FiClock className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-200 leading-tight">Trade History</h2>
            <p className="text-[10px] text-zinc-500">
              {pagination.total} total record{pagination.total !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Currency toggle */}
          <button
            type="button"
            onClick={() => setShowNok((p) => !p)}
            className="px-2.5 py-1.5 rounded-lg border border-zinc-700/60 text-[10px] font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Toggle USD/NOK"
          >
            {showNok ? "NOK" : "USD"}
          </button>

          {/* Filters toggle */}
          <button
            type="button"
            onClick={() => setShowFilters((p) => !p)}
            className={`p-2 rounded-lg border transition-colors ${
              showFilters
                ? "border-sky-500/50 bg-sky-500/10 text-sky-400"
                : "border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
            title="Toggle filters"
          >
            <FiFilter className="h-3.5 w-3.5" />
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => fetchRecords(pagination.page)}
            className="p-2 rounded-lg border border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            disabled={loading}
            title="Refresh"
          >
            <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* CSV Export */}
          <button
            type="button"
            onClick={() => exportToCsv(records)}
            disabled={records.length === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-700/60 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-40"
            title="Export CSV for tax reporting"
          >
            <FiDownload className="h-3 w-3" />
            CSV
          </button>

          {/* Tax Summary toggle */}
          <button
            type="button"
            onClick={() => setShowTaxPanel((p) => !p)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
              showTaxPanel
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
            title="Tax overview (Skatteetaten)"
          >
            🇳🇴 Tax
          </button>

          {/* Close button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg border border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="Close history"
            >
              <FiX className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3 flex flex-wrap gap-3">
              {/* Mode filter */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">Mode</label>
                <div className="flex flex-wrap gap-1">
                  {(["ALL", "P2P", "SELF", "DEX", "PAPER", "LOCAL"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModeFilter(m)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                        modeFilter === m
                          ? m === "ALL"
                            ? "border-zinc-500/60 bg-zinc-700/30 text-zinc-200"
                            : `${MODE_CONFIG[m].borderClass} ${MODE_CONFIG[m].bgClass} ${MODE_CONFIG[m].textClass}`
                          : "border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"
                      }`}
                    >
                      {m !== "ALL" && MODE_CONFIG[m].icon}
                      <span>{m === "ALL" ? "All" : MODE_CONFIG[m].label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Status filter */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">Status</label>
                <div className="flex flex-wrap gap-1">
                  {(["ALL", "COMPLETED", "PENDING", "FAILED", "REVERTED"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(s)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                        statusFilter === s
                          ? "border-zinc-500/60 bg-zinc-700/30 text-zinc-200"
                          : "border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"
                      }`}
                    >
                      {s !== "ALL" && (
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[s].dotClass}`} />
                      )}
                      <span>{s === "ALL" ? "All" : STATUS_CONFIG[s].label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tax Summary Panel ───────────────────────────────── */}
      <AnimatePresence>
        {showTaxPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <PersonalTaxSummary />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Summary Stats ───────────────────────────────────── */}
      {records.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <StatCard
            label="Trades"
            value={String(stats.completedCount)}
            sub={`of ${pagination.total} total`}
          />
          <StatCard
            label="Volume"
            value={showNok ? "—" : formatUsd(stats.totalVolume)}
            sub="this page"
          />
          <StatCard
            label="P&L"
            value={showNok ? formatNok(stats.totalGainNok) : formatUsd(stats.totalGainUsd)}
            sub="realized"
            positive={stats.totalGainUsd > 0}
            negative={stats.totalGainUsd < 0}
          />
          <StatCard
            label="Fees"
            value={formatUsd(stats.totalFees)}
            sub="total paid"
          />
        </div>
      )}

      {/* ── Records List ────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/20 overflow-hidden">
        {loading && records.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <FiRefreshCw className="h-5 w-5 text-zinc-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-xs text-red-400">{error}</p>
            <button
              type="button"
              onClick={() => fetchRecords(1)}
              className="text-[11px] text-zinc-400 hover:text-zinc-200 underline"
            >
              Retry
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <FiClock className="h-6 w-6 text-zinc-700" />
            <p className="text-xs text-zinc-500">No trades found</p>
            <p className="text-[10px] text-zinc-600">
              Trade history will appear here once you make your first trade.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/40">
            {records.map((record, idx) => (
              <TradeRow
                key={record.id}
                record={record}
                showNok={showNok}
                isLast={idx === records.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] text-zinc-500">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => fetchRecords(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30 transition-colors"
            >
              <FiChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => fetchRecords(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30 transition-colors"
            >
              <FiChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  positive,
  negative,
}: {
  label: string;
  value: string;
  sub: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-3 py-2">
      <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</p>
      <p
        className={`text-sm font-bold leading-tight mt-0.5 ${
          positive ? "text-emerald-400" : negative ? "text-red-400" : "text-zinc-200"
        }`}
      >
        {value}
      </p>
      <p className="text-[9px] text-zinc-600 mt-0.5">{sub}</p>
    </div>
  );
}

function TradeRow({
  record,
  showNok,
  isLast,
}: {
  record: TradeRecord;
  showNok: boolean;
  isLast: boolean;
}) {
  const modeConf = MODE_CONFIG[record.mode];
  const statusConf = STATUS_CONFIG[record.status];
  const explorerUrl = record.txHash
    ? getExplorerUrl(record.txHash, record.sellChainId)
    : null;

  const gainLoss = showNok ? record.gainLossNok : record.gainLossUsd;
  const isProfit = gainLoss != null && gainLoss > 0;
  const isLoss = gainLoss != null && gainLoss < 0;

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800/30 transition-colors ${
        isLast ? "" : ""
      }`}
    >
      {/* Mode badge */}
      <div
        className={`flex items-center justify-center w-7 h-7 rounded-lg ${modeConf.bgClass} ${modeConf.textClass} shrink-0`}
        title={modeConf.label}
      >
        {modeConf.icon}
      </div>

      {/* Trade pair */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-semibold text-zinc-200 truncate">
            {record.sellToken ?? "???"}
          </span>
          <span className="text-zinc-600 text-[10px]">
            {formatAmount(record.sellDisplayAmt)}
          </span>
          <FiArrowRight className="h-2.5 w-2.5 text-zinc-600 shrink-0" />
          <span className="font-semibold text-zinc-200 truncate">
            {record.buyToken ?? "???"}
          </span>
          <span className="text-zinc-600 text-[10px]">
            {formatAmount(record.buyDisplayAmt)}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          {/* Status dot */}
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusConf.dotClass}`} />
          <span className="text-[10px] text-zinc-500">{statusConf.label}</span>

          {/* Time */}
          <span className="text-[10px] text-zinc-600" title={new Date(record.executedAt).toLocaleString()}>
            {formatDate(record.executedAt)} · {formatTime(record.executedAt)}
          </span>

          {/* Tx hash */}
          {record.txHash && (
            explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-[10px] text-zinc-500 hover:text-sky-400 transition-colors font-mono"
              >
                {truncateHash(record.txHash)}
                <FiExternalLink className="h-2.5 w-2.5" />
              </a>
            ) : (
              <span className="text-[10px] text-zinc-600 font-mono">
                {truncateHash(record.txHash)}
              </span>
            )
          )}
        </div>
      </div>

      {/* Price + P&L */}
      <div className="text-right shrink-0">
        <p className="text-[11px] text-zinc-300 font-medium">
          {showNok ? formatNok(record.priceNok) : formatUsd(record.priceUsd)}
        </p>
        {gainLoss != null && (
          <div className="flex items-center justify-end gap-0.5 mt-0.5">
            {isProfit ? (
              <TrendingUp className="h-2.5 w-2.5 text-emerald-400" />
            ) : isLoss ? (
              <TrendingDown className="h-2.5 w-2.5 text-red-400" />
            ) : (
              <Minus className="h-2.5 w-2.5 text-zinc-500" />
            )}
            <span
              className={`text-[10px] font-semibold ${
                isProfit ? "text-emerald-400" : isLoss ? "text-red-400" : "text-zinc-500"
              }`}
            >
              {isProfit && "+"}
              {showNok ? formatNok(gainLoss) : formatUsd(gainLoss)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
