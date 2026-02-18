/**
 * @fileOverview API route to get the current user's content reports.
 * @stability active
 */

import { NextResponse } from "next/server";
import { dbPrisma } from "@/lib/db";
import { MyLibUserIDAuth } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await MyLibUserIDAuth();
  if (!userId) return NextResponse.json([], { status: 401 });

  const reports = await dbPrisma.contentReport.findMany({
    where: { reporterId: userId },
    select: {
      id: true,
      contentType: true,
      reason: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(reports);
}
