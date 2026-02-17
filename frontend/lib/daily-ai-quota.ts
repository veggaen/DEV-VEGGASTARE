/**
 * @fileOverview Persistent daily AI generation quota (replaces volatile in-memory Map).
 * @stability stable
 *
 * Tracks how many free AI poll generations a user has consumed today.
 * Stored in PostgreSQL via `DailyAiUsage` model — survives Vercel cold starts.
 *
 * BYOK users are exempt (unlimited). This only gates platform-key usage.
 */

import "server-only";

import { dbPrisma } from "@/lib/db";

const DAILY_LIMIT = parseInt(process.env.AI_DAILY_LIMIT || "5", 10);

/** Get today's date as a UTC Date object (time zeroed out). */
function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Check if a user is within their daily free generation quota.
 * Creates a new row if none exists for today (auto-reset on new day).
 */
export async function checkDailyQuota(
  userId: string
): Promise<{ allowed: boolean; remaining: number; used: number; limit: number }> {
  const date = todayUTC();

  const usage = await dbPrisma.dailyAiUsage.findUnique({
    where: { userId_date: { userId, date } },
    select: { count: true },
  });

  const used = usage?.count ?? 0;
  const remaining = Math.max(0, DAILY_LIMIT - used);

  return {
    allowed: used < DAILY_LIMIT,
    remaining,
    used,
    limit: DAILY_LIMIT,
  };
}

/**
 * Atomically increment today's usage count for a user.
 * Uses upsert to handle first-use-of-day and concurrent requests.
 */
export async function incrementDailyUsage(userId: string): Promise<number> {
  const date = todayUTC();

  const result = await dbPrisma.dailyAiUsage.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  return result.count;
}

/** Exported for SSE metadata */
export { DAILY_LIMIT };
