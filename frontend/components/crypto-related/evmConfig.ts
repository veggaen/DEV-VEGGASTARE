"use client";

import { createConfig, http, cookieStorage, createStorage } from "wagmi";
import { mainnet, sepolia, base, baseSepolia } from "wagmi/chains";
import type { Chain } from "viem";
import { metaMask, coinbaseWallet, injected } from "wagmi/connectors";

// PulseChain (mainnet)
export const pulsechain = {
  id: 369,
  name: "PulseChain",
  nativeCurrency: { name: "Pulse", symbol: "PLS", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.pulsechain.com"] },
    public: { http: ["https://rpc.pulsechain.com"] },
  },
  blockExplorers: {
    default: { name: "PulseScan", url: "https://scan.pulsechain.com" },
  },
} as const satisfies Chain;

const wagmiConfig = createConfig({
  chains: [mainnet, sepolia, base, baseSepolia, pulsechain],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [pulsechain.id]: http("https://rpc.pulsechain.com"),
  },
  connectors: [
    metaMask({ shimDisconnect: true }),
    coinbaseWallet({
      appName: "Veggastare",
      appLogoUrl: "/wallets/coinbase.webp",
      preference: { options: "eoaOnly" },
    }),
    injected({ shimDisconnect: true }),
  ],
  storage: createStorage({
    storage:
      typeof window !== "undefined" ? window.localStorage : cookieStorage,
  }),
  ssr: true,
});

export default wagmiConfig;
