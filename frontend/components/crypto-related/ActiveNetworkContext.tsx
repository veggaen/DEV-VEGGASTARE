"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

type EvmActive = { kind: "evm"; chainId: number };
type SolActive = { kind: "solana"; cluster: WalletAdapterNetwork };
export type ActiveNetwork = EvmActive | SolActive;

type Ctx = {
  active: ActiveNetwork;
  setActive: (n: ActiveNetwork) => void;
};

const ActiveCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "fs.activeNetwork";

function isValidNetwork(data: unknown): data is ActiveNetwork {
  if (typeof data !== "object" || data === null) return false;
  const { kind } = data as { kind: string };
  if (kind === "evm" && "chainId" in data && typeof (data as any).chainId === "number") return true;
  if (kind === "solana" && "cluster" in data && typeof (data as any).cluster === "string") return true;
  return false;
}

function eq(a: ActiveNetwork, b: ActiveNetwork): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "evm" && b.kind === "evm") return a.chainId === b.chainId;
  if (a.kind === "solana" && b.kind === "solana") return a.cluster === b.cluster;
  return false;
}

export function ActiveNetworkProvider({ children }: { children: React.ReactNode }) {
  const [active, setActiveState] = useState<ActiveNetwork>({ kind: "evm", chainId: 1 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let parsedNetwork: ActiveNetwork | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidNetwork(parsed)) {
          parsedNetwork = parsed;
        }
      }
    } catch {}
    const timeoutId = window.setTimeout(() => {
      if (parsedNetwork) setActiveState(parsedNetwork);
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const setActive = useCallback((n: ActiveNetwork) => {
    setActiveState((prev) => {
      if (eq(prev, n)) return prev;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(n));
      } catch {}
      return n;
    });
  }, []);

  const value = useMemo(() => ({ active, setActive }), [active, setActive]);

  if (!loaded) return null;
  return <ActiveCtx.Provider value={value}>{children}</ActiveCtx.Provider>;
}

export function useActiveNetwork() {
  const ctx = useContext(ActiveCtx);
  if (!ctx) throw new Error("useActiveNetwork must be used within ActiveNetworkProvider");
  return ctx;
}
