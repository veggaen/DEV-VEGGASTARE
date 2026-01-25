"use client";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

export function getSolanaEndpoints(
  cluster: WalletAdapterNetwork
): { http: string } {
  if (cluster === WalletAdapterNetwork.Mainnet) {
    return { http: "https://solana-rpc.publicnode.com/" };
  }
  // default to devnet
  return { http: "https://api.devnet.solana.com" };
}
