"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

type SolanaCtx = {
  solanaNetwork: WalletAdapterNetwork;
  setSolanaNetwork: (v: WalletAdapterNetwork) => void;
};

const SolanaCtx = createContext<SolanaCtx | null>(null);
const KEY = "fs.solana.network";

export function SolanaNetworkProvider({ children }: { children: ReactNode }) {
  const [solanaNetwork, setSolanaNetworkState] = useState<WalletAdapterNetwork>(WalletAdapterNetwork.Devnet);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === "mainnet") setSolanaNetworkState(WalletAdapterNetwork.Mainnet);
      else if (raw === "testnet") setSolanaNetworkState(WalletAdapterNetwork.Testnet);
      else setSolanaNetworkState(WalletAdapterNetwork.Devnet);
    } catch {}
  }, []);

  const setSolanaNetwork = (v: WalletAdapterNetwork) => {
    setSolanaNetworkState(v);
    try {
      const s = v === WalletAdapterNetwork.Mainnet ? "mainnet" : v === WalletAdapterNetwork.Testnet ? "testnet" : "devnet";
      localStorage.setItem(KEY, s);
    } catch {}
  };

  const value = useMemo(() => ({ solanaNetwork, setSolanaNetwork }), [solanaNetwork]);

  return <SolanaCtx.Provider value={value}>{children}</SolanaCtx.Provider>;
}

export function useSolanaNetwork() {
  const ctx = useContext(SolanaCtx);
  if (!ctx) throw new Error("useSolanaNetwork must be used within SolanaNetworkProvider");
  return ctx;
}
