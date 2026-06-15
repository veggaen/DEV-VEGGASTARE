"use client";

/**
 * @fileOverview  Trading Hub — unified trading page that integrates all trade modes:
 *                 P2P trading, internal wallet transfers, DEX swaps,
 *                 paper trading, and local-chain operations.
 *
 *   Layout:
 *     ┌─────────────────────────────────────────────────────────────┐
 *     │  Header: Trading Hub │ Mode Switcher │ Search / Actions     │
 *     ├────────────────────────┬──────────────────────────────────────┤
 *     │  Inventory Grid        │  Trade Panel (mode-dependent)       │
 *     │  (tokens + NFTs)       │  • P2P: OsrsTradeWindow            │
 *     │                        │  • Self: Internal transfer          │
 *     │                        │  • DEX: Swap panel (KyberSwap)      │
 *     │                        │  • Paper: PaperSwapPanel            │
 *     │                        │  • Local: Local chain ops           │
 *     └────────────────────────┴──────────────────────────────────────┘
 *
 * @stability experimental
 */

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { OsrsInventory } from "@/components/crypto-related/OsrsInventory";
import {
  OsrsTradeWindow,
  type TradePartner,
} from "@/components/crypto-related/OsrsTradeWindow";
import { useAccount, useConnections } from "wagmi";
import { useWalletAddressBook } from "@/hooks/use-wallet-address-book";
import { useTradeMode, MODE_META, MODE_ORDER, type TradeMode } from "@/contexts/trade-mode-context";
import {
  FiPackage,
  FiAlertCircle,
  FiSearch,
  FiUserPlus,
  FiX,
  FiWifi,
  FiBookOpen,
  FiRefreshCw,
  FiClock,
} from "react-icons/fi";
import { ArrowLeftRight, Zap, FileText, Monitor, Users, Repeat } from "lucide-react";
import { DexSwapPanel } from "@/components/crypto-related/DexSwapPanel";
import { TradeHistory } from "@/components/crypto-related/TradeHistory";

// ── Mode icons mapping ──────────────────────────────────────────────────────

const MODE_ICONS: Record<TradeMode, React.ReactNode> = {
  p2p:        <Users className="h-3.5 w-3.5" />,
  self:       <ArrowLeftRight className="h-3.5 w-3.5" />,
  dex:        <Repeat className="h-3.5 w-3.5" />,
  paper:      <FileText className="h-3.5 w-3.5" />,
  localchain: <Monitor className="h-3.5 w-3.5" />,
};

const MODE_COLORS: Record<TradeMode, string> = {
  p2p:        "emerald",
  self:       "purple",
  dex:        "sky",
  paper:      "amber",
  localchain: "orange",
};

const MODE_RING_CLASSES: Record<TradeMode, string> = {
  p2p:        "ring-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  self:       "ring-purple-500/20 bg-purple-500/10 text-purple-400",
  dex:        "ring-sky-500/20 bg-sky-500/10 text-sky-400",
  paper:      "ring-amber-500/20 bg-amber-500/10 text-amber-400",
  localchain: "ring-orange-500/20 bg-orange-500/10 text-orange-400",
};

const MODE_BTN_ACTIVE: Record<TradeMode, string> = {
  p2p:        "border-emerald-500/60 bg-emerald-500/10 text-emerald-300",
  self:       "border-purple-500/60 bg-purple-500/10 text-purple-300",
  dex:        "border-sky-500/60 bg-sky-500/10 text-sky-300",
  paper:      "border-amber-500/60 bg-amber-500/10 text-amber-300",
  localchain: "border-orange-500/60 bg-orange-500/10 text-orange-300",
};

type UserSearchResult = {
  id: string;
  name: string | null;
  image: string | null;
  email: string | null;
};

