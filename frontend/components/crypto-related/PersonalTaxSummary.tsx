/**
 * @fileOverview  PersonalTaxSummary — shows personal crypto trade tax info
 *                derived from TradeRecord data. Norwegian Skatteetaten compatible.
 *                Displays annual gain/loss, cost basis method, and export triggers.
 *
 *   NOT a full tax calculator — the existing TaxHelperDashboard handles company
 *   tax. This is the individual user's crypto-specific view.
 *
 * @stability experimental
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiFileText,
  FiDownload,
  FiExternalLink,
  FiRefreshCw,
  FiAlertTriangle,
  FiSettings,
  FiCheck,
} from "react-icons/fi";
import { TrendingUp, TrendingDown, Calculator, Shield } from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────

interface TaxSummary {
  taxYear: number;
  totalTradesCount: number;
  completedTradesCount: number;
  totalGainUsd: number;
  totalGainNok: number;
  totalLossUsd: number;
  totalLossNok: number;
  netGainUsd: number;
  netGainNok: number;
  totalFeesUsd: number;
  totalFeesNok: number;
  exportedCount: number;
  unexportedCount: number;
}

type CostBasisMethod = "FIFO" | "AVERAGE";

// ── Constants ───────────────────────────────────────────────────────────────

const CRYPTO_TAX_RATE = 0.22; // 22% capital gains for Norway
const SKATTEETATEN_CRYPTO_URL =
  "https://www.skatteetaten.no/en/person/taxes/get-the-taxes-right/virtual-assets/";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatNok(val: number): string {
  return `${val.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;
}

function formatUsd(val: number): string {
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Component ───────────────────────────────────────────────────────────────

export function PersonalTaxSummary() {
  const currentYear = new Date().getFullYear();
  const [taxYear, setTaxYear] = useState(currentYear);
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [costBasisMethod, setCostBasisMethod] = useState<CostBasisMethod>("FIFO");
  const [showSettings, setShowSettings] = useState(false);
  const [savingMethod, setSavingMethod] = useState(false);

  // Fetch summary for selected year
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/trades/tax-summary?taxYear=${taxYear}`);
      if (!res.ok) throw new Error("Failed to load tax data");

      const data = await res.json();
      const s = data.summary;

      setSummary({
        taxYear: s.taxYear,
        totalTradesCount: s.totalTradesCount,
        completedTradesCount: s.completedTradesCount,
        totalGainUsd: s.totalGainUsd,
        totalGainNok: s.totalGainNok,
        totalLossUsd: s.totalLossUsd,
        totalLossNok: s.totalLossNok,
        netGainUsd: s.netGainUsd,
        netGainNok: s.netGainNok,
        totalFeesUsd: s.totalFeesUsd,
        totalFeesNok: s.totalFeesNok,
        exportedCount: s.exportedCount,
        unexportedCount: s.unexportedCount,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [taxYear]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleSaveMethod = async (method: CostBasisMethod) => {
    setSavingMethod(true);
    try {
      await fetch("/api/system/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxCostBasisMethod: method }),
      });
      setCostBasisMethod(method);
    } catch {
      // Silent fail — non-critical
    } finally {
      setSavingMethod(false);
    }
  };

  const estimatedTaxNok = summary
    ? Math.max(0, summary.netGainNok) * CRYPTO_TAX_RATE
    : 0;

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/20 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Calculator className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-200">Crypto Tax Summary</h3>
            <p className="text-[9px] text-zinc-500">Skatteetaten · RF-1159</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Year selector */}
          <select
            value={taxYear}
            onChange={(e) => setTaxYear(Number(e.target.value))}
            className="rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-2 py-1 text-[10px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
          >
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {/* Settings */}
          <button
            type="button"
            onClick={() => setShowSettings((p) => !p)}
            className={`p-1.5 rounded-lg border transition-colors ${
              showSettings
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-700/60 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FiSettings className="h-3 w-3" />
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={fetchSummary}
            disabled={loading}
            className="p-1.5 rounded-lg border border-zinc-700/60 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <FiRefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-zinc-800/40"
          >
            <div className="p-3 space-y-2">
              <p className="text-[10px] text-zinc-400 font-semibold">Cost Basis Method</p>
              <div className="flex gap-2">
                {(["FIFO", "AVERAGE"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => handleSaveMethod(method)}
                    disabled={savingMethod}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors ${
                      costBasisMethod === method
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                        : "border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                    }`}
                  >
                    {costBasisMethod === method && <FiCheck className="h-2.5 w-2.5" />}
                    {method === "FIFO" ? "FIFO" : "Average Cost"}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-zinc-600">
                Both methods are accepted by Skatteetaten. FIFO is standard.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="p-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <FiRefreshCw className="h-4 w-4 text-zinc-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        ) : !summary || summary.completedTradesCount === 0 ? (
          <div className="text-center py-8 space-y-2">
            <FiFileText className="h-6 w-6 text-zinc-700 mx-auto" />
            <p className="text-xs text-zinc-500">No trades for {taxYear}</p>
            <p className="text-[10px] text-zinc-600">
              Trade records will appear here to help with tax reporting.
            </p>
          </div>
        ) : (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              {/* Gains */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                  <span className="text-[9px] uppercase tracking-wider text-emerald-500 font-semibold">
                    Gains
                  </span>
                </div>
                <p className="text-sm font-bold text-emerald-300">
                  {formatNok(summary.totalGainNok)}
                </p>
                <p className="text-[9px] text-zinc-500">
                  {formatUsd(summary.totalGainUsd)}
                </p>
              </div>

              {/* Losses */}
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingDown className="h-3 w-3 text-red-400" />
                  <span className="text-[9px] uppercase tracking-wider text-red-500 font-semibold">
                    Losses
                  </span>
                </div>
                <p className="text-sm font-bold text-red-300">
                  {formatNok(summary.totalLossNok)}
                </p>
                <p className="text-[9px] text-zinc-500">
                  {formatUsd(summary.totalLossUsd)}
                </p>
              </div>

              {/* Net */}
              <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 px-3 py-2">
                <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-1">
                  Net Gain/Loss
                </p>
                <p
                  className={`text-sm font-bold ${
                    summary.netGainNok >= 0 ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {summary.netGainNok >= 0 ? "+" : ""}
                  {formatNok(summary.netGainNok)}
                </p>
              </div>

              {/* Estimated tax */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                <div className="flex items-center gap-1 mb-1">
                  <Shield className="h-3 w-3 text-amber-400" />
                  <span className="text-[9px] uppercase tracking-wider text-amber-500 font-semibold">
                    Est. Tax (22%)
                  </span>
                </div>
                <p className="text-sm font-bold text-amber-300">
                  {formatNok(estimatedTaxNok)}
                </p>
                <p className="text-[9px] text-zinc-600">
                  Capital gains tax on crypto
                </p>
              </div>
            </div>

            {/* Meta info */}
            <div className="flex items-center justify-between text-[9px] text-zinc-500">
              <span>{summary.completedTradesCount} completed trades</span>
              <span>
                {summary.unexportedCount > 0
                  ? `${summary.unexportedCount} not yet exported`
                  : "All exported"}
              </span>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <FiAlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[9px] text-zinc-400 leading-relaxed">
                <p>
                  <strong className="text-zinc-300">Estimation only</strong> — not
                  tax advice. Verify with{" "}
                  <a
                    href={SKATTEETATEN_CRYPTO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    Skatteetaten
                    <FiExternalLink className="h-2 w-2" />
                  </a>{" "}
                  or a tax professional.
                </p>
              </div>
            </div>

            {/* Export button */}
            <button
              type="button"
              onClick={() => {
                // Trigger CSV export from TradeHistory API with taxYear filter
                window.open(
                  `/api/trades/history?taxYear=${taxYear}&limit=10000&status=COMPLETED`,
                  "_blank"
                );
              }}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-zinc-800/60 border border-zinc-700/60 py-2 text-[11px] font-semibold text-zinc-300 hover:bg-zinc-700/60 transition-colors"
            >
              <FiDownload className="h-3 w-3" />
              Export {taxYear} Trade Data (JSON)
            </button>
          </>
        )}
      </div>
    </div>
  );
}
