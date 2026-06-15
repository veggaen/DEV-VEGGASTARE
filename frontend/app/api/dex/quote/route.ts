/**
 * POST /api/dex/quote
 * Server-side DEX swap proxy via KyberSwap Aggregator.
 * **No API key required.** Keeps implementation details server-side.
 *
 * Body: { chainId, sellToken, buyToken, sellAmount, taker?, slippageBps?, mode: "price"|"quote" }
 *
 * Revenue: Set env vars `SWAP_FEE_BPS` + `SWAP_FEE_RECEIVER` to earn from swaps.
 *
 * @stability experimental
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getRoute,
  buildRoute,
  isSupportedChain,
  extractSources,
  computePriceImpact,
  NATIVE_TOKEN_ADDRESS,
} from "@/lib/dex/kyberswap";
import { MyLibUserAuth } from "@/lib/user-auth";

const addressPattern = /^0x[a-fA-F0-9]{40}$|^0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE$/i;

const bodySchema = z.object({
  chainId: z.coerce.number().int().positive(),
  sellToken: z.string().regex(addressPattern, "Invalid sell token address"),
  buyToken: z.string().regex(addressPattern, "Invalid buy token address"),
  sellAmount: z.string().regex(/^\d+$/, "Amount must be a positive integer string"),
  taker: z.string().regex(addressPattern, "Invalid taker address").optional(),
  slippageBps: z.coerce.number().int().min(1).max(2000).optional(), // max 20%
  mode: z.enum(["price", "quote"]).default("price"),
});

export async function POST(req: NextRequest) {
  // Auth required to prevent abuse
  const user = await MyLibUserAuth();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { chainId, sellToken, buyToken, sellAmount, taker, slippageBps, mode } = parsed.data;

  if (!isSupportedChain(chainId)) {
    return NextResponse.json(
      { error: `Chain ${chainId} not supported for swaps.` },
      { status: 400 },
    );
  }

  try {
    // Step 1: Get the best route from KyberSwap
    const routeRes = await getRoute({
      chainId,
      tokenIn: sellToken,
      tokenOut: buyToken,
      amountIn: sellAmount,
    });

    const summary = routeRes.data.routeSummary;
    const sources = extractSources(summary.route);
    const priceImpact = computePriceImpact(
      summary.amountInUsd,
      summary.amountOutUsd,
    );
    const isNativeSell =
      sellToken.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();

    // Shared price fields (returned for both price and quote modes)
    const priceData = {
      buyAmount: summary.amountOut,
      sellAmount: summary.amountIn,
      price: "0", // client computes from amounts + decimals
      estimatedGas: summary.gas,
      sources,
      estimatedPriceImpact: priceImpact,
      sellAmountUsd: summary.amountInUsd,
      buyAmountUsd: summary.amountOutUsd,
      gasUsd: summary.gasUsd,
      provider: "kyberswap",
    };

    if (mode === "price") {
      return NextResponse.json(priceData);
    }

    // Step 2: Build transaction (mode === "quote")
    if (!taker) {
      return NextResponse.json(
        { error: "taker address required for firm quotes" },
        { status: 400 },
      );
    }

    const buildRes = await buildRoute({
      chainId,
      routeSummary: summary,
      sender: taker,
      recipient: taker,
      slippageTolerance: slippageBps ?? 50,
    });

    return NextResponse.json({
      ...priceData,
      transaction: {
        to: buildRes.data.routerAddress,
        data: buildRes.data.data,
        value: isNativeSell ? summary.amountIn : "0",
        gas: buildRes.data.gas,
      },
      allowanceTarget: buildRes.data.routerAddress,
    });
  } catch (err) {
    console.error("[/api/dex/quote] Error:", err);
    // Sanitize — don't leak internal API details to client
    const raw = err instanceof Error ? err.message : "Quote failed";
    const safe = raw.includes("unsupported chain")
      ? "Unsupported chain"
      : raw.includes("route")
        ? "No swap route found for this pair"
        : raw.includes("build")
          ? "Failed to build swap transaction"
          : "Quote failed — try again";
    return NextResponse.json({ error: safe }, { status: 502 });
  }
}
