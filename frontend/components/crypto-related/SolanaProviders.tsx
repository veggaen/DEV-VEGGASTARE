"use client";

import React, { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { useActiveNetwork } from "./ActiveNetworkContext";
import { getSolanaEndpoints } from "./solanaEndpoints";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";

export default function SolanaProviders({ children }: { children: React.ReactNode }) {
  const { active } = useActiveNetwork();

  const cluster = useMemo(
    () => (active.kind === "solana" ? active.cluster : WalletAdapterNetwork.Mainnet),
    [active]
  );

  const endpoint = useMemo(() => {
    return getSolanaEndpoints(cluster).http;
  }, [cluster]);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network: cluster })],
    [cluster]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider autoConnect={false} wallets={wallets}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}