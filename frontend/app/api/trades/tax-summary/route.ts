/**
 * GET /api/trades/tax-summary — Aggregated tax summary for a tax year.
 *
 * Server-side aggregation: sums gains, losses, fees from TradeRecord
 * for the authenticated user. Much more efficient than fetching all
 * records and computing client-side.
 *
 * Query params:
 *   - taxYear (required): e.g. 2025
 *   - companyId (optional): for company-level tax summary
 *
 * @stability experimental
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

const querySchema = z.object({
  taxYear: z.coerce.number().int().min(2020).max(2100),
  companyId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const user = await MyLibUserAuth();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(getClientIdentifier(req, user.id), "read");
  if (!rl.success) return rateLimitedResponse(rl);

  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = querySchema.safeParse(sp);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { taxYear, companyId } = parsed.data;

  try {
    const where = {
      userId: user.id,
      taxYear,
      status: "COMPLETED" as const,
      ...(companyId ? { companyId } : {}),
    };

    // Run all aggregations in parallel
    const [totals, exported, totalCount, modeBreakdown] = await Promise.all([
      // Sum gains, losses, fees
      db.tradeRecord.aggregate({
        where,
        _sum: {
          gainLossUsd: true,
          gainLossNok: true,
          feeUsd: true,
          feeNok: true,
          priceUsd: true,
          priceNok: true,
          costBasisUsd: true,
          costBasisNok: true,
        },
        _count: true,
      }),

      // Count exported records
      db.tradeRecord.count({
        where: { ...where, taxExported: true },
      }),

      // Total count including non-completed
      db.tradeRecord.count({
        where: { userId: user.id, taxYear },
      }),

      // Breakdown by trade mode
      db.tradeRecord.groupBy({
        by: ["mode"],
        where,
        _count: true,
        _sum: {
          gainLossUsd: true,
          gainLossNok: true,
          feeUsd: true,
          feeNok: true,
        },
      }),
    ]);

    // Separate gains from losses by scanning aggregated data
    // We need a raw query for conditional sums since Prisma aggregate doesn't support CASE WHEN
    const [gainRows, lossRows] = await Promise.all([
      db.tradeRecord.aggregate({
        where: { ...where, gainLossUsd: { gt: 0 } },
        _sum: { gainLossUsd: true, gainLossNok: true },
        _count: true,
      }),
      db.tradeRecord.aggregate({
        where: { ...where, gainLossUsd: { lt: 0 } },
        _sum: { gainLossUsd: true, gainLossNok: true },
        _count: true,
      }),
    ]);

    const summary = {
      taxYear,
      totalTradesCount: totalCount,
      completedTradesCount: totals._count,

      // Gains (positive gainLoss)
      totalGainUsd: gainRows._sum.gainLossUsd ?? 0,
      totalGainNok: gainRows._sum.gainLossNok ?? 0,
      gainTradesCount: gainRows._count,

      // Losses (negative gainLoss → absolute value)
      totalLossUsd: Math.abs(lossRows._sum.gainLossUsd ?? 0),
      totalLossNok: Math.abs(lossRows._sum.gainLossNok ?? 0),
      lossTradesCount: lossRows._count,

      // Net
      netGainUsd: (totals._sum.gainLossUsd ?? 0),
      netGainNok: (totals._sum.gainLossNok ?? 0),

      // Fees
      totalFeesUsd: totals._sum.feeUsd ?? 0,
      totalFeesNok: totals._sum.feeNok ?? 0,

      // Volume
      totalVolumeUsd: totals._sum.priceUsd ?? 0,
      totalVolumeNok: totals._sum.priceNok ?? 0,

      // Cost basis
      totalCostBasisUsd: totals._sum.costBasisUsd ?? 0,
      totalCostBasisNok: totals._sum.costBasisNok ?? 0,

      // Export status
      exportedCount: exported,
      unexportedCount: totals._count - exported,

      // Mode breakdown
      byMode: modeBreakdown.map((m) => ({
        mode: m.mode,
        count: m._count,
        gainLossUsd: m._sum.gainLossUsd ?? 0,
        gainLossNok: m._sum.gainLossNok ?? 0,
        feesUsd: m._sum.feeUsd ?? 0,
        feesNok: m._sum.feeNok ?? 0,
      })),
    };

    return NextResponse.json(
      { summary },
      { headers: rateLimitHeaders(rl) },
    );
  } catch (err) {
    console.error("[TAX_SUMMARY]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
