import { z } from 'zod';
import type { AiCreditReport } from './ai-credit-report';

export const creditReportEnvironments = ['LIVE', 'SANDBOX', 'DEMO'] as const;
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const timestamp = z.string().datetime();
const reportSchema = z.object({
  environment: z.enum(creditReportEnvironments), generatedAt: timestamp,
  accounts: z.object({
    total: count, available: count, refundAdjustment: count,
    recent: z.array(z.object({ userId: z.string().min(1).max(160), name: z.string().nullable(),
      available: count, refundAdjustment: count, updatedAt: timestamp })).max(50),
  }),
  usage: z.object({ completed: count, chargedCredits: count, pending: count, reservedCredits: count,
    refundedRequests: count, costCeilingMicroUsd: count }),
  payments: z.object({ captures: count, grossOre: count, refundedOre: count }),
  platformToday: z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reservedMicroUsd: count,
    limitMicroUsd: count, requests: count, requestLimit: count }),
});

/** Do not render an invalid or wrong-environment financial response as zero. */
export function parseCreditReport(body: unknown, environment: string | null): AiCreditReport {
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success || (environment !== null && parsed.data.environment !== environment)
    || parsed.data.accounts.recent.length > parsed.data.accounts.total) throw new Error('Invalid credit report');
  return parsed.data;
}

export function creditReportFailure(status: number): string {
  return status === 429 ? 'Wait a moment before refreshing again.'
    : status === 400 ? 'Choose Live, Sandbox or Demo.' : 'The report could not be loaded. Try again.';
}
