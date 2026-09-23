/** @fileOverview Read-only ledger reporting; reserved ceilings are not invoices or profit. @stability active */
import 'server-only';
import { dbPrisma } from '@/lib/db';
import { platformDailyMicroUsd, AI_PLATFORM_DAILY_REQUEST_LIMIT } from '@/lib/ai-credit-ledger';

export async function readAiCreditReport(environment: 'LIVE' | 'SANDBOX' | 'DEMO', now = new Date()) {
  const day = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return dbPrisma.$transaction(async tx => {
    const [accounts, recent, generations, captures, budget] = await Promise.all([
      tx.aiCreditAccount.aggregate({ where: { environment }, _count: { _all: true }, _sum: { balance: true, refundAdjustment: true } }),
      tx.aiCreditAccount.findMany({ where: { environment }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 50,
        select: { userId: true, balance: true, refundAdjustment: true, updatedAt: true, User: { select: { name: true } } } }),
      tx.aiGenerationReservation.groupBy({ by: ['state'], where: { Account: { is: { environment } } },
        _count: { _all: true }, _sum: { credits: true, reservedMicroUsd: true } }),
      tx.checkoutAttempt.aggregate({ where: { environment, captureId: { not: null }, state: { in: ['COMPLETED', 'REFUNDED', 'REVERSED', 'PAYMENT_REVIEW'] } },
        _count: { _all: true }, _sum: { totalOre: true, refundedOre: true } }),
      tx.aiPlatformSpendDay.findUnique({ where: { date: day }, select: { reservedMicroUsd: true, requests: true } }),
    ]);
    const state = (value: string) => generations.find(row => row.state === value);
    return {
      environment, generatedAt: now.toISOString(),
      accounts: { total: accounts._count._all, available: accounts._sum.balance ?? 0, refundAdjustment: accounts._sum.refundAdjustment ?? 0,
        recent: recent.map(row => ({ userId: row.userId, name: row.User.name, available: row.balance, refundAdjustment: row.refundAdjustment, updatedAt: row.updatedAt.toISOString() })) },
      usage: { completed: state('COMPLETED')?._count._all ?? 0, chargedCredits: state('COMPLETED')?._sum.credits ?? 0,
        pending: state('RESERVED')?._count._all ?? 0, reservedCredits: state('RESERVED')?._sum.credits ?? 0,
        refundedRequests: state('REFUNDED')?._count._all ?? 0,
        costCeilingMicroUsd: generations.reduce((sum, row) => sum + (row._sum.reservedMicroUsd ?? 0), 0) },
      payments: { captures: captures._count._all, grossOre: captures._sum.totalOre ?? 0, refundedOre: captures._sum.refundedOre ?? 0 },
      platformToday: { day: day.toISOString().slice(0, 10), reservedMicroUsd: budget?.reservedMicroUsd ?? 0,
        limitMicroUsd: platformDailyMicroUsd(), requests: budget?.requests ?? 0, requestLimit: AI_PLATFORM_DAILY_REQUEST_LIMIT },
    };
  }, { isolationLevel: 'RepeatableRead', maxWait: 5_000, timeout: 15_000 });
}
export type AiCreditReport = Awaited<ReturnType<typeof readAiCreditReport>>;
