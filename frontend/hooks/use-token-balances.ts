"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, useBalance } from "wagmi";
import { formatUnits } from "viem";

// Well-known ERC-20 tokens per chain
const KNOWN_TOKENS: Record<number, TokenMeta[]> = {
  // Ethereum Mainnet
  1: [
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6, logo: "/tokens/usdc.svg" },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", decimals: 6, logo: "/tokens/usdt.svg" },
    { address: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39", symbol: "HEX", decimals: 8, logo: "/tokens/hex.svg" },
    { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", decimals: 18, logo: "/tokens/dai.svg" },
    { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", decimals: 8, logo: "/tokens/wbtc.svg" },
    { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", symbol: "LINK", decimals: 18, logo: "/tokens/link.svg" },
    { address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", symbol: "UNI", decimals: 18, logo: "/tokens/uni.svg" },
  ],
  // PulseChain
  369: [
    { address: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39", symbol: "HEX", decimals: 8, logo: "/tokens/hex.svg" },
    { address: "0x0Cb6F5a34ad42ec934882A05265A7d5F59b51A2f", symbol: "USDT", decimals: 6, logo: "/tokens/usdt.svg" },
    { address: "0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07", symbol: "USDC", decimals: 6, logo: "/tokens/usdc.svg" },
    { address: "0xefD766cCb38EaF1dfd701853BFCe31359239F305", symbol: "DAI", decimals: 18, logo: "/tokens/dai.svg" },
  ],
  // Base
  8453: [
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6, logo: "/tokens/usdc.svg" },
    { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", symbol: "DAI", decimals: 18, logo: "/tokens/dai.svg" },
  ],
  // Sepolia
  11155111: [
    { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", symbol: "USDC", decimals: 6, logo: "/tokens/usdc.svg" },
  ],
  // Base Sepolia
  84532: [],
};

export interface TokenMeta {
  address: string;
  symbol: string;
  decimals: number;
  logo?: string;
}

export interface InventoryToken {
  /** Unique slot key — `${chainId}:${address}` or `${chainId}:native` */
  id: string;
  address: string; // "0x0" for native
  symbol: string;
  decimals: number;
  logo?: string;
  chainId: number;
  rawBalance: bigint;
  displayBalance: string;
  isNative: boolean;
}

/**
 * Fetches native + ERC-20 token balances for the connected wallet.
 * Uses viem multicall under the hood via wagmi's useBalance.
 */
export function useTokenBalances() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [tokens, setTokens] = useState<InventoryToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Native balance (ETH / PLS etc)
  const { data: nativeBalance } = useBalance({
    address,
    query: { enabled: isConnected },
  });

  const fetchErc20Balances = useCallback(async () => {
    if (!address || !isConnected || !chainId) return;

    setLoading(true);
    setError(null);

    try {
      const knownTokens = KNOWN_TOKENS[chainId] ?? [];
      const results: InventoryToken[] = [];

      // Add native token
      if (nativeBalance) {
        const raw = nativeBalance.value;
        if (raw > BigInt(0)) {
          results.push({
            id: `${chainId}:native`,
            address: "0x0000000000000000000000000000000000000000",
            symbol: nativeBalance.symbol,
            decimals: nativeBalance.decimals,
            logo: chainId === 369 ? "/tokens/pls.svg" : "/tokens/eth.svg",
            chainId,
            rawBalance: raw,
            displayBalance: formatBalance(formatUnits(raw, nativeBalance.decimals)),
            isNative: true,
          });
        }
      }

      // Fetch ERC-20 balances via multicall
      if (knownTokens.length > 0) {
        const { createPublicClient, http, erc20Abi } = await import("viem");
        const { mainnet, sepolia, base, baseSepolia } = await import("viem/chains");

        const chainMap: Record<number, Parameters<typeof createPublicClient>[0]["chain"]> = {
          1: mainnet,
          11155111: sepolia,
          8453: base,
          84532: baseSepolia,
          369: {
            id: 369,
            name: "PulseChain",
            nativeCurrency: { name: "Pulse", symbol: "PLS", decimals: 18 },
            rpcUrls: { default: { http: ["https://rpc.pulsechain.com"] } },
          } as Parameters<typeof createPublicClient>[0]["chain"],
        };

        const chain = chainMap[chainId];
        if (chain) {
          const client = createPublicClient({ chain, transport: http() });

          const calls = knownTokens.map((t) => ({
            address: t.address as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf" as const,
            args: [address] as const,
          }));

          const balances = await client.multicall({ contracts: calls });

          for (let i = 0; i < knownTokens.length; i++) {
            const result = balances[i];
            if (result.status === "success" && typeof result.result === "bigint" && result.result > BigInt(0)) {
              const token = knownTokens[i];
              results.push({
                id: `${chainId}:${token.address}`,
                address: token.address,
                symbol: token.symbol,
                decimals: token.decimals,
                logo: token.logo,
                chainId,
                rawBalance: result.result,
                displayBalance: formatBalance(formatUnits(result.result, token.decimals)),
                isNative: false,
              });
            }
          }
        }
      }

      // Sort: native first, then by display value descending
      results.sort((a, b) => {
        if (a.isNative && !b.isNative) return -1;
        if (!a.isNative && b.isNative) return 1;
        return Number(b.rawBalance - a.rawBalance);
      });

      setTokens(results);
    } catch (err) {
      console.error("[useTokenBalances] Failed:", err);
      setError("Failed to fetch token balances");
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, chainId, nativeBalance]);

  useEffect(() => {
    fetchErc20Balances();
  }, [fetchErc20Balances]);

  return { tokens, loading, error, refetch: fetchErc20Balances, chainId };
}

/** Format large numbers in compact form: 1.5M, 255.5K, etc. */
function formatBalance(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "0";
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  if (num >= 1) return num.toFixed(2);
  if (num >= 0.0001) return num.toFixed(4);
  return num.toExponential(2);
}
