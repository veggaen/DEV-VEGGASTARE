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
  walletAddress: "0x018F6bF56814Dfa2543f98041e44A202b3632636",
  image: "https://api.dicebear.com/7.x/bottts/svg?seed=veggasystem&backgroundColor=10b981",
} as const;
