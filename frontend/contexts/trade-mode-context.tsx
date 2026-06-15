"use client";

/**
 * @fileOverview  TradeMode context — unified trading mode for the entire app.
 *
 *   A single context that controls *how* the user trades:
 *     ▸ p2p        – Trade with another user (existing OSRS P2P flow)
 *     ▸ self       – Transfer between your own connected wallets
 *     ▸ dex        – Swap via 0x/Uniswap aggregator (real on-chain)
 *     ▸ paper      – Simulated trades at real prices (virtual USD)
 *     ▸ localchain – Trade/send on local devnets (Anvil, Ganache)
 *
 *   The mode affects:
 *     • Which trade panel is shown in the trade window
 *     • Whether on-chain transactions are executed or simulated
 *     • Which price sources are used
 *     • Whether NFT/token tabs are visible
 *
 * @stability experimental
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

// ── Types ───────────────────────────────────────────────────────────────────

export type TradeMode = "p2p" | "self" | "dex" | "paper" | "localchain";

export interface TradeModeState {
  /** Current active trading mode */
  mode: TradeMode;
  /** Switch to a specific mode */
  setMode: (mode: TradeMode) => void;
  /** Cycle to next mode (for keyboard shortcuts) */
  cycleMode: () => void;
  /** Whether current mode executes real on-chain transactions */
  isOnChain: boolean;
  /** Whether current mode is simulated (paper trading) */
  isSimulated: boolean;
  /** Whether current mode supports NFTs */
  supportsNfts: boolean;
  /** Human-readable label for current mode */
  modeLabel: string;
  /** Color scheme key for current mode */
  modeColor: "emerald" | "purple" | "sky" | "amber" | "orange";
}

// ── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "veggat:tradeMode";
const CUSTOM_EVENT = "veggat:tradeModeChange";

const MODE_ORDER: TradeMode[] = ["p2p", "self", "dex", "paper", "localchain"];

const MODE_META: Record<TradeMode, {
  label: string;
  color: TradeModeState["modeColor"];
  onChain: boolean;
  simulated: boolean;
  nfts: boolean;
}> = {
  p2p:        { label: "P2P Trade",      color: "emerald", onChain: true,  simulated: false, nfts: true  },
  self:       { label: "Internal Transfer", color: "purple",  onChain: true,  simulated: false, nfts: true  },
  dex:        { label: "DEX Swap",       color: "sky",     onChain: true,  simulated: false, nfts: false },
  paper:      { label: "Paper Trade",    color: "amber",   onChain: false, simulated: true,  nfts: false },
  localchain: { label: "Local Chain",    color: "orange",  onChain: true,  simulated: false, nfts: true  },
};

// ── Context ─────────────────────────────────────────────────────────────────

const TradeModeContext = createContext<TradeModeState | null>(null);

export function TradeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeRaw] = useState<TradeMode>(() => {
    if (typeof window === 'undefined') return 'p2p';
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && MODE_ORDER.includes(stored as TradeMode)) return stored as TradeMode;
    } catch { /* SSR or storage unavailable */ }
    return 'p2p';
  });

  // Cross-tab sync
  useEffect(() => {
    function handleCustom(e: Event) {
      const detail = (e as CustomEvent).detail as TradeMode;
      if (detail && MODE_ORDER.includes(detail)) {
        setModeRaw(detail);
      }
    }
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue && MODE_ORDER.includes(e.newValue as TradeMode)) {
        setModeRaw(e.newValue as TradeMode);
      }
    }
    window.addEventListener(CUSTOM_EVENT, handleCustom);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(CUSTOM_EVENT, handleCustom);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setMode = useCallback((m: TradeMode) => {
    setModeRaw(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
      window.dispatchEvent(new CustomEvent(CUSTOM_EVENT, { detail: m }));
    } catch {
      // safe
    }
  }, []);

  const cycleMode = useCallback(() => {
    setModeRaw((prev) => {
      const idx = MODE_ORDER.indexOf(prev);
      const next = MODE_ORDER[(idx + 1) % MODE_ORDER.length];
      try {
        localStorage.setItem(STORAGE_KEY, next);
        window.dispatchEvent(new CustomEvent(CUSTOM_EVENT, { detail: next }));
      } catch {
        // safe
      }
      return next;
    });
  }, []);

  const meta = MODE_META[mode];

  const value: TradeModeState = {
    mode,
    setMode,
    cycleMode,
    isOnChain: meta.onChain,
    isSimulated: meta.simulated,
    supportsNfts: meta.nfts,
    modeLabel: meta.label,
    modeColor: meta.color,
  };

  return (
    <TradeModeContext.Provider value={value}>
      {children}
    </TradeModeContext.Provider>
  );
}

/** Access trade mode. Must be inside TradeModeProvider. */
export function useTradeMode(): TradeModeState {
  const ctx = useContext(TradeModeContext);
  if (!ctx) throw new Error("useTradeMode() must be used within <TradeModeProvider>");
  return ctx;
}

/** Export meta for use in UI without context */
export { MODE_META, MODE_ORDER };
