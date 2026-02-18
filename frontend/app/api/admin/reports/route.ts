/**
 * @fileOverview Admin API route for fetching content reports with filters.
 * @stability active
 */

import { NextRequest, NextResponse } from "next/server";
import { dbPrisma } from "@/lib/db";
import { MyLibUserIDAuth, MyLibRoleAuth } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const role = await MyLibRoleAuth();
  const userId = await MyLibUserIDAuth();
  if (!userId || (role !== "OWNER" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") || "all";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 20;

  const where = statusFilter === "resolved"
    ? { status: { in: ["RESOLVED" as const, "DISMISSED" as const] } }
    : {};

  const [reports, total] = await Promise.all([
    dbPrisma.contentReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        Reporter: { select: { id: true, name: true, image: true } },
        ModerationAction: { select: { action: true, reason: true } },
      },
    }),
    dbPrisma.contentReport.count({ where }),
  ]);

  return NextResponse.json({ reports, total });
}
