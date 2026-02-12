/**
 * POST /api/trades — Create a trade request
 * GET  /api/trades — List user's trades (with status filter)
 */

import { NextRequest, NextResponse } from "next/server";
import { dbPrisma as db } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";
import { z } from "zod";
import { parseJsonOrError, parseQueryOrError } from "@/lib/api-validate";
import { ChainFamily } from "@/generated/prisma/browser";
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitedResponse,
  rateLimitHeaders,
} from "@/lib/rate-limit";

// ── Zod Schemas ──

const createTradeSchema = z.object({
  responderId: z.string().min(1).max(200),
  chainId: z.coerce.number().int().positive(),
  family: z.nativeEnum(ChainFamily).optional().default("EVM"),
});

const listTradesSchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ── POST — Create Trade ──

export async function POST(req: NextRequest) {
  const me = await MyLibUserAuth();
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit
  const rl = await checkRateLimit(getClientIdentifier(req, me.id), "trade");
  if (!rl.success) return rateLimitedResponse(rl);

  const body = await parseJsonOrError(req, createTradeSchema);
  if (!body.ok) return body.response;

  const { responderId, chainId, family } = body.data;

  if (responderId === me.id) {
    return NextResponse.json({ error: "Cannot trade with yourself" }, { status: 400 });
  }

  // Verify responder exists
  const responder = await db.user.findUnique({
    where: { id: responderId },
    select: { id: true, name: true, image: true },
  });
  if (!responder) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check for existing active trade between these users
  const existingTrade = await db.trade.findFirst({
    where: {
      status: { in: ["PENDING", "ACCEPTED", "CONFIRMING"] },
      OR: [
        { initiatorId: me.id, responderId },
        { initiatorId: responderId, responderId: me.id },
      ],
    },
  });

  if (existingTrade) {
    return NextResponse.json(
      { error: "Active trade already exists", tradeId: existingTrade.id },
      { status: 409 }
    );
  }

  try {
    const trade = await db.trade.create({
      data: {
        initiatorId: me.id,
        responderId,
        chainId,
        family,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min expiry
      },
    });

    // Create notification for responder
    await db.notification.create({
      data: {
        userId: responderId,
        type: "TRADE_REQUEST",
        title: "Trade Request",
        message: `${me.name ?? "Someone"} wants to trade with you`,
        actorId: me.id,
        metadata: { tradeId: trade.id, chainId },
      },
    });

    return NextResponse.json(trade, {
      status: 201,
      headers: rateLimitHeaders(rl),
    });
  } catch (err) {
    console.error("[TRADES_POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── GET — List Trades ──

export async function GET(req: NextRequest) {
  const me = await MyLibUserAuth();
  if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(getClientIdentifier(req, me.id), "read");
  if (!rl.success) return rateLimitedResponse(rl);

  const query = parseQueryOrError(req, listTradesSchema);
  if (!query.ok) return query.response;

  const { status, limit } = query.data;

  try {
    const statusFilter = status
      ? { status: status.toUpperCase() as "PENDING" | "ACCEPTED" | "CONFIRMING" | "COMPLETED" | "CANCELLED" | "EXPIRED" }
      : {};

    const trades = await db.trade.findMany({
      where: {
        ...statusFilter,
        OR: [{ initiatorId: me.id }, { responderId: me.id }],
      },
      include: {
        Initiator: { select: { id: true, name: true, image: true } },
        Responder: { select: { id: true, name: true, image: true } },
        Items: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ trades }, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    console.error("[TRADES_GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
