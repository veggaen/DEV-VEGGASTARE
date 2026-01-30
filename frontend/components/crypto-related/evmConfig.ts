"use client";

import { createConfig, http, cookieStorage, createStorage } from "wagmi";
import { mainnet, sepolia, base, baseSepolia } from "wagmi/chains";
import type { Chain } from "viem";
import { metaMask, coinbaseWallet, injected, walletConnect } from "wagmi/connectors";

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

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  process.env.NEXT_PUBLIC_PROJECT_ID;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.veggat.com";

declare global {
  // eslint-disable-next-line no-var
  var __veggastareWagmiConfig: ReturnType<typeof createConfig> | undefined;
}

function buildWagmiConfig() {
  // Prefer injected/extension wallets on desktop; WalletConnect is still available for mobile.
  // Note: walletConnect(...) can initialize underlying WC/AppKit internals; keep this config singleton.
  return createConfig({
    chains: [mainnet, sepolia, base, baseSepolia, pulsechain],
    transports: {
      [mainnet.id]: http(),
      [sepolia.id]: http(),
      [base.id]: http(),
      [baseSepolia.id]: http(),
      [pulsechain.id]: http("https://rpc.pulsechain.com"),
    },
    connectors: [
      metaMask(),
      coinbaseWallet({
        appName: "Veggastare",
        appLogoUrl: "/wallets/coinbase.webp",
        preference: { options: "eoaOnly" },
      }),
      injected(),
      ...(walletConnectProjectId
        ? [
            walletConnect({
              projectId: walletConnectProjectId,
              metadata: {
                name: "Veggastare",
                description: "Veggastare marketplace",
                url: siteUrl,
                icons: [`${siteUrl}/next.svg`],
              },
            }),
          ]
        : []),
    ],
    storage: createStorage({
      storage:
        typeof window !== "undefined" ? window.localStorage : cookieStorage,
    }),
    ssr: true,
  });
}

const wagmiConfig = globalThis.__veggastareWagmiConfig ?? buildWagmiConfig();
globalThis.__veggastareWagmiConfig = wagmiConfig;

export default wagmiConfig;
