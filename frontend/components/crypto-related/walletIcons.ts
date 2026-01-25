"use client";

import type { Connector } from "wagmi";

// Simple static icons you already have in /public
const ICONS = {
  metamask: "/metamask.png",
  coinbase: "/wallets/coinbase.webp",
  injected: "/wallet-generic.png",
  generic: "/wallet-generic.png",
};

function runtimeInjectedBrand(): "metamask" | "coinbase" | "injected" {
  if (typeof window === "undefined") return "injected";
  const eth: any = (window as any).ethereum;
  if (!eth) return "injected";

  // Multiple providers (MetaMask + CB) – pick the active one if any:
  const providers: any[] = eth.providers || [];
  const pick = (prov: any) => {
    if (!prov) return null;
    if (prov.isMetaMask) return "metamask";
    if (prov.isCoinbaseWallet) return "coinbase";
    return null;
  };

  if (providers.length > 0) {
    for (const p of providers) {
      const label = pick(p);
      if (label) return label;
    }
  }

  // Single provider
  if (eth.isMetaMask) return "metamask";
  if (eth.isCoinbaseWallet) return "coinbase";

  return "injected";
}

export function getConnectorBrand(connector: Connector): { label: string; icon: string } {
  const id = connector.id?.toLowerCase?.() ?? "";
  const name = connector.name?.toLowerCase?.() ?? "";

  // Wagmi ids commonly seen:
  // - "metaMask"
  // - "coinbaseWalletSDK"
  // - "injected"
  // Normalize checks:
  if (id.includes("metamask") || name.includes("metamask")) {
    return { label: "MetaMask", icon: ICONS.metamask };
  }
  if (id.includes("coinbase") || name.includes("coinbase")) {
    return { label: "Coinbase Wallet", icon: ICONS.coinbase };
  }
  if (id.includes("injected") || name.includes("injected")) {
    const inferred = runtimeInjectedBrand();
    if (inferred === "metamask") return { label: "MetaMask (Injected)", icon: ICONS.metamask };
    if (inferred === "coinbase") return { label: "Coinbase Wallet (Injected)", icon: ICONS.coinbase };
    return { label: connector.name || "Injected", icon: ICONS.injected };
  }

  // Fallback (WalletConnect later, etc.)
  return { label: connector.name || "Wallet", icon: ICONS.generic };
}
