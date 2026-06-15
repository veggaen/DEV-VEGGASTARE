/**
 * @fileOverview  Trade History API — unified read endpoint for TradeRecord.
 *                Supports pagination, mode filtering, date ranges, and search.
 *                OWASP: rate-limited, auth-gated, input-validated.
 * @stability     experimental
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbPrisma } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from "@/lib/rate-limit";

// ── Input validation (CIS: never trust client input) ──────────────────────

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  mode: z.enum(["P2P", "SELF", "DEX", "PAPER", "LOCAL", "ALL"]).default("ALL"),
  status: z.enum(["PENDING", "COMPLETED", "FAILED", "REVERTED", "ALL"]).default("ALL"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  token: z.string().trim().max(20).optional(), // filter by token symbol
  companyId: z.string().trim().max(200).optional(), // company context
  taxYear: z.coerce.number().int().min(2020).max(2100).optional(),
});

export async function GET(req: NextRequest) {
  // Rate limit (CIS: protect against abuse)
  const rl = await checkRateLimit(getClientIdentifier(req), "trade");
  if (!rl.success) return rateLimitedResponse(rl);

  // Auth gate
  const me = await MyLibUserAuth();
  if (!me?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse + validate query params
  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { page, limit, mode, status, from, to, token, companyId, taxYear } = parsed.data;

  // Build where clause — user can only see their own trades
  const where: Record<string, unknown> = { userId: me.id };

  if (mode !== "ALL") where.mode = mode;
  if (status !== "ALL") where.status = status;
  if (from || to) {
    where.executedAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  if (token) {
    where.OR = [
      { sellToken: { equals: token, mode: "insensitive" } },
      { buyToken: { equals: token, mode: "insensitive" } },
    ];
  }
  if (companyId) where.companyId = companyId;
  if (taxYear) where.taxYear = taxYear;

  // Execute query with pagination
  const [records, total] = await dbPrisma.$transaction([
    dbPrisma.tradeRecord.findMany({
      where,
      orderBy: { executedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        mode: true,
        sellToken: true,
        sellDisplayAmt: true,
        sellChainId: true,
        buyToken: true,
        buyDisplayAmt: true,
        buyChainId: true,
        priceUsd: true,
        priceNok: true,
        feeUsd: true,
        gainLossUsd: true,
        gainLossNok: true,
        txHash: true,
        walletAddress: true,
        counterpartyId: true,
        environment: true,
        status: true,
        companyId: true,
        executedAt: true,
      },
    }),
    dbPrisma.tradeRecord.count({ where }),
  ]);

  return NextResponse.json({
    records,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
