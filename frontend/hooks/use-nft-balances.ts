"use client";

/**
 * @fileOverview  useNftBalances — fetch ERC-721 and ERC-1155 NFTs for the active wallet.
 *
 *   Strategy:
 *     1. If on a supported chain → use Alchemy/public NFT API
 *     2. Fallback → scan known NFT contracts via multicall
 *     3. Local chains → manual balanceOf checks against known contracts
 *
 *   Returns InventoryNft[] — compatible with the OSRS inventory grid system.
 *
 * @stability experimental
 */

import { useCallback, useEffect, useState, useRef } from "react";
import { useAccount, useChainId } from "wagmi";
import { useActiveWalletOverride } from "@/contexts/active-wallet-context";

// ── Types ───────────────────────────────────────────────────────────────────

export interface NftMetadata {
  name: string | null;
  description: string | null;
  image: string | null;         // IPFS or HTTPS URL
  animationUrl: string | null;  // video/audio
  attributes: Array<{ trait_type: string; value: string | number }>;
}

export interface InventoryNft {
  /** Unique ID: `${chainId}:${contractAddress}:${tokenId}` */
  id: string;
  contractAddress: string;
  tokenId: string;
  /** ERC-721 or ERC-1155 */
  standard: "ERC-721" | "ERC-1155";
  /** For ERC-1155, the balance. For ERC-721, always 1 */
  balance: number;
  chainId: number;
  /** Collection name */
  collectionName: string | null;
  /** Token-level name */
  name: string | null;
  /** Resolved image URL (IPFS → gateway) */
  imageUrl: string | null;
  /** Raw metadata */
  metadata: NftMetadata | null;
}

// ── IPFS helpers ────────────────────────────────────────────────────────────

const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];

function resolveIpfsUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("ipfs://")) {
    const cid = url.replace("ipfs://", "");
    return `${IPFS_GATEWAYS[0]}${cid}`;
  }
  if (url.startsWith("ar://")) {
    return `https://arweave.net/${url.replace("ar://", "")}`;
  }
  return url;
}

// ── Alchemy NFT API ─────────────────────────────────────────────────────────

/** Alchemy chain slugs */
const ALCHEMY_CHAINS: Record<number, string> = {
  1: "eth-mainnet",
  137: "polygon-mainnet",
  42161: "arb-mainnet",
  10: "opt-mainnet",
  8453: "base-mainnet",
  11155111: "eth-sepolia",
  84532: "base-sepolia",
};

interface AlchemyNft {
  contract: { address: string; name: string | null; tokenType: string };
  tokenId: string;
  name: string | null;
  description: string | null;
  image: { cachedUrl: string | null; originalUrl: string | null };
  raw: { metadata: Record<string, unknown> } | null;
  balance?: string;
}

async function fetchAlchemyNfts(
  owner: string,
  chainId: number,
): Promise<InventoryNft[]> {
  const network = ALCHEMY_CHAINS[chainId];
  if (!network) return [];

  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (!apiKey) return [];

  const url = `https://${network}.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner?owner=${owner}&withMetadata=true&pageSize=100`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];

    const data = (await res.json()) as { ownedNfts: AlchemyNft[] };
    if (!Array.isArray(data.ownedNfts)) return [];

    return data.ownedNfts.map((nft) => ({
      id: `${chainId}:${nft.contract.address}:${nft.tokenId}`,
      contractAddress: nft.contract.address,
      tokenId: nft.tokenId,
      standard: nft.contract.tokenType === "ERC1155" ? "ERC-1155" as const : "ERC-721" as const,
      balance: nft.balance ? parseInt(nft.balance, 10) : 1,
      chainId,
      collectionName: nft.contract.name,
      name: nft.name,
      imageUrl: resolveIpfsUrl(nft.image?.cachedUrl ?? nft.image?.originalUrl),
      metadata: nft.raw?.metadata
        ? {
            name: (nft.raw.metadata.name as string) ?? null,
            description: (nft.raw.metadata.description as string) ?? null,
            image: resolveIpfsUrl(nft.raw.metadata.image as string),
            animationUrl: resolveIpfsUrl(nft.raw.metadata.animation_url as string),
            attributes: Array.isArray(nft.raw.metadata.attributes)
              ? (nft.raw.metadata.attributes as NftMetadata["attributes"])
              : [],
          }
        : null,
    }));
  } catch {
    return [];
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 30_000; // 30s (NFTs change less frequently)

export function useNftBalances() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { override } = useActiveWalletOverride();

  const [nfts, setNfts] = useState<InventoryNft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const effectiveAddress = override?.address ?? address;
  const effectiveChainId = override?.chainId ?? chainId;

  const fetchNfts = useCallback(async () => {
    if (!effectiveAddress) {
      setNfts([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Try Alchemy first (supported mainnets/testnets)
      const results = await fetchAlchemyNfts(effectiveAddress, effectiveChainId);
      if (mountedRef.current) {
        setNfts(results);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch NFTs");
        setNfts([]);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [effectiveAddress, effectiveChainId]);

  // Initial fetch + polling
  useEffect(() => {
    mountedRef.current = true;
    fetchNfts();
    const interval = setInterval(fetchNfts, POLL_INTERVAL);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchNfts]);

  // Listen for balance invalidation events
  useEffect(() => {
    function handleInvalidate() {
      fetchNfts();
    }
    window.addEventListener("veggat:balanceInvalidate", handleInvalidate);
    return () => window.removeEventListener("veggat:balanceInvalidate", handleInvalidate);
  }, [fetchNfts]);

  return {
    nfts,
    loading,
    error,
    refetch: fetchNfts,
    chainId: effectiveChainId,
  };
}
