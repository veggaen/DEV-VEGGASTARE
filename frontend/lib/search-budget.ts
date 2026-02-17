/**
 * @fileOverview Search budget guard — hard monthly cap on Brave API searches.
 * @stability stable
 *
 * Prevents overcharging by tracking Brave Search API usage per month.
 * When the monthly limit is reached:
 * 1. All future searches fall back to DuckDuckGo (free, unlimited)
 * 2. The platform owner is notified once via email + Pusher
 * 3. The counter auto-resets when a new month starts (new row created)
 *
 * Budget cap is controlled by `BRAVE_MONTHLY_LIMIT` env var (default: 900).
 * Brave free tier gives 1,000 searches/month ($5 credit), so 900 = 10% safety buffer.
 */

import "server-only";

import { dbPrisma } from "@/lib/db";

const BRAVE_MONTHLY_LIMIT = parseInt(process.env.BRAVE_MONTHLY_LIMIT || "900", 10);

/** Get current month as "YYYY-MM" string (UTC). */
function currentMonthKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export type SearchProvider = "brave" | "ddg";

export interface SearchBudgetStatus {
  provider: SearchProvider;
  braveCount: number;
  ddgCount: number;
  braveLimit: number;
  limitReached: boolean;
  month: string;
}

/**
 * Determine which search provider to use based on monthly budget.
 * Returns "brave" if under limit, "ddg" if limit reached or Brave not configured.
 */
export async function resolveSearchProvider(): Promise<SearchBudgetStatus> {
  const month = currentMonthKey();

  // If no Brave API key is configured, always use DDG
  if (!process.env.BRAVE_API_KEY) {
    return {
      provider: "ddg",
      braveCount: 0,
      ddgCount: 0,
      braveLimit: BRAVE_MONTHLY_LIMIT,
      limitReached: false,
      month,
    };
  }

  const usage = await dbPrisma.searchUsage.findUnique({
    where: { month },
    select: { braveCount: true, ddgCount: true, limitReached: true },
  });

  const braveCount = usage?.braveCount ?? 0;
  const ddgCount = usage?.ddgCount ?? 0;
  const limitReached = braveCount >= BRAVE_MONTHLY_LIMIT;

  return {
    provider: limitReached ? "ddg" : "brave",
    braveCount,
    ddgCount,
    braveLimit: BRAVE_MONTHLY_LIMIT,
    limitReached,
    month,
  };
}

/**
 * Record a successful Brave search. If this pushes count to the limit,
 * sets limitReached flag and triggers owner notification.
 *
 * @returns true if this was the search that hit the limit (trigger notification)
 */
export async function incrementBraveUsage(): Promise<boolean> {
  const month = currentMonthKey();

  const result = await dbPrisma.searchUsage.upsert({
    where: { month },
    create: { month, braveCount: 1, ddgCount: 0 },
    update: { braveCount: { increment: 1 } },
    select: { braveCount: true, limitReached: true },
  });

  // Check if we just hit the limit
  if (result.braveCount >= BRAVE_MONTHLY_LIMIT && !result.limitReached) {
    await dbPrisma.searchUsage.update({
      where: { month },
      data: {
        limitReached: true,
        limitReachedAt: new Date(),
      },
    });
    console.warn(
      `[SEARCH-GUARD] Brave monthly limit reached for ${month} (${result.braveCount}/${BRAVE_MONTHLY_LIMIT}). Falling back to DDG.`
    );
    return true; // Caller should trigger owner notification
  }

  return false;
}

/**
 * Record a DuckDuckGo fallback search (for metrics tracking, no limit).
 */
export async function incrementDdgUsage(): Promise<void> {
  const month = currentMonthKey();

  await dbPrisma.searchUsage.upsert({
    where: { month },
    create: { month, braveCount: 0, ddgCount: 1 },
    update: { ddgCount: { increment: 1 } },
  });
}

/**
 * Mark that the owner has been notified about the limit being reached.
 * Prevents duplicate notifications within the same month.
 */
export async function markOwnerNotified(): Promise<void> {
  const month = currentMonthKey();

  await dbPrisma.searchUsage.update({
    where: { month },
    data: { ownerNotifiedAt: new Date() },
  });
}

/**
 * Check if the owner has already been notified this month.
 */
export async function wasOwnerNotified(): Promise<boolean> {
  const month = currentMonthKey();

  const usage = await dbPrisma.searchUsage.findUnique({
    where: { month },
    select: { ownerNotifiedAt: true },
  });

  return usage?.ownerNotifiedAt !== null && usage?.ownerNotifiedAt !== undefined;
}

/**
 * Get full search budget status (for admin dashboard display).
 */
export async function getSearchBudgetStatus(): Promise<SearchBudgetStatus> {
  return resolveSearchProvider();
}

/** Exported for admin display */
export { BRAVE_MONTHLY_LIMIT };
