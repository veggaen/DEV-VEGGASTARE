/**
 * VeggaSystem constants — safe for client components.
 * 
 * Extracted from lib/system-account.ts to avoid pulling in server-only
 * Prisma/db dependencies on the client.
 */

export const VEGGA_SYSTEM = {
  id: "system-vegga-official",
  name: "VeggaSystem",
  username: "veggasystem",
  /** @deprecated Use wallets map instead */
  walletAddress: "0x018F6bF56814Dfa2543f98041e44A202b3632636",
  image: "https://api.dicebear.com/7.x/bottts/svg?seed=veggasystem&backgroundColor=10b981",
  /** Multi-chain wallet addresses for the system account */
  wallets: {
    evm: "0x018F6bF56814Dfa2543f98041e44A202b3632636",        // Ethereum + PulseChain
    solana: "CKtrK9x1Hdtxt3JPpGVUDvoQgfhoGB24ecjsXYdzYnLx",   // Solana
    bitcoin: "bc1qsyk5zhe5qtemv537ayd88nde58nsjtxhru6vas",      // Bitcoin
    pulsechain: "0x018F6bF56814Dfa2543f98041e44A202b3632636",  // Same as EVM
  },
  /** Donation amount (USD) required for payment-based verification */
  donationAmountUsd: 1,
} as const;

/** Chain family display info for UI */
export const CHAIN_DISPLAY: Record<string, { label: string; color: string; icon: string }> = {
  EVM: { label: "Ethereum", color: "#627EEA", icon: "⟠" },
  SOLANA: { label: "Solana", color: "#9945FF", icon: "◎" },
  BITCOIN: { label: "Bitcoin", color: "#F7931A", icon: "₿" },
};
