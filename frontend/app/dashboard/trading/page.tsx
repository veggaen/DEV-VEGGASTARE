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
import { useActiveWalletOverride } from "@/contexts/active-wallet-context";
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
  p2p:        "ring-brand-accent/20 bg-brand-accent/10 text-brand-accent",
  self:       "ring-purple-500/20 bg-purple-500/10 text-purple-400",
  dex:        "ring-brand-accent/20 bg-brand-accent/10 text-brand-accent",
  paper:      "ring-amber-500/20 bg-amber-500/10 text-amber-400",
  localchain: "ring-orange-500/20 bg-orange-500/10 text-orange-400",
};

const MODE_BTN_ACTIVE: Record<TradeMode, string> = {
  p2p:        "ring-1 ring-inset ring-brand-accent/30 bg-brand-accent/12 text-brand-accent-hover dark:text-brand-accent-light",
  self:       "ring-1 ring-inset ring-purple-500/30 bg-purple-500/12 text-purple-700 dark:text-purple-300",
  dex:        "ring-1 ring-inset ring-brand-accent/30 bg-brand-accent/12 text-brand-accent-hover dark:text-brand-accent-light",
  paper:      "ring-1 ring-inset ring-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-300",
  localchain: "ring-1 ring-inset ring-orange-500/30 bg-orange-500/12 text-orange-700 dark:text-orange-300",
};

type UserSearchResult = {
  id: string;
  name: string | null;
  image: string | null;
  email: string | null;
};

