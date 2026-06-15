/**
 * POST /api/trades/[tradeId]/confirm — Final confirmation (phase 2)
 *
 * Both parties must call this after reviewing the CONFIRMING state.
 * Once both have confirmed → COMPLETED.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbPrisma as db } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitedResponse,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { createP2PTradeRecords } from "@/lib/trade-record";

const confirmSchema = z.object({
  /** Wallet signature proving intent */
  signature: z.string().min(1).optional(),
  /** Connected wallet address */
  walletAddress: z.string().min(1).optional(),
  /** On-chain transaction hashes for transferred items */
  txHashes: z.array(z.string().min(1)).optional(),
});

type RouteParams = { params: Promise<{ tradeId: string }> };

export async function POST(req: NextRequest, ctx: RouteParams) {
  const me = await MyLibUserAuth();
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(getClientIdentifier(req, me.id), "trade");
  if (!rl.success) return rateLimitedResponse(rl);

  const { tradeId } = await ctx.params;

  try {
    const body = confirmSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const trade = await db.trade.findUnique({
      where: { id: tradeId },
      include: { Items: true },
    });

    if (!trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }
    if (trade.initiatorId !== me.id && trade.responderId !== me.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (trade.status !== "CONFIRMING") {
      return NextResponse.json(
        { error: "Trade must be in CONFIRMING state" },
        { status: 400 }
      );
    }
    if (trade.expiresAt.getTime() < Date.now()) {
      await db.trade.update({
        where: { id: tradeId },
        data: {
          status: 'EXPIRED',
          cancelledAt: new Date(),
          cancelReason: 'Trade session expired',
        },
      });
      return NextResponse.json({ error: 'Trade expired' }, { status: 410 });
    }

    const existingMeta = (trade.metadata as Record<string, unknown>) ?? {};

    // Use metadata to track who has confirmed phase 2
    const confirmedBy: string[] = Array.isArray(existingMeta.confirmedBy)
      ? (existingMeta.confirmedBy as string[])
      : [];

    if (confirmedBy.includes(me.id)) {
      return NextResponse.json({ error: "Already confirmed" }, { status: 400 });
    }

    confirmedBy.push(me.id);
    const bothConfirmed = confirmedBy.length >= 2;

    // Store this user's tx hashes + signature in metadata
    const isInitiator = trade.initiatorId === me.id;
    const txKey = isInitiator ? "initiatorTxHashes" : "responderTxHashes";
    const sigKey = isInitiator ? "initiatorSignature" : "responderSignature";
    const newMeta = {
      ...existingMeta,
      confirmedBy,
      ...(body.data.txHashes?.length ? { [txKey]: body.data.txHashes } : {}),
      ...(body.data.signature ? { [sigKey]: body.data.signature } : {}),
      ...(body.data.walletAddress
        ? { [isInitiator ? "initiatorWallet" : "responderWallet"]: body.data.walletAddress }
        : {}),
    };

    if (bothConfirmed) {
      // ── Trade Complete ──
      await db.trade.update({
        where: { id: tradeId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          metadata: newMeta,
        },
      });

      // Notify both parties
      const parties = [trade.initiatorId, trade.responderId];
      await db.notification.createMany({
        data: parties.map((userId) => ({
          userId,
          type: "TRADE_COMPLETED" as const,
          title: "Trade Completed",
          message: "Your trade has been completed successfully!",
          metadata: { tradeId },
        })),
      });

      // ── Create TradeRecords for both parties (fire-and-forget) ──
      const initiatorItems = trade.Items.filter((i) => i.side === "INITIATOR").map((i) => ({
        tokenSymbol: i.tokenSymbol,
        tokenAddress: i.tokenAddress,
        amount: i.amount,
        displayAmount: i.displayAmount,
        tokenDecimals: i.tokenDecimals,
        chainId: i.chainId,
      }));
      const responderItems = trade.Items.filter((i) => i.side === "RESPONDER").map((i) => ({
        tokenSymbol: i.tokenSymbol,
        tokenAddress: i.tokenAddress,
        amount: i.amount,
        displayAmount: i.displayAmount,
        tokenDecimals: i.tokenDecimals,
        chainId: i.chainId,
      }));

      createP2PTradeRecords({
        trade: {
          id: tradeId,
          initiatorId: trade.initiatorId,
          responderId: trade.responderId,
          chainId: trade.chainId,
          environment: trade.environment,
          metadata: newMeta,
        },
        initiatorItems,
        responderItems,
      }).catch((err) => console.error("[TRADE_CONFIRM] Failed to create TradeRecords:", err));

      return NextResponse.json(
        { ok: true, status: "COMPLETED" },
        { headers: rateLimitHeaders(rl) }
      );
    } else {
      // First confirmation — waiting on partner
      await db.trade.update({
        where: { id: tradeId },
        data: { metadata: newMeta },
      });

      return NextResponse.json(
        { ok: true, status: "CONFIRMING", waitingForPartner: true },
        { headers: rateLimitHeaders(rl) }
      );
    }
  } catch (err) {
    console.error("[TRADE_CONFIRM]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
