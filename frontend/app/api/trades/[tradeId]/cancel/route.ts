/**
 * POST /api/trades/[tradeId]/cancel — Cancel a trade
 */

import { NextRequest, NextResponse } from "next/server";
import { dbPrisma as db } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitedResponse,
  rateLimitHeaders,
} from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ tradeId: string }> };

export async function POST(req: NextRequest, ctx: RouteParams) {
  const me = await MyLibUserAuth();
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(getClientIdentifier(req, me.id), "trade");
  if (!rl.success) return rateLimitedResponse(rl);

  const { tradeId } = await ctx.params;

  try {
    const trade = await db.trade.findUnique({ where: { id: tradeId } });

    if (!trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }
    if (trade.initiatorId !== me.id && trade.responderId !== me.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (trade.status === "COMPLETED" || trade.status === "CANCELLED") {
      return NextResponse.json({ error: "Trade already finalized" }, { status: 400 });
    }

    await db.trade.update({
      where: { id: tradeId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: `Cancelled by ${me.name ?? me.id}`,
      },
    });

    // Notify other party
    const otherUserId = trade.initiatorId === me.id ? trade.responderId : trade.initiatorId;
    await db.notification.create({
      data: {
        userId: otherUserId,
        type: "TRADE_CANCELLED",
        title: "Trade Cancelled",
        message: `${me.name ?? "Someone"} cancelled the trade`,
        actorId: me.id,
        metadata: { tradeId },
      },
    });

    return NextResponse.json({ ok: true }, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    console.error("[TRADE_CANCEL]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
