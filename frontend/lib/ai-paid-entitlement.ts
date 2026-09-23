/** @fileOverview Legacy entitlement display backed only by the verified credit ledger. @stability experimental */
import "server-only";
import { dbPrisma } from "@/lib/db";
import { aiCreditEnvironment, aiCreditLedger, AI_DAILY_REQUEST_LIMIT } from "@/lib/ai-credit-ledger";

export async function getPaidAiEntitlement(userId: string) {
  const remainingCredits = await aiCreditLedger.balance(userId);
  const accountId = `${aiCreditEnvironment(userId)}:${userId}`;
  const granted = await dbPrisma.aiCreditEntry.aggregate({ where: { accountId, kind: { in: ["PURCHASE", "DEMO_GRANT"] }, delta: { gt: 0 } }, _sum: { delta: true } });
  const totalCredits = granted._sum.delta ?? 0;
  return { hasAccess: remainingCredits > 0, dailyLimit: AI_DAILY_REQUEST_LIMIT, purchasedProductIds: [] as string[],
    mode: totalCredits > 0 ? "credit_pack" as const : "none" as const,
    totalCredits, usedCredits: Math.max(0, totalCredits - remainingCredits), remainingCredits };
}
