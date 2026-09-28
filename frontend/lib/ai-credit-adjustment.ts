/** @fileOverview Apply signed credit changes atomically without negative available balances. @stability experimental */
import 'server-only';
import type { Prisma } from '@/generated/prisma/client';

export async function applyAiCreditDelta(tx: Prisma.TransactionClient, accountId: string, delta: number) {
  if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000) throw new Error('INVALID_CREDIT_ADJUSTMENT');
  // Compare-and-swap includes BOTH accounting fields, so a simultaneous reserve,
  // purchase or failed generation cannot be overwritten. Prisma also preserves
  // the configured schema (unqualified raw SQL would escape isolated test DBs).
  for (let retry = 0; retry < 8; retry++) {
    const current = await tx.aiCreditAccount.findUnique({ where: { id: accountId },
      select: { balance: true, refundAdjustment: true } });
    if (!current) throw new Error('CREDIT_ACCOUNT_NOT_FOUND');
    const net = current.balance - current.refundAdjustment + delta;
    const changed = await tx.aiCreditAccount.updateMany({
      where: { id: accountId, balance: current.balance, refundAdjustment: current.refundAdjustment },
      data: { balance: Math.max(0, net), refundAdjustment: Math.max(0, -net) },
    });
    if (changed.count === 1) return;
  }
  // Roll the caller's complete transaction back. Webhooks retry; no partial
  // entitlement or ledger entry may survive a highly contended adjustment.
  throw new Error('CREDIT_ADJUSTMENT_RETRY');
}
