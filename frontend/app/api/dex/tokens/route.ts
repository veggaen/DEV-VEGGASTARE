/**
 * GET /api/dex/tokens?chainId=1
 * Returns popular tokens for a given chain from KyberSwap + hardcoded essentials.
 * Cached in-memory for 5 minutes to avoid hammering the API.
 *
 * @stability experimental
 */

import { NextRequest, NextResponse } from "next/server";

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

// ── In-memory cache ─────────────────────────────────────────────────────────

const cache = new Map<number, { tokens: TokenInfo[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 min

// ── KyberSwap chain slug map ────────────────────────────────────────────────

const CHAIN_SLUGS: Record<number, string> = {
  1: "ethereum",
  137: "polygon",
  42161: "arbitrum",
  10: "optimism",
  8453: "base",
  56: "bsc",
  43114: "avalanche",
  250: "fantom",
  59144: "linea",
  534352: "scroll",
  324: "zksync",
};

// ── Hardcoded essentials (always shown first) ───────────────────────────────

const NATIVE_ADDR = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const NATIVE_TOKENS: Record<number, TokenInfo> = {
  1:      { address: NATIVE_ADDR, symbol: "ETH",   name: "Ether",            decimals: 18 },
  137:    { address: NATIVE_ADDR, symbol: "MATIC", name: "Polygon",          decimals: 18 },
  42161:  { address: NATIVE_ADDR, symbol: "ETH",   name: "Ether",            decimals: 18 },
  10:     { address: NATIVE_ADDR, symbol: "ETH",   name: "Ether",            decimals: 18 },
  8453:   { address: NATIVE_ADDR, symbol: "ETH",   name: "Ether",            decimals: 18 },
  56:     { address: NATIVE_ADDR, symbol: "BNB",   name: "BNB",              decimals: 18 },
  43114:  { address: NATIVE_ADDR, symbol: "AVAX",  name: "Avalanche",        decimals: 18 },
  250:    { address: NATIVE_ADDR, symbol: "FTM",   name: "Fantom",           decimals: 18 },
  59144:  { address: NATIVE_ADDR, symbol: "ETH",   name: "Ether",            decimals: 18 },
  534352: { address: NATIVE_ADDR, symbol: "ETH",   name: "Ether",            decimals: 18 },
  324:    { address: NATIVE_ADDR, symbol: "ETH",   name: "Ether",            decimals: 18 },
};

// ── Fetch from KyberSwap ────────────────────────────────────────────────────

async function fetchKyberTokens(chainId: number): Promise<TokenInfo[]> {
  const slug = CHAIN_SLUGS[chainId];
  if (!slug) return [];

  try {
    // KyberSwap token list API
    const res = await fetch(
      `https://ks-setting.kyberswap.com/api/v1/tokens?page=1&pageSize=100&isWhitelisted=true&chainIds=${chainId}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!res.ok) return [];

    const json = await res.json() as {
      data?: {
        tokens?: Array<{
          address: string;
          symbol: string;
          name: string;
          decimals: number;
          logoURI?: string;
        }>;
      };
    };

    const rawTokens = json.data?.tokens ?? [];
    return rawTokens.map((t) => ({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      logoURI: t.logoURI,
    }));
  } catch (err) {
    console.error("[/api/dex/tokens] Fetch failed:", err);
    return [];
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const chainId = Number(req.nextUrl.searchParams.get("chainId") ?? "1");
  if (!CHAIN_SLUGS[chainId]) {
    return NextResponse.json(
      { error: `Chain ${chainId} not supported` },
      { status: 400 },
    );
  }

  // Check cache
  const cached = cache.get(chainId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ tokens: cached.tokens });
  }

  // Fetch from KyberSwap
  const kyberTokens = await fetchKyberTokens(chainId);

  // Merge: native first, then KyberSwap tokens (deduplicated)
  const native = NATIVE_TOKENS[chainId];
  const seen = new Set<string>();
  const merged: TokenInfo[] = [];

  if (native) {
    merged.push(native);
    seen.add(native.address.toLowerCase());
  }

  for (const t of kyberTokens) {
    const key = t.address.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(t);
    }
  }

  // Cache result
  cache.set(chainId, { tokens: merged, ts: Date.now() });

  return NextResponse.json(
    { tokens: merged },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    },
  );
}
