/**
 * POST /api/trades/[tradeId]/ready — Mark yourself as ready + submit trade items
 *
 * The OSRS two-step flow:
 * 1. Both users add items → click "Accept" → sets their ready flag.
 * 2. When both are ready → status moves to CONFIRMING.
 * 3. Phase 2 confirm is a separate endpoint (/confirm).
 */

import { NextRequest, NextResponse } from "next/server";
import { dbPrisma as db } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";
import { z } from "zod";
import { parseJsonOrError } from "@/lib/api-validate";
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitedResponse,
  rateLimitHeaders,
} from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ tradeId: string }> };

const readySchema = z.object({
  items: z.array(
    z.object({
      tokenAddress: z.string().min(1),
      tokenSymbol: z.string().min(1).max(32),
      tokenDecimals: z.coerce.number().int().min(0).max(18),
      tokenLogoUrl: z.string().max(512).optional().nullable(),
      amount: z.string().min(1),       // BigInt string
      displayAmount: z.string().min(1), // human-readable
      chainId: z.coerce.number().int().positive(),
    })
  ).min(1, "Must offer at least one item"),
});

export async function POST(req: NextRequest, ctx: RouteParams) {
  const me = await MyLibUserAuth();
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(getClientIdentifier(req, me.id), "trade");
  if (!rl.success) return rateLimitedResponse(rl);

  const { tradeId } = await ctx.params;

  const body = await parseJsonOrError(req, readySchema);
  if (!body.ok) return body.response;

  try {
    const trade = await db.trade.findUnique({ where: { id: tradeId } });

    if (!trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }
    if (trade.initiatorId !== me.id && trade.responderId !== me.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (trade.status !== "PENDING" && trade.status !== "ACCEPTED") {
      return NextResponse.json({ error: "Trade cannot be modified in this state" }, { status: 400 });
    }

    const isInitiator = trade.initiatorId === me.id;
    const mySide = isInitiator ? "INITIATOR" : "RESPONDER";

    // Transaction: replace my items + set ready + check if both ready
    const updated = await db.$transaction(async (tx) => {
      // Remove old items from my side
      await tx.tradeItem.deleteMany({
        where: { tradeId, side: mySide },
      });

      // Insert new items
      await tx.tradeItem.createMany({
        data: body.data.items.map((item) => ({
          tradeId,
          side: mySide,
          tokenAddress: item.tokenAddress,
          tokenSymbol: item.tokenSymbol,
          tokenDecimals: item.tokenDecimals,
          tokenLogoUrl: item.tokenLogoUrl ?? null,
          amount: item.amount,
          displayAmount: item.displayAmount,
          chainId: item.chainId,
        })),
      });

      // Update ready flag
      const readyField = isInitiator ? "initiatorReady" : "responderReady";
      const t = await tx.trade.update({
        where: { id: tradeId },
        data: { [readyField]: true, status: "ACCEPTED" },
      });

      // If both ready → move to CONFIRMING
      if (t.initiatorReady && t.responderReady) {
        return tx.trade.update({
          where: { id: tradeId },
          data: { status: "CONFIRMING" },
        });
      }

      return t;
    });

    // Notify partner that you're ready
    const otherUserId = isInitiator ? trade.responderId : trade.initiatorId;
    await db.notification.create({
      data: {
        userId: otherUserId,
        type: "TRADE_ACCEPTED",
        title: "Trade Partner Ready",
        message: `${me.name ?? "Your trade partner"} has accepted the trade offer`,
        actorId: me.id,
        metadata: { tradeId },
      },
    });

    return NextResponse.json(
      { ok: true, status: updated.status },
      { headers: rateLimitHeaders(rl) }
    );
  } catch (err) {
    console.error("[TRADE_READY]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
