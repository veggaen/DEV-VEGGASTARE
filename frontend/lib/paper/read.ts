/** @fileOverview Account-scoped durable paper portfolio and history reads. @stability experimental */
import 'server-only';
import { z } from 'zod';
import { PaperTradeType } from '@/generated/prisma/client';
import { dbPrisma as db } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { getTokenPrices, type PriceQuote } from './price-feed';

type ReadResult<T> = { success: true; data: T } | {
  success: false; code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'UNAVAILABLE' | 'INVALID'; error: string;
};
export type PaperPortfolioSnapshot = {
  portfolio: { id: string; startingBalance: number; cashBalance: number; resetCount: number };
  positions: Array<{ tokenSymbol: string; tokenAddress: string; chainId: number; displayAmount: string;
    avgEntryPrice: number; currentPriceUsd: number | null; valueUsd: number | null; pnlUsd: number | null; pnlPercent: number | null }>;
  totalValueUsd: number | null; totalPnlUsd: number | null; totalPnlPercent: number | null;
};
export type PaperHistoryRow = { id: string; type: PaperTradeType; sellToken: string | null;
  sellDisplayAmt: string | null; sellPriceUsd: number | null; buyToken: string | null;
  buyDisplayAmt: string | null; buyPriceUsd: number | null; feeUsd: number | null; executedAt: Date };
export type PaperHistoryPage = { trades: PaperHistoryRow[]; nextCursor: string | null };
const historySchema = z.object({ limit: z.number().int().min(1).max(200).default(50),
  cursor: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional(), type: z.nativeEnum(PaperTradeType).optional() }).strict();
export type PaperHistoryOptions = z.input<typeof historySchema>;

async function currentReader() {
  const user = await MyLibUserAuth();
  if (!user?.id || !Number.isSafeInteger(user.sessionVersion) || user.impersonatingFromId) return null;
  const current = await db.user.findUnique({ where: { id: user.id }, select: { tokenVersion: true } });
  return current?.tokenVersion === user.sessionVersion ? user.id : null;
}
const unauthorized = { success: false, code: 'UNAUTHORIZED', error: 'Sign in again to view your paper account.' } as const;
const missing = { success: false, code: 'NOT_FOUND', error: 'No paper portfolio yet.' } as const;

export async function readPaperPortfolio(): Promise<ReadResult<PaperPortfolioSnapshot>> {
  try {
    const userId = await currentReader(); if (!userId) return unauthorized;
    const portfolio = await db.paperPortfolio.findUnique({ where: { userId }, include: { Positions: true } });
    if (!portfolio) return missing;
    // A price outage must not hide stored holdings or turn them into a 100% loss.
    const prices = await getTokenPrices(portfolio.Positions.map(p => p.tokenSymbol)).catch(() => new Map<string, PriceQuote>());
    const positions = portfolio.Positions.filter(p => BigInt(p.amount) > BigInt(0)).map(pos => {
      const quote = prices.get(pos.tokenSymbol.toUpperCase());
      const price = quote && Number.isFinite(quote.usd) && quote.usd > 0 && (quote.staleMs ?? 0) <= 60_000 ? quote.usd : null;
      const valueUsd = price === null ? null : Number(pos.displayAmount) * price;
      const pnlUsd = valueUsd === null ? null : valueUsd - pos.totalCostBasis;
      return { tokenSymbol: pos.tokenSymbol, tokenAddress: pos.tokenAddress, chainId: pos.chainId,
        displayAmount: pos.displayAmount, avgEntryPrice: pos.avgEntryPrice, currentPriceUsd: price, valueUsd, pnlUsd,
        pnlPercent: pnlUsd === null ? null : pos.totalCostBasis > 0 ? pnlUsd / pos.totalCostBasis * 100 : 0 };
    });
    const totalValueUsd = positions.some(p => p.valueUsd === null) ? null : positions.reduce((sum, p) => sum + p.valueUsd!, portfolio.cashBalance);
    const totalPnlUsd = totalValueUsd === null ? null : totalValueUsd - portfolio.startingBalance;
    return { success: true, data: { portfolio: { id: portfolio.id, startingBalance: portfolio.startingBalance,
      cashBalance: portfolio.cashBalance, resetCount: portfolio.resetCount }, positions, totalValueUsd, totalPnlUsd,
      totalPnlPercent: totalPnlUsd === null ? null : portfolio.startingBalance > 0 ? totalPnlUsd / portfolio.startingBalance * 100 : 0 } };
  } catch {
    return { success: false, code: 'UNAVAILABLE', error: 'Your saved portfolio is temporarily unavailable. Try again.' };
  }
}

export async function readPaperHistory(options: PaperHistoryOptions = {}): Promise<ReadResult<PaperHistoryPage>> {
  const parsed = historySchema.safeParse(options);
  if (!parsed.success) return { success: false, code: 'INVALID', error: 'Refresh the trade history and try again.' };
  try {
    const userId = await currentReader(); if (!userId) return unauthorized;
    const portfolio = await db.paperPortfolio.findUnique({ where: { userId }, select: { id: true } });
    if (!portfolio) return missing;
    const { cursor, limit, type } = parsed.data;
    const scope = { portfolioId: portfolio.id, ...(type ? { type } : {}) };
    const anchor = cursor ? await db.paperTrade.findFirst({ where: { ...scope, id: cursor }, select: { id: true, executedAt: true } }) : null;
    if (cursor && !anchor) return { success: false, code: 'INVALID', error: 'This history page is no longer available. Refresh to start again.' };
    const rows = await db.paperTrade.findMany({
      where: { ...scope, ...(anchor ? { OR: [{ executedAt: { lt: anchor.executedAt } }, { executedAt: anchor.executedAt, id: { lt: anchor.id } }] } : {}) },
      orderBy: [{ executedAt: 'desc' }, { id: 'desc' }], take: limit + 1,
      select: { id: true, type: true, sellToken: true, sellDisplayAmt: true, sellPriceUsd: true,
        buyToken: true, buyDisplayAmt: true, buyPriceUsd: true, feeUsd: true, executedAt: true },
    });
    const trades = rows.slice(0, limit);
    return { success: true, data: { trades, nextCursor: rows.length > limit ? trades.at(-1)!.id : null } };
  } catch {
    return { success: false, code: 'UNAVAILABLE', error: 'Trade history is temporarily unavailable. Try again.' };
  }
}
