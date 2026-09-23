/** @fileOverview Buyer-scoped, read-only credit activity; no payment identifiers or provider secrets. @stability active */
import 'server-only';
import { dbPrisma } from '@/lib/db';
import { aiCreditEnvironment, DEMO_AI_CREDITS } from '@/lib/ai-credit-ledger';

export async function readBuyerCreditHistory(userId: string) {
  const environment = aiCreditEnvironment(userId);
  const accountId = `${environment}:${userId}`;
  return dbPrisma.$transaction(async tx => {
    const [account, entries, pending] = await Promise.all([
      tx.aiCreditAccount.findUnique({ where: { userId_environment: { userId, environment } }, select: { balance: true, refundAdjustment: true } }),
      tx.aiCreditEntry.findMany({ where: { accountId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50,
        select: { id: true, kind: true, delta: true, createdAt: true } }),
      tx.aiGenerationReservation.aggregate({ where: { accountId, state: 'RESERVED' }, _sum: { credits: true }, _count: { _all: true } }),
    ]);
    return { environment, available: account?.balance ?? 0, refundAdjustment: account?.refundAdjustment ?? 0,
      unclaimedDemoAllowance: !account && environment === 'DEMO' ? DEMO_AI_CREDITS : 0,
      reserved: pending._sum.credits ?? 0, pendingRequests: pending._count._all,
      entries: entries.map(entry => ({ ...entry, createdAt: entry.createdAt.toISOString() })) };
  }, { isolationLevel: 'RepeatableRead', maxWait: 5_000, timeout: 15_000 });
}

export const creditEntryLabels: Record<string, string> = {
  PURCHASE: 'Credits purchased', DEMO_GRANT: 'Demo allowance', RESERVE: 'Message reservation',
  REFUND: 'Message credits returned', PAYMENT_REVERSAL: 'Purchase refunded or reversed',
};
