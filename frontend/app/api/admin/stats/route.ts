/**
 * @fileOverview Admin dashboard stats endpoint
 * @stability stable
 *
 * GET /api/admin/stats
 * Returns aggregate platform metrics for the admin dashboard.
 * Requires ADMIN or OWNER role.
 */

import { NextResponse } from "next/server";
import { dbPrisma } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";

const LOG_PREFIX = "[api/admin/stats]";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await MyLibUserAuth();
  if (!user?.id || (user.role !== "ADMIN" && user.role !== "OWNER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const [
      totalUsers,
      totalCompanies,
      totalProducts,
      totalPolls,
      pendingReviewCount,
      scheduledPollsActive,
      todayAiUsageAgg,
      recentAiUsers,
    ] = await Promise.all([
      dbPrisma.user.count(),
      dbPrisma.company.count(),
      dbPrisma.product.count(),
      dbPrisma.advancedPoll.count(),
      dbPrisma.advancedPoll.count({ where: { reviewStatus: "PENDING_REVIEW" } }),
      dbPrisma.scheduledPoll.count({ where: { isActive: true } }),
      dbPrisma.dailyAiUsage.aggregate({
        where: { date: todayStart },
        _sum: { count: true },
        _count: true,
      }),
      dbPrisma.dailyAiUsage.findMany({
        where: { date: todayStart },
        orderBy: { count: "desc" },
        take: 5,
        include: { User: { select: { id: true, name: true, email: true, image: true } } },
      }),
    ]);

    return NextResponse.json({
      platform: {
        totalUsers,
        totalCompanies,
        totalProducts,
        totalPolls,
      },
      ai: {
        todayGenerations: todayAiUsageAgg._sum.count ?? 0,
        todayActiveUsers: todayAiUsageAgg._count,
        pendingReviewCount,
        scheduledPollsActive,
        topUsersToday: recentAiUsers.map((u) => ({
          userId: u.userId,
          name: u.User.name,
          email: u.User.email,
          image: u.User.image,
          count: u.count,
        })),
      },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching stats:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
