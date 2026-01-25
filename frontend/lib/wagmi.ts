/* "use client";

import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { metaMask, coinbaseWallet } from "wagmi/connectors";
import { defineChain } from "viem";

// PulseChain mainnet (id 369)
export const pulsechain = defineChain({
  id: 369,
  name: "PulseChain",
  nativeCurrency: { name: "Pulse", symbol: "PLS", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.pulsechain.com"] },
    public:  { http: ["https://rpc.pulsechain.com"] },
  },
  blockExplorers: {
    default: { name: "PulseScan", url: "https://scan.pulsechain.com" },
  },
  testnet: false,
});

export const wagmiConfig = createConfig({
  chains: [mainnet, pulsechain],
  transports: {
    [mainnet.id]: http(),                        // uses public defaults
    [pulsechain.id]: http("https://rpc.pulsechain.com"),
  },
  connectors: [
    metaMask(),                                  // id = "metaMask"
    coinbaseWallet()
  ],
  ssr: true,
});
 */