"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from "react";
import { useWallet as useSolWallet } from "@solana/wallet-adapter-react";
import type { WalletName } from "@solana/wallet-adapter-base";
import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";
import { toast } from "sonner"; // Correct import for sonner

type EvmBrand = "MetaMask" | "Coinbase Wallet" | "Injected" | "Unknown" | null;

type ConnectedState = {
  evm: { connected: boolean; address: `0x${string}` | null; chainId: number | null; brand: EvmBrand };
  solana: { connected: boolean; address: string | null; brand: string | null };
  busy: { evm: boolean; sol: boolean };
};

type WalletContextValue = ConnectedState & {
  connectEvm: (connectorId: string) => Promise<void>;
  disconnectEvm: () => Promise<void>;
  setEvmBrandHint: (brand: EvmBrand) => void;
  connectSolana: (walletName: WalletName) => Promise<void>;
  disconnectSolana: () => Promise<void>;
  setSolBrandHint: (label: string) => void;
};

const WalletsCtx = createContext<WalletContextValue | null>(null);

export function useWalletsRuntime() {
  const ctx = useContext(WalletsCtx);
  if (!ctx) throw new Error("useWalletsRuntime must be used inside WalletContextProvider");
  return ctx;
}

export default function WalletContextProvider({ children }: { children: React.ReactNode }) {
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const chainId = useChainId();
  const { connectAsync, connectors, error: connectError } = useConnect();
  const { disconnectAsync: evmDisconnectAsync } = useDisconnect();
  const { select: solSelect, wallet: solWallet, publicKey, disconnect: solDisconnectAsync, wallets: solWallets } = useSolWallet();

  const [evmBrand, setEvmBrand] = useState<EvmBrand>(() => {
    if (typeof window === "undefined") return null;
    return (localStorage.getItem("evm.brand") as EvmBrand) || null;
  });
  const [solBrand, setSolBrand] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("sol.brand") || null;
  });

  const busyRef = useRef<{ evm: boolean; sol: boolean }>({ evm: false, sol: false });
  const [, force] = useState(0);
  const bump = () => force((x) => x + 1);

  const setEvmBrandHint = useCallback((brand: EvmBrand) => {
    setEvmBrand(brand);
    try {
      if (brand) localStorage.setItem("evm.brand", brand);
      else localStorage.removeItem("evm.brand");
    } catch {}
  }, []);

  const setSolBrandHint = useCallback((label: string) => {
    setSolBrand(label);
    try {
      if (label) localStorage.setItem("sol.brand", label);
      else localStorage.removeItem("sol.brand");
    } catch {}
  }, []);

  const connectEvm = useCallback(
    async (connectorId: string) => {
      if (busyRef.current.evm) return;
      busyRef.current.evm = true;
      bump();
      try {
        console.log("[connectEvm] Available connectors:", connectors.map(c => ({ id: c.id, name: c.name })));
        const connector = connectors.find((c) => c.id === connectorId) ?? connectors.find((c) => c.name === connectorId);
        if (!connector) throw new Error(`Connector ${connectorId} not found`);

        const id = connector.id;
        console.log("[connectEvm] Selected connector:", id);
        if (id === "metaMask") setEvmBrandHint("MetaMask");
        else if (id === "coinbaseWalletSDK") setEvmBrandHint("Coinbase Wallet");
        else if (id === "injected") setEvmBrandHint("Injected");
        else setEvmBrandHint("Unknown");

        await connectAsync({ connector });
        navigator.vibrate?.([50]);
        toast(`Connected to ${id.replace("SDK", "")} wallet`, { position: "top-center" });
      } catch (error: any) {
        console.error("[connectEvm] Error:", error);
        toast(error.message || "Failed to connect EVM wallet", { position: "top-center", style: { background: "#ff4444" } });
      } finally {
        busyRef.current.evm = false;
        bump();
      }
    },
    [connectAsync, connectors, setEvmBrandHint]
  );

  const disconnectEvm = useCallback(async () => {
    if (busyRef.current.evm) return;
    busyRef.current.evm = true;
    bump();
    try {
      await evmDisconnectAsync();
      setEvmBrandHint(null);
      toast("Disconnected EVM wallet", { position: "top-center" });
    } catch (error) {
      console.error("[disconnectEvm] Error:", error);
      toast("Failed to disconnect EVM wallet", { position: "top-center", style: { background: "#ff4444" } });
    } finally {
      busyRef.current.evm = false;
      bump();
    }
  }, [evmDisconnectAsync, setEvmBrandHint]);

  const connectSolana = useCallback(
    async (walletName: WalletName) => {
      if (busyRef.current.sol) return;
      busyRef.current.sol = true;
      bump();
      try {
        console.log("[connectSolana] Available wallets:", solWallets.map(w => w.adapter.name));
        const wallet = solWallets.find(w => w.adapter.name === walletName);
        if (!wallet) throw new Error(`Wallet ${walletName} not found`);

        await solSelect(walletName);
        const label = wallet.adapter.name;
        setSolBrandHint(label);
        navigator.vibrate?.([50]);
        toast(`Connected to ${label} wallet`, { position: "top-center" });
      } catch (error: any) {
        console.error("[connectSolana] Error:", error);
        toast(error.message || "Failed to connect Solana wallet", { position: "top-center", style: { background: "#ff4444" } });
      } finally {
        busyRef.current.sol = false;
        bump();
      }
    },
    [solSelect, solWallets, setSolBrandHint]
  );

  const disconnectSolana = useCallback(async () => {
    if (busyRef.current.sol) return;
    busyRef.current.sol = true;
    bump();
    try {
      await solDisconnectAsync();
      setSolBrandHint(null);
      toast("Disconnected Solana wallet", { position: "top-center" });
    } catch (error) {
      console.error("[disconnectSolana] Error:", error);
      toast("Failed to disconnect Solana wallet", { position: "top-center", style: { background: "#ff4444" } });
    } finally {
      busyRef.current.sol = false;
      bump();
    }
  }, [solDisconnectAsync, setSolBrandHint]);

  const value: WalletContextValue = useMemo(
    () => ({
      evm: { connected: !!evmConnected, address: evmAddress ?? null, chainId: chainId ?? null, brand: evmBrand },
      solana: { connected: !!publicKey, address: publicKey?.toBase58() ?? null, brand: solBrand ?? solWallet?.adapter?.name ?? null },
      busy: { evm: busyRef.current.evm, sol: busyRef.current.sol },
      connectEvm,
      disconnectEvm,
      setEvmBrandHint,
      connectSolana,
      disconnectSolana,
      setSolBrandHint,
    }),
    [evmConnected, evmAddress, chainId, publicKey, solBrand, solWallet, evmBrand, connectEvm, disconnectEvm, setEvmBrandHint, connectSolana, disconnectSolana, setSolBrandHint]
  );

  return <WalletsCtx.Provider value={value}>{children}</WalletsCtx.Provider>;
}