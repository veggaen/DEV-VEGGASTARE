/**
 * @fileOverview  KyberSwap Aggregator API client for DEX swaps.
 *               NO API key required. Supports optional integrator fees.
 *               Multi-chain: Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, Avalanche + more.
 *
 *  Revenue:
 *    Set env vars `SWAP_FEE_BPS` (e.g. "25" = 0.25%) and `SWAP_FEE_RECEIVER`
 *    (your wallet address) to earn from every swap on the platform.
 *
 * @stability     experimental
 * @see           https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface KyberRouteParams {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
}

export interface KyberRouteSummary {
  tokenIn: string;
  amountIn: string;
  amountInUsd: string;
  tokenOut: string;
  amountOut: string;
  amountOutUsd: string;
  gas: string;
  gasPrice: string;
  gasUsd: string;
  extraFee: {
    feeAmount: string;
    chargeFeeBy: string;
    isInBps: boolean;
    feeReceiver: string;
  } | null;
  route: Array<
    Array<{
      pool: string;
      tokenIn: string;
      tokenOut: string;
      swapAmount: string;
      amountOut: string;
      exchange: string;
    }>
  >;
}

export interface KyberRouteResponse {
  code: number;
  message: string;
  data: {
    routeSummary: KyberRouteSummary;
    routerAddress: string;
  };
}

export interface KyberBuildParams {
  chainId: number;
  routeSummary: KyberRouteSummary;
  sender: string;
  recipient: string;
  /** Slippage tolerance in basis points (e.g. 50 = 0.5%) */
  slippageTolerance: number;
}

export interface KyberBuildResponse {
  code: number;
  message: string;
  data: {
    amountIn: string;
    amountOut: string;
    gas: string;
    data: string;
    routerAddress: string;
  };
}

// ── Constants ───────────────────────────────────────────────────────────────

const API_BASE = "https://aggregator-api.kyberswap.com";

/** Chain ID → KyberSwap API slug */
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

/** Use this address for native token (ETH, MATIC, BNB, etc.) */
export const NATIVE_TOKEN_ADDRESS =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// ── Fee Config (server-side env vars) ───────────────────────────────────────

/**
 * Read optional integrator fee config from env.
 * - `SWAP_FEE_BPS` — fee in basis points (e.g. "25" = 0.25%). Max 300 (3%).
 * - `SWAP_FEE_RECEIVER` — wallet address to receive the fee.
 * If either is missing/invalid, no fee is applied.
 */
function getFeeConfig(): { bps: number; receiver: string } | null {
  const bps = parseInt(process.env.SWAP_FEE_BPS ?? "", 10);
  const receiver = process.env.SWAP_FEE_RECEIVER?.trim();
  if (bps > 0 && receiver && /^0x[a-fA-F0-9]{40}$/.test(receiver)) {
    return { bps: Math.min(bps, 300), receiver };
  }
  return null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getChainSlug(chainId: number): string {
  const slug = CHAIN_SLUGS[chainId];
  if (!slug) throw new Error(`KyberSwap: unsupported chain ${chainId}`);
  return slug;
}

/** Extract unique DEX source names + proportions from KyberSwap route data. */
export function extractSources(
  route: KyberRouteSummary["route"],
): Array<{ name: string; proportion: string }> {
  const exchangeAmounts: Record<string, number> = {};
  let totalAmount = 0;

  for (const path of route) {
    for (const hop of path) {
      const name = hop.exchange
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      const amount = Number(hop.amountOut) || 0;
      exchangeAmounts[name] = (exchangeAmounts[name] ?? 0) + amount;
      totalAmount += amount;
    }
  }

  return Object.entries(exchangeAmounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({
      name,
      proportion:
        totalAmount > 0 ? (amount / totalAmount).toFixed(4) : "0",
    }));
}

/** Compute price impact percentage from USD values. */
export function computePriceImpact(
  amountInUsd: string,
  amountOutUsd: string,
): string | null {
  const inUsd = parseFloat(amountInUsd);
  const outUsd = parseFloat(amountOutUsd);
  if (!inUsd || inUsd <= 0) return null;
  const impact = ((inUsd - outUsd) / inUsd) * 100;
  return impact.toFixed(2);
}

// ── API Client ──────────────────────────────────────────────────────────────

/**
 * Get the best swap route from KyberSwap Aggregator.
 * **No API key required.**
 */
export async function getRoute(
  params: KyberRouteParams,
): Promise<KyberRouteResponse> {
  const slug = getChainSlug(params.chainId);
  const url = new URL(`${API_BASE}/${slug}/api/v1/routes`);
  url.searchParams.set("tokenIn", params.tokenIn);
  url.searchParams.set("tokenOut", params.tokenOut);
  url.searchParams.set("amountIn", params.amountIn);
  url.searchParams.set("saveGas", "false");
  url.searchParams.set("gasInclude", "true");

  // Optional integrator fee
  const fee = getFeeConfig();
  if (fee) {
    url.searchParams.set("feeAmount", fee.bps.toString());
    url.searchParams.set("feeReceiver", fee.receiver);
    url.searchParams.set("isInBps", "true");
    url.searchParams.set("chargeFeeBy", "currency_in");
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "x-client-id": "VeggaStare",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "unknown");
    throw new Error(`KyberSwap route API ${res.status}: ${body}`);
  }

  const json = (await res.json()) as KyberRouteResponse;
  if (json.code !== 0) {
    throw new Error(`KyberSwap: ${json.message || "unknown error"}`);
  }

  return json;
}

/**
 * Build executable transaction data from a route.
 * Returns calldata ready for `walletClient.sendTransaction()`.
 */
export async function buildRoute(
  params: KyberBuildParams,
): Promise<KyberBuildResponse> {
  const slug = getChainSlug(params.chainId);

  const res = await fetch(`${API_BASE}/${slug}/api/v1/route/build`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-client-id": "VeggaStare",
    },
    body: JSON.stringify({
      routeSummary: params.routeSummary,
      sender: params.sender,
      recipient: params.recipient,
      slippageTolerance: params.slippageTolerance,
      deadline: Math.floor(Date.now() / 1000) + 1200, // 20 min
      source: "VeggaStare",
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "unknown");
    throw new Error(`KyberSwap build API ${res.status}: ${body}`);
  }

  const json = (await res.json()) as KyberBuildResponse;
  if (json.code !== 0) {
    throw new Error(`KyberSwap build: ${json.message || "unknown error"}`);
  }

  return json;
}

/**
 * Check if a chain is supported by KyberSwap.
 */
export function isSupportedChain(chainId: number): boolean {
  return chainId in CHAIN_SLUGS;
}
