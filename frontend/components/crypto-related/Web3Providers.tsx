"use client";

import React, { ReactNode, useEffect, useMemo, useRef } from "react";
import { WagmiProvider, useAccount } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { reconnect } from "@wagmi/core";
import { signOut, useSession } from "next-auth/react";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";

import { ActiveNetworkProvider, useActiveNetwork } from "./ActiveNetworkContext";
import { PricingProvider } from "./PricingContext";
import { getSolanaEndpoints } from "./solanaEndpoints";
import { WalletRuntimeProvider } from "./WalletRuntimeContext";

// AppKit for polished wallet modal UX
import { wagmiConfig, AppKitInitializer } from "./AppKitInit";
import { cleanLogoutInProgress } from "@/hooks/use-clean-logout";
import { useWallet as useSolWallet } from "@solana/wallet-adapter-react";

/* ------------------------------------------------------------------ */
/*  WalletDisconnectWatcher                                           */
/*  Watches EVM (wagmi) + Solana wallet connections.                  */
/*  If the user was connected and then disconnects (without our own   */
/*  cleanLogout flow), we also sign them out of their Web2 session    */
/*  to keep the session unified.                                      */
/* ------------------------------------------------------------------ */
function WalletDisconnectWatcher() {
  const { isConnected: evmConnected } = useAccount();
  const { connected: solConnected } = useSolWallet();
  const { data: session } = useSession();

  // Track previous connection states
  const prevEvmRef = useRef(false);
  const prevSolRef = useRef(false);

  // Skip the initial mount / rehydration period (wagmi reconnects on load)
  const stableRef = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      stableRef.current = true;
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!stableRef.current) {
      // During stabilization, just track the current state silently
      prevEvmRef.current = evmConnected;
      prevSolRef.current = solConnected;
      return;
    }

    const wasConnected = prevEvmRef.current || prevSolRef.current;
    const isConnected = evmConnected || solConnected;

    // Update tracked state
    prevEvmRef.current = evmConnected;
    prevSolRef.current = solConnected;

    // User WAS connected → now disconnected → has active Web2 session
    if (wasConnected && !isConnected && session?.user && !cleanLogoutInProgress) {
      console.info("[WalletDisconnectWatcher] Wallet disconnected externally — signing out Web2 session");
      signOut({ callbackUrl: "/auth/login" });
    }
  }, [evmConnected, solConnected, session]);

  return null;
}

/** Only changes the endpoint; keeps providers mounted so UI state persists. */
function SolanaLayer({ children }: { children: ReactNode }) {
  const { active } = useActiveNetwork();
  const cluster =
    active.kind === "solana" ? active.cluster : WalletAdapterNetwork.Devnet;

  const { http } = useMemo(() => getSolanaEndpoints(cluster), [cluster]);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter()],
    [cluster]
  );

  return (
    <ConnectionProvider endpoint={http} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletDisconnectWatcher />
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default function Web3Providers({ children }: { children: ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), []);
  const didReconnectRef = useRef(false);

  // Rehydrate wagmi sessions
  useEffect(() => {
    if (didReconnectRef.current) return;
    didReconnectRef.current = true;
    reconnect(wagmiConfig).catch(() => {});
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {/* Initialize AppKit modal for polished wallet UX */}
        <AppKitInitializer />
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