export default function TradingPage() {
  const { isConnected } = useAccount();
  // A local dev-chain account activated from the wallet panel (Ganache/Anvil
  // "temporary wallet") is a usable wallet here even without an injected one:
  // the inventory and the trade window already read the same override.
  const { override } = useActiveWalletOverride();
  const walletReady = isConnected || Boolean(override);
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
  if (!walletReady && mode !== "paper") {
    return (
      <section aria-labelledby="trading-empty-title" className="page-rise flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="relative mb-6">
          <div className="grid size-20 place-items-center rounded-2xl bg-foreground/[0.05] ring-1 ring-border/60">
            <FiWifi className="size-8 text-muted-foreground" />
          </div>
          <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-amber-500/15 ring-1 ring-amber-500/30">
            <FiAlertCircle className="size-3.5 text-amber-600 dark:text-amber-300" />
          </span>
        </div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-accent-hover dark:text-brand-accent-light">Trading</p>
        <h2 id="trading-empty-title" className="text-xl font-semibold tracking-tight text-foreground">No wallet connected</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Connect a wallet from the account menu to see your inventory and trade with others, or try paper trading with no wallet at all.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setMode("paper")}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-accent px-5 text-sm font-semibold text-brand-accent-foreground shadow-e2 transition-[background-color,transform,box-shadow] duration-200 hover:bg-brand-accent-hover hover:shadow-[0_8px_30px_-12px_hsl(var(--brand-accent)/0.6)] motion-safe:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <FileText className="size-4" />
            Try paper trading
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("veggat:open-menu"))}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border/60 bg-surface-1/75 px-5 text-sm font-medium text-foreground backdrop-blur-xl transition-[border-color,background-color,transform] duration-200 hover:border-border hover:bg-foreground/[0.06] motion-safe:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Connect a wallet
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-surface-1">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 shrink-0 bg-surface-1/80 backdrop-blur-xl">
        {/* Top row: title + actions */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${MODE_RING_CLASSES[mode].split('ring-')[0]}`}>
              {MODE_ICONS[mode]}
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight text-foreground">
                Trading
              </h1>
              <p className="text-[10px] text-muted-foreground leading-tight">
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
              <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={partnerQuery}
                onChange={(event) => setPartnerQuery(event.target.value)}
                placeholder="Search user to trade..."
                className="w-44 sm:w-56 rounded-lg border border-border/60 bg-surface-3/60 pl-8 pr-3 py-1.5 text-xs text-foreground/80 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/40 focus:w-64 transition"
              />

              {partnerQuery.trim().length >= 2 && (
                <div className="absolute top-[calc(100%+4px)] right-0 z-40 w-72 rounded-xl border border-border bg-surface-3 shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
                  {/* Address book matches */}
                  {(() => {
                    const abResults = addressBook.search(partnerQuery.trim(), 3);
                    if (abResults.length === 0) return null;
                    return (
                      <>
                        <div className="px-3 py-1 text-[9px] uppercase tracking-widest text-muted-foreground bg-surface-1/50 flex items-center gap-1">
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
                            className="w-full px-3 py-2 text-left text-xs hover:bg-brand-accent/20 transition-colors"
                          >
                            <p className="font-medium text-brand-accent-light truncate">{entry.nickname}</p>
                            <p className="text-muted-foreground truncate text-[10px] font-mono">
                              {entry.address.slice(0, 10)}…{entry.address.slice(-6)}
                            </p>
                          </button>
                        ))}
                      </>
                    );
                  })()}

                  {/* User search results */}
                  {searchingPartners && (
                    <p className="px-3 py-2 text-[11px] text-muted-foreground">Searching…</p>
                  )}
                  {!searchingPartners && partnerResults.length === 0 && addressBook.search(partnerQuery.trim(), 1).length === 0 && (
                    <p className="px-3 py-2 text-[11px] text-muted-foreground">No users found</p>
                  )}
                  {!searchingPartners && partnerResults.length > 0 && (
                    <div className="px-3 py-1 text-[9px] uppercase tracking-widest text-muted-foreground bg-surface-1/50">
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
                        className="w-full px-3 py-2 text-left text-xs hover:bg-foreground/[0.09] transition-colors"
                      >
                        <p className="font-medium text-foreground/80 truncate">{user.name ?? "Unknown user"}</p>
                        <p className="text-muted-foreground truncate text-[10px]">{user.email ?? user.id}</p>
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/15 border border-purple-700/30 text-xs font-semibold text-purple-300 hover:bg-purple-600/25 hover:border-purple-600/50 transition"
              title="Transfer between your connected wallets"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>Transfer</span>
            </button>
          )}

          {/* Active partner badge */}
          {tradePartner && (mode === "p2p" || mode === "localchain") && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-brand-accent/60 bg-brand-accent/20 text-[11px] text-brand-accent-light">
              <FiUserPlus className="h-3 w-3" />
              <span className="max-w-24 truncate">{tradePartner.name ?? "Partner"}</span>
              <button
                type="button"
                onClick={handleCloseTradeWindow}
                className="rounded p-0.5 hover:bg-brand-accent/40"
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
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground/80 transition"
            >
              <FiX className="h-3 w-3" />
              Close Trade
            </button>
          )}

          {/* History toggle */}
          <button
            type="button"
            onClick={() => setShowHistory((p) => !p)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border ${
              showHistory
                ? "border-brand-accent/50 bg-brand-accent/10 text-brand-accent"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground/80"
            }`}
          >
            <FiClock className="h-3 w-3" />
            History
          </button>
          </div>
        </div>

        {/* Mode Switcher — flat tab bar */}
        <div className="no-scrollbar flex justify-center overflow-x-auto px-4 pb-3 sm:px-6">
          <div role="tablist" aria-label="Trading mode" className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border/60 bg-surface-1/75 p-1 shadow-e1 backdrop-blur-xl">
            {MODE_ORDER.map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12px] font-medium transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  mode === m
                    ? `${MODE_BTN_ACTIVE[m]} shadow-[0_0_24px_-6px_hsl(var(--brand-accent)/0.45)]`
                    : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                }`}
              >
                {MODE_ICONS[m]}
                <span>{MODE_META[m].label}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 h-px bg-foreground/[0.05]" />
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────── */}
      <section aria-label="Trading workspace" className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 lg:p-6">
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
          {(walletReady || mode !== "paper") && (
            <section className="min-h-0">
              <div className="pb-2 flex items-center gap-2">
                <FiPackage className="h-3.5 w-3.5 text-muted-foreground" />
                <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Inventory</h2>
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
                  <div className="h-12 w-12 rounded-xl bg-foreground/[0.03] flex items-center justify-center">
                    <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-semibold text-muted-foreground">No Active Trade</h3>
                  <p className="text-[11px] text-muted-foreground text-center max-w-xs leading-relaxed">
                    {mode === "p2p" || mode === "localchain"
                      ? "Search for a user above to start a P2P trade, or click Transfer for an internal swap."
                      : mode === "self"
                        ? "Open a transfer window to move tokens between your connected wallets."
                        : "Select a trade mode to get started."}
                  </p>
                  <p className="text-[9px] text-muted-foreground mt-1">
                    💡 Drag items from inventory or <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[8px]">Shift</kbd>+click to add
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
      </section>
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
          <h3 className="text-sm font-semibold text-foreground/80">Paper Trading</h3>
          <span className="text-[9px] font-semibold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-1.5 py-0.5 rounded">
            Simulated
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Trade crypto with virtual USD at real market prices. Zero risk, real learning.
          Track your P&L, sharpen your strategy, then go live.
        </p>
        <div className="space-y-2 py-2">
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Prices</span>
            <span className="text-muted-foreground">CoinGecko (live)</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Fee simulation</span>
            <span className="text-muted-foreground">0.3% (like Uniswap V3)</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Daily limit</span>
            <span className="text-muted-foreground">200 trades/day</span>
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
