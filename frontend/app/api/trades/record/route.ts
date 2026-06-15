/**
 * POST /api/trades/record — Create a TradeRecord from the client.
 *
 * Used by DEX swaps (executed client-side) and self-transfers to log
 * the completed trade into the unified trade history.
 *
 * @stability experimental
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MyLibUserAuth } from "@/lib/user-auth";
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitedResponse,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { createTradeRecord } from "@/lib/trade-record";
import type { TradeMode, TradeEnvironment } from "@/generated/prisma/client";

const VALID_MODES: TradeMode[] = ["DEX", "SELF", "LOCAL"];
const VALID_ENVS: TradeEnvironment[] = ["MAINNET", "TESTNET", "PAPER"];

const recordSchema = z.object({
  mode: z.enum(["DEX", "SELF", "LOCAL"] as const),

  sellToken: z.string().min(1).max(20),
  sellTokenAddress: z.string().min(1),
  sellAmount: z.string().min(1),        // raw BigInt string
  sellDisplayAmt: z.string().min(1),    // human-readable
  sellDecimals: z.number().int().min(0).max(18).optional().default(18),
  sellChainId: z.number().int().positive(),

  buyToken: z.string().min(1).max(20),
  buyTokenAddress: z.string().min(1),
  buyAmount: z.string().min(1),
  buyDisplayAmt: z.string().min(1),
  buyDecimals: z.number().int().min(0).max(18).optional().default(18),
  buyChainId: z.number().int().positive(),

  priceUsd: z.number().optional(),
  feeUsd: z.number().optional(),
  exchangeRate: z.number().optional(),
  priceSource: z.string().max(50).optional(),

  txHash: z.string().min(1).optional(),
  blockNumber: z.number().int().optional(),
  walletAddress: z.string().min(1).optional(),
  environment: z.enum(["MAINNET", "TESTNET", "PAPER"] as const).optional().default("MAINNET"),

  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const user = await MyLibUserAuth();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(getClientIdentifier(req, user.id), "trade");
  if (!rl.success) return rateLimitedResponse(rl);

  try {
    const raw = await req.json();
    const parsed = recordSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const d = parsed.data;

    const record = await createTradeRecord({
      userId: user.id,
      mode: d.mode,
      sellToken: d.sellToken,
      sellTokenAddress: d.sellTokenAddress,
      sellAmount: d.sellAmount,
      sellDisplayAmt: d.sellDisplayAmt,
      sellDecimals: d.sellDecimals,
      sellChainId: d.sellChainId,
      buyToken: d.buyToken,
      buyTokenAddress: d.buyTokenAddress,
      buyAmount: d.buyAmount,
      buyDisplayAmt: d.buyDisplayAmt,
      buyDecimals: d.buyDecimals,
      buyChainId: d.buyChainId,
      priceUsd: d.priceUsd,
      feeUsd: d.feeUsd,
      exchangeRate: d.exchangeRate,
      priceSource: d.priceSource,
      txHash: d.txHash,
      blockNumber: d.blockNumber,
      walletAddress: d.walletAddress,
      environment: d.environment,
      metadata: d.metadata,
    });

    return NextResponse.json(
      { ok: true, id: record.id },
      { status: 201, headers: rateLimitHeaders(rl) },
    );
  } catch (err) {
    console.error("[TRADE_RECORD]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
