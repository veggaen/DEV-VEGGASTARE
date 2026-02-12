/**
 * POST /api/trades/[tradeId]/confirm — Final confirmation (phase 2)
 *
 * Both parties must call this after reviewing the CONFIRMING state.
 * Once both have confirmed → COMPLETED.
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
    if (trade.status !== "CONFIRMING") {
      return NextResponse.json(
        { error: "Trade must be in CONFIRMING state" },
        { status: 400 }
      );
    }

    // Use metadata to track who has confirmed phase 2
    const confirmedBy: string[] = Array.isArray((trade.metadata as Record<string, unknown>)?.confirmedBy)
      ? ((trade.metadata as Record<string, unknown>).confirmedBy as string[])
      : [];

    if (confirmedBy.includes(me.id)) {
      return NextResponse.json({ error: "Already confirmed" }, { status: 400 });
    }

    confirmedBy.push(me.id);
    const bothConfirmed = confirmedBy.length >= 2;

    if (bothConfirmed) {
      // ── Trade Complete ──
      await db.trade.update({
        where: { id: tradeId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          metadata: { confirmedBy },
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

      return NextResponse.json(
        { ok: true, status: "COMPLETED" },
        { headers: rateLimitHeaders(rl) }
      );
    } else {
      // First confirmation — waiting on partner
      await db.trade.update({
        where: { id: tradeId },
        data: {
          metadata: { confirmedBy },
        },
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
