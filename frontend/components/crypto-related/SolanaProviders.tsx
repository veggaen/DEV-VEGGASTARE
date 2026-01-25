"use client";

import React, { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { useActiveNetwork } from "./ActiveNetworkContext";
import { getSolanaEndpoints } from "./solanaEndpoints";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";

export default function SolanaProviders({ children }: { children: React.ReactNode }) {
  const { active } = useActiveNetwork();

  const endpoint = useMemo(() => {
    const cluster = active.kind === "solana" ? active.cluster : WalletAdapterNetwork.Mainnet;
    return getSolanaEndpoints(cluster).http;
  }, [active]);

  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider autoConnect={false} wallets={wallets}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}