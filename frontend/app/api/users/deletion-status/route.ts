/**
 * @fileOverview API route to check pending account deletion status.
 * @stability active
 */

import { NextResponse } from "next/server";
import { dbPrisma } from "@/lib/db";
import { MyLibUserIDAuth } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await MyLibUserIDAuth();
  if (!userId) return NextResponse.json({ pending: false }, { status: 401 });

  const pending = await dbPrisma.accountDeletionRequest.findFirst({
    where: { userId, status: "PENDING" },
    select: { scheduledFor: true },
    orderBy: { createdAt: "desc" },
  });

  if (pending) {
    return NextResponse.json({ pending: true, scheduledFor: pending.scheduledFor.toISOString() });
  }

  return NextResponse.json({ pending: false });
}