export default function TradingPage() {
  const { isConnected } = useAccount();
  const connections = useConnections();
  const addressBook = useWalletAddressBook();
  const { mode, setMode, modeLabel, isSimulated } = useTradeMode();

  // Trade state
  const [tradePartner, setTradePartner] = useState<TradePartner | null>(null);
  const [activeTradeId, setActiveTradeId] = useState<string | null>(null);
  const [selfTradeOpen, setSelfTradeOpen] = useState(false);
  const [partnerQuery, setPartnerQuery] = useState("");
  const [partnerResults, setPartnerResults] = useState<UserSearchResult[]>([]);
  const [searchingPartners, setSearchingPartners] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Auto-open correct trade panel when mode changes
  useEffect(() => {
    if (mode === "self") {
      setTradePartner(null);
      setSelfTradeOpen(true);
    } else if (mode === "p2p") {
      setSelfTradeOpen(false);
    } else {
      // DEX, paper, localchain — close OSRS trade window, show mode panel instead
      setTradePartner(null);
      setSelfTradeOpen(false);
    }
    setActiveTradeId(null);
  }, [mode]);

  // Partner search (debounced)
  useEffect(() => {
    if (partnerQuery.trim().length < 2) {
      setPartnerResults([]);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setSearchingPartners(true);
      try {
        const params = new URLSearchParams({
          q: partnerQuery.trim(),
          limit: "6",
          excludeSelf: "true",
        });
        const res = await fetch(`/api/users/search?${params.toString()}`);
        if (!res.ok) {
          setPartnerResults([]);
          return;
        }
        const data = (await res.json()) as { users?: UserSearchResult[] };
        setPartnerResults(Array.isArray(data.users) ? data.users : []);
      } catch {
        setPartnerResults([]);
      } finally {
        setSearchingPartners(false);
      }
    }, 260);

    return () => window.clearTimeout(timeoutId);
  }, [partnerQuery]);

  const uniqueAddresses = new Set(
    connections.flatMap((c) => c.accounts.map((a) => a.toLowerCase())),
  );
  const hasMultipleWallets = uniqueAddresses.size >= 2;

  const handleCloseTradeWindow = useCallback(() => {
    setTradePartner(null);
    setActiveTradeId(null);
    setSelfTradeOpen(false);
  }, []);

  // Whether any trade panel is showing
  const showOsrsTrade = (mode === "p2p" && !!tradePartner) || (mode === "self" && selfTradeOpen) || (mode === "localchain" && (!!tradePartner || selfTradeOpen));
  const showModePanel = mode === "dex" || mode === "paper";
  const showTrade = showOsrsTrade || showModePanel;
  // Always show the right trade panel area for 2-column layout
  const alwaysShowTradeArea = true;

  /* ── Not connected — but paper mode works without wallet ────── */
  if (!isConnected && mode !== "paper") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="relative mb-6">
          <div className="h-20 w-20 rounded-2xl bg-zinc-900/40 flex items-center justify-center">
            <FiWifi className="h-8 w-8 text-zinc-600" />
          </div>
          <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-amber-500/10 flex items-center justify-center">
            <FiAlertCircle className="h-3.5 w-3.5 text-amber-400" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-zinc-200 mb-1">
          Wallet Not Connected
        </h2>
        <p className="text-sm text-zinc-400 text-center max-w-sm mb-4">
          Connect a wallet from the sidebar to view your inventory and start trading.
        </p>
        <button
          type="button"
          onClick={() => setMode("paper")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          <FileText className="h-4 w-4" />
          Try Paper Trading (no wallet needed)
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-zinc-950">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 shrink-0 bg-zinc-950/80 backdrop-blur-xl">
        {/* Top row: title + actions */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${MODE_RING_CLASSES[mode].split('ring-')[0]}`}>
              {MODE_ICONS[mode]}
            </div>
            <div>
              <h1 className="text-sm font-bold text-zinc-200 leading-tight">
                Trading Hub
              </h1>
              <p className="text-[10px] text-zinc-500 leading-tight">
                {modeLabel}
                {isSimulated && " · Simulated"}
              </p>
            </div>
          </div>

          {/* ── Right side actions ────────────────────────── */}
          <div className="flex items-center gap-2">
          {/* Partner search — only in P2P mode */}
          {mode === "p2p" && !tradePartner && (
            <div className="relative">
              <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={partnerQuery}
                onChange={(event) => setPartnerQuery(event.target.value)}
                placeholder="Search user to trade..."
                className="w-44 sm:w-56 rounded-lg border border-zinc-700/60 bg-zinc-900/60 pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:w-64 transition-all"
              />

              {partnerQuery.trim().length >= 2 && (
                <div className="absolute top-[calc(100%+4px)] right-0 z-40 w-72 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
                  {/* Address book matches */}
                  {(() => {
                    const abResults = addressBook.search(partnerQuery.trim(), 3);
                    if (abResults.length === 0) return null;
                    return (
                      <>
                        <div className="px-3 py-1 text-[9px] uppercase tracking-widest text-zinc-600 bg-zinc-950/50 flex items-center gap-1">
                          <FiBookOpen className="h-2.5 w-2.5" />
                          Address Book
                        </div>
                        {abResults.map((entry) => (
                          <button
                            key={entry.address}
                            type="button"
                            onClick={() => {
                              setTradePartner({
                                id: entry.address,
                                name: entry.nickname,
                                image: null,
                                walletAddress: entry.address,
                              });
                              setActiveTradeId(null);
                              setSelfTradeOpen(false);
                              setPartnerQuery("");
                              setPartnerResults([]);
                            }}
                            className="w-full px-3 py-2 text-left text-xs hover:bg-emerald-800/20 transition-colors"
                          >
                            <p className="font-medium text-emerald-300 truncate">{entry.nickname}</p>
                            <p className="text-zinc-500 truncate text-[10px] font-mono">
                              {entry.address.slice(0, 10)}…{entry.address.slice(-6)}
                            </p>
                          </button>
                        ))}
                      </>
                    );
                  })()}

                  {/* User search results */}
                  {searchingPartners && (
                    <p className="px-3 py-2 text-[11px] text-zinc-500">Searching…</p>
                  )}
                  {!searchingPartners && partnerResults.length === 0 && addressBook.search(partnerQuery.trim(), 1).length === 0 && (
                    <p className="px-3 py-2 text-[11px] text-zinc-500">No users found</p>
                  )}
                  {!searchingPartners && partnerResults.length > 0 && (
                    <div className="px-3 py-1 text-[9px] uppercase tracking-widest text-zinc-600 bg-zinc-950/50">
                      Users
                    </div>
                  )}
                  {!searchingPartners &&
                    partnerResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setTradePartner({ id: user.id, name: user.name, image: user.image });
                          setActiveTradeId(null);
                          setSelfTradeOpen(false);
                          setPartnerQuery("");
                          setPartnerResults([]);
                        }}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800/80 transition-colors"
                      >
                        <p className="font-medium text-zinc-200 truncate">{user.name ?? "Unknown user"}</p>
                        <p className="text-zinc-500 truncate text-[10px]">{user.email ?? user.id}</p>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Self-trade quick open — in p2p/localchain modes */}
          {(mode === "p2p" || mode === "localchain") && !showTrade && hasMultipleWallets && (
            <button
              type="button"
              onClick={() => { setTradePartner(null); setSelfTradeOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/15 border border-purple-700/30 text-xs font-semibold text-purple-300 hover:bg-purple-600/25 hover:border-purple-600/50 transition-all"
              title="Transfer between your connected wallets"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>Transfer</span>
            </button>
          )}

          {/* Active partner badge */}
          {tradePartner && (mode === "p2p" || mode === "localchain") && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-700/60 bg-emerald-900/20 text-[11px] text-emerald-300">
              <FiUserPlus className="h-3 w-3" />
              <span className="max-w-24 truncate">{tradePartner.name ?? "Partner"}</span>
              <button
                type="button"
                onClick={handleCloseTradeWindow}
                className="rounded p-0.5 hover:bg-emerald-800/40"
                aria-label="Clear selected partner"
              >
                <FiX className="h-2.5 w-2.5" />
              </button>
            </div>
          )}

          {/* Close trade panel */}
          {showOsrsTrade && (
            <button
              type="button"
              onClick={handleCloseTradeWindow}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-all"
            >
              <FiX className="h-3 w-3" />
              Close Trade
            </button>
          )}

          {/* History toggle */}
          <button
            type="button"
            onClick={() => setShowHistory((p) => !p)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              showHistory
                ? "border-sky-500/50 bg-sky-500/10 text-sky-400"
                : "border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            }`}
            title="Trade History"
          >
            <FiClock className="h-3 w-3" />
            History
          </button>
          </div>
        </div>

        {/* Mode Switcher — flat tab bar */}
        <div className="px-4 sm:px-6 pb-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-0.5">
            {MODE_ORDER.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                  mode === m
                    ? MODE_BTN_ACTIVE[m]
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                }`}
                title={MODE_META[m].label}
              >
                {MODE_ICONS[m]}
                <span>{MODE_META[m].label}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 h-px bg-zinc-800/40" />
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 lg:p-6">
        <AnimatePresence mode="wait">
        {showHistory ? (
          /* ── Trade History View ─────────────────────── */
          <motion.div
            key="history-panel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <TradeHistory onClose={() => setShowHistory(false)} />
          </motion.div>
        ) : (
          /* ── Normal Trading View ────────────────────── */
          <motion.div
            key="trading-panel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
        <div
          className="grid gap-4 lg:gap-5 items-start lg:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr]"
        >
          {/* ── Inventory panel ─────────────────────────── */}
          {(isConnected || mode !== "paper") && (
            <section className="min-h-0">
              <div className="pb-2 flex items-center gap-2">
                <FiPackage className="h-3.5 w-3.5 text-zinc-500" />
                <h2 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Inventory</h2>
              </div>
              <div>
                <OsrsInventory
                  tradeMode={showOsrsTrade}
                  onAddToTrade={showOsrsTrade ? (slot) => {
                    window.dispatchEvent(
                      new CustomEvent("veggat:addToTrade", { detail: slot })
                    );
                  } : undefined}
                />
              </div>
            </section>
          )}

          {/* ── Trade panels — mode-dependent ──────── */}
          <section className="min-h-0">
          <AnimatePresence mode="wait">
            {/* P2P / Self / Local Chain → OSRS Trade Window */}
            {showOsrsTrade && (
              <motion.div
                key="osrs-trade"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <OsrsTradeWindow
                  partner={tradePartner}
                  tradeId={activeTradeId ?? undefined}
                  selfTrade={selfTradeOpen || mode === "self"}
                  onClose={handleCloseTradeWindow}
                  onComplete={() => {
                    setActiveTradeId(null);
                    setTradePartner(null);
                    setSelfTradeOpen(false);
                  }}
                />
              </motion.div>
            )}

            {/* DEX Mode → DEX Swap Panel */}
            {mode === "dex" && (
              <motion.div
                key="dex-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <DexSwapPanel />
              </motion.div>
            )}

            {/* Paper Mode → Paper Swap Panel */}
            {mode === "paper" && (
              <motion.div
                key="paper-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <PaperTradingInline />
              </motion.div>
            )}

            {/* Empty state — always visible when no trade panel is active */}
            {!showTrade && (
              <motion.div
                key="trade-empty"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex flex-col items-center justify-center min-h-70 py-12 px-6 gap-3">
                  <div className="h-12 w-12 rounded-xl bg-zinc-800/20 flex items-center justify-center">
                    <ArrowLeftRight className="h-5 w-5 text-zinc-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-400">No Active Trade</h3>
                  <p className="text-[11px] text-zinc-500 text-center max-w-xs leading-relaxed">
                    {mode === "p2p" || mode === "localchain"
                      ? "Search for a user above to start a P2P trade, or click Transfer for an internal swap."
                      : mode === "self"
                        ? "Open a transfer window to move tokens between your connected wallets."
                        : "Select a trade mode to get started."}
                  </p>
                  <p className="text-[9px] text-zinc-600 mt-1">
                    💡 Drag items from inventory or <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[8px]">Shift</kbd>+click to add
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </section>
        </div>
          </motion.div>
        )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Inline Sub-panels (embedded right in the trading page) ───────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Paper Trading Inline — compact version that lives inside the trading page.
 * Links to the full paper trading dashboard for portfolio management.
 */
function PaperTradingInline() {
  return (
    <div className="w-full max-w-md space-y-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-zinc-200">Paper Trading</h3>
          <span className="text-[9px] font-semibold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-1.5 py-0.5 rounded">
            Simulated
          </span>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Trade crypto with virtual USD at real market prices. Zero risk, real learning.
          Track your P&L, sharpen your strategy, then go live.
        </p>
        <div className="space-y-2 py-2">
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Prices</span>
            <span className="text-zinc-400">CoinGecko (live)</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Fee simulation</span>
            <span className="text-zinc-400">0.3% (like Uniswap V3)</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Daily limit</span>
            <span className="text-zinc-400">200 trades/day</span>
          </div>
        </div>
        <a
          href="/dashboard/paper-trading"
          className="flex items-center justify-center gap-2 w-full rounded-lg bg-amber-500/10 py-2.5 text-sm font-semibold text-amber-400 hover:bg-amber-500/15 transition-colors"
        >
          <FileText className="h-4 w-4" />
          Open Paper Trading Dashboard
        </a>
      </div>
    </div>
  );
}
