"use client";

/**
 * @fileOverview  ActiveWalletContext — allows overriding wagmi's active account
 *               with a LOCAL_RPC dev account so the inventory and other wallet-
 *               dependent features can target a specific address/chain.
 * @stability     experimental
 *
 * When a LOCAL_RPC wallet is "activated", this context stores the override.
 * Components like OsrsInventory and useTokenBalances read from this context
 * and use the overridden address for balance lookups.
 *
 * When a real wallet (MetaMask, Coinbase, etc.) is activated, the override
 * is cleared and wagmi's native useAccount takes precedence.
 */

import React, { createContext, useContext, useState, useCallback } from "react";

// ─── Storage key ─────────────────────────────────────────────
const STORAGE_KEY = "veggat:activeLocalRpc";

// ─── Types ───────────────────────────────────────────────────
interface ActiveWalletOverride {
  address: string;
  chainId: number;
  rpcUrl: string;
  label?: string;
}

interface ActiveWalletContextValue {
  /** Non-null when a LOCAL_RPC wallet is the "active" wallet */
  override: ActiveWalletOverride | null;
  /** Set a LOCAL_RPC wallet as the active wallet */
  setOverride: (override: ActiveWalletOverride) => void;
  /** Clear the override — wagmi's active account takes over */
  clearOverride: () => void;
}

const ActiveWalletContext = createContext<ActiveWalletContextValue>({
  override: null,
  setOverride: () => {},
  clearOverride: () => {},
});

// ─── Provider ────────────────────────────────────────────────
export function ActiveWalletProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverrideState] = useState<ActiveWalletOverride | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ActiveWalletOverride;
        if (parsed.address && parsed.chainId && parsed.rpcUrl) return parsed;
      }
    } catch {
      // Ignore parsing errors
    }
    return null;
  });

  const setOverride = useCallback((newOverride: ActiveWalletOverride) => {
    setOverrideState(newOverride);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newOverride));
    } catch {
      // Ignore storage errors
    }
    // Dispatch custom event so other tabs/components can react
    window.dispatchEvent(new CustomEvent("veggat:activeWalletChange", { detail: newOverride }));
  }, []);

  const clearOverride = useCallback(() => {
    setOverrideState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    window.dispatchEvent(new CustomEvent("veggat:activeWalletChange", { detail: null }));
  }, []);

  return (
    <ActiveWalletContext.Provider value={{ override, setOverride, clearOverride }}>
      {children}
    </ActiveWalletContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────
export function useActiveWalletOverride() {
  return useContext(ActiveWalletContext);
}
