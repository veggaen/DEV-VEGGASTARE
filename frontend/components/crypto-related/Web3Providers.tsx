"use client";

import React, { ReactNode, useEffect, useMemo } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { reconnect } from "@wagmi/core";
import wagmiConfig from "./evmConfig";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";

import { ActiveNetworkProvider, useActiveNetwork } from "./ActiveNetworkContext";
import { PricingProvider } from "./PricingContext";
import { getSolanaEndpoints } from "./solanaEndpoints";
import { WalletRuntimeProvider } from "./WalletRuntimeContext";

/** Only changes the endpoint; keeps providers mounted so UI state persists. */
function SolanaLayer({ children }: { children: ReactNode }) {
  const { active } = useActiveNetwork();
  const cluster =
    active.kind === "solana" ? active.cluster : WalletAdapterNetwork.Devnet;

  const { http } = useMemo(() => getSolanaEndpoints(cluster), [cluster]);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network: cluster })],
    [cluster]
  );

  return (
    <ConnectionProvider endpoint={http} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default function Web3Providers({ children }: { children: ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), []);

  // Rehydrate wagmi sessions
  useEffect(() => {
    reconnect(wagmiConfig).catch(() => {});
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ActiveNetworkProvider>
          <PricingProvider>
            <SolanaLayer>
              <WalletRuntimeProvider>{children}</WalletRuntimeProvider>
            </SolanaLayer>
          </PricingProvider>
        </ActiveNetworkProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
