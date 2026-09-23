/** @fileOverview Atomic AI reservations and an independent platform spending fuse. @stability experimental */
import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { dbPrisma } from '@/lib/db';
import type { PrismaClient } from '@/generated/prisma/client';
import { isDemoUserId } from '@/lib/demo-policy';
import { paypalEnvironment } from '@/lib/payments/showcase-policy';
import { applyAiCreditDelta } from '@/lib/ai-credit-adjustment';

export const DEMO_AI_CREDITS = 5;
export const AI_DAILY_REQUEST_LIMIT = 20;
export const AI_CONCURRENT_REQUEST_LIMIT = 2;
export const AI_RESERVATION_LEASE_MS = 120_000;
export class AiCreditError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

/** Dollars are configuration, never browser input. A malformed value denies all
 * platform use. Even a typo cannot raise the hard $10/day / 500-attempt limit. */
export function platformDailyMicroUsd(raw = process.env.AI_PLATFORM_DAILY_BUDGET_USD): number {
  if (raw === undefined || raw === '') return 5_000_000;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw)) return 0;
  const dollars = Number(raw);
  return Number.isFinite(dollars) ? Math.min(10_000_000, Math.round(dollars * 1_000_000)) : 0;
}

export function aiCreditEnvironment(userId?: string): 'DEMO' | 'LIVE' | 'SANDBOX' {
  return isDemoUserId(userId) ? 'DEMO' : paypalEnvironment().mode;
}

const ReservationInput = z.object({
  userId: z.string().min(1).max(160).optional(),
  // For anonymous callers this must be the server's HMAC, never a raw IP.
  actorKey: z.string().min(1).max(160),
  requestId: z.string().uuid(),
  provider: z.string().regex(/^[A-Z_]{2,24}$/),
  model: z.string().min(1).max(120),
  funding: z.enum(['PLATFORM', 'BYOK']),
  // A server-owned model quote, NOT values accepted in an API request schema.
  credits: z.number().int().min(0).max(100),
  reservedMicroUsd: z.number().int().min(0).max(1_000_000),
}).superRefine((input, ctx) => {
  if (input.funding === 'BYOK' && (input.credits !== 0 || input.reservedMicroUsd !== 0 || !input.userId)) {
    ctx.addIssue({ code: 'custom', message: 'BYOK must be authenticated and never charge platform credits.' });
  }
  if (input.funding === 'PLATFORM' && (input.reservedMicroUsd < 1 || (input.credits > 0 && !input.userId))) {
    ctx.addIssue({ code: 'custom', message: 'Platform calls need a cost ceiling and debits need an account.' });
  }
});
type ReservationRequest = z.input<typeof ReservationInput>;

/** Factory permits real Postgres concurrency tests in a disposable schema.
 * Runtime uses the existing shared Prisma client, not a second connection pool. */
export function createAiCreditLedger(db: PrismaClient) {
  async function settle(id: string, succeeded: boolean) {
    return db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`ai-settle:${id}`}, 0))`;
      const reservation = await tx.aiGenerationReservation.findUnique({ where: { id } });
      if (!reservation || reservation.state !== 'RESERVED') return false;
      await tx.aiGenerationReservation.update({ where: { id }, data: {
        state: succeeded ? 'COMPLETED' : 'REFUNDED', settledAt: new Date(),
      } });
      if (!succeeded && reservation.accountId && reservation.credits > 0) {
        await applyAiCreditDelta(tx, reservation.accountId, reservation.credits);
        await tx.aiCreditEntry.create({ data: { accountId: reservation.accountId, delta: reservation.credits,
          kind: 'REFUND', sourceKey: `ai-refund:${id}` } });
      }
      // Intentionally do NOT refund platform budget or attempt counters: an
      // interrupted stream / timeout can still have cost money at the provider.
      return true;
    }, { maxWait: 10_000, timeout: 15_000 });
  }

  async function recoverExpired(userId: string) {
    const accountId = `${aiCreditEnvironment(userId)}:${userId}`;
    const expired = await db.aiGenerationReservation.findMany({ where: {
      accountId, state: 'RESERVED', createdAt: { lt: new Date(Date.now() - AI_RESERVATION_LEASE_MS) },
    }, select: { id: true }, take: 20 });
    for (const item of expired) await settle(item.id, false);
  }

  async function position(userId: string) {
    await recoverExpired(userId);
    return (await db.aiCreditAccount.findUnique({ where: { id: `${aiCreditEnvironment(userId)}:${userId}` },
      select: { balance: true, refundAdjustment: true } })) ?? { balance: 0, refundAdjustment: 0 };
  }
  async function balance(userId: string) { return (await position(userId)).balance; }

  async function grantDemo(userId: string) {
    if (!isDemoUserId(userId)) throw new AiCreditError('DEMO_SESSION_REQUIRED', 403);
    return db.$transaction(async tx => {
      const accountId = `DEMO:${userId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`ai-demo-grant:${userId}`}, 0))`;
      const sourceKey = `demo-ai-grant:${userId}`;
      const previous = await tx.aiCreditEntry.findUnique({ where: { sourceKey } });
      if (previous) return false;
      await tx.aiCreditAccount.upsert({ where: { id: accountId }, create: {
        id: accountId, userId, environment: 'DEMO', balance: DEMO_AI_CREDITS,
      }, update: { balance: { increment: DEMO_AI_CREDITS } } });
      await tx.aiCreditEntry.create({ data: { accountId, delta: DEMO_AI_CREDITS, kind: 'DEMO_GRANT', sourceKey } });
      return true;
    }, { maxWait: 10_000, timeout: 15_000 });
  }

  async function reserve(raw: ReservationRequest) {
    const input = ReservationInput.parse(raw);
    if (input.userId) await recoverExpired(input.userId);
    const environment = aiCreditEnvironment(input.userId);
    const requestKey = createHash('sha256').update(JSON.stringify([environment, input.userId ?? input.actorKey, input.requestId])).digest('hex');
    const day = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    return db.$transaction(async tx => {
      // All spend paths share this lock. No owner exemption. A repeated request
      // must never start a second provider call, including after a refund.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'ai-platform-budget'}, 0))`;
      if (await tx.aiGenerationReservation.findUnique({ where: { requestKey } })) {
        throw new AiCreditError('AI_REQUEST_ALREADY_USED', 409);
      }
      if (input.userId) {
        // Same global lock covers the check and insertion across tabs/replicas,
        // including free models and BYOK. Expired leases were recovered above.
        const active = await tx.aiGenerationReservation.count({ where: {
          accountId: `${environment}:${input.userId}`, state: 'RESERVED',
        } });
        if (active >= AI_CONCURRENT_REQUEST_LIMIT) throw new AiCreditError('AI_CONCURRENT_LIMIT', 429);
        const usage = await tx.dailyAiUsage.findUnique({ where: { userId_date: { userId: input.userId, date: day } } });
        const limit = isDemoUserId(input.userId) ? DEMO_AI_CREDITS : AI_DAILY_REQUEST_LIMIT;
        if ((usage?.count ?? 0) >= limit) throw new AiCreditError('AI_DAILY_LIMIT', 429);
      }
      if (input.funding === 'PLATFORM') {
        const budget = await tx.aiPlatformSpendDay.findUnique({ where: { date: day } });
        if ((budget?.reservedMicroUsd ?? 0) + input.reservedMicroUsd > platformDailyMicroUsd() || (budget?.requests ?? 0) >= 500) {
          throw new AiCreditError('AI_PLATFORM_DAILY_LIMIT', 503);
        }
      }
      let accountId: string | null = null;
      if (input.userId) {
        accountId = `${environment}:${input.userId}`;
        await tx.aiCreditAccount.upsert({ where: { id: accountId },
          create: { id: accountId, userId: input.userId, environment, balance: 0 }, update: {} });
      }
      if (input.credits > 0 && accountId) {
        const debit = await tx.aiCreditAccount.updateMany({ where: { id: accountId, balance: { gte: input.credits } },
          data: { balance: { decrement: input.credits } } });
        if (debit.count !== 1) throw new AiCreditError('AI_CREDITS_REQUIRED', 402);
      }
      const reservation = await tx.aiGenerationReservation.create({ data: {
        requestKey, accountId, provider: input.provider, model: input.model, credits: input.credits, reservedMicroUsd: input.reservedMicroUsd,
      } });
      if (input.credits > 0 && accountId) await tx.aiCreditEntry.create({ data: {
        accountId, delta: -input.credits, kind: 'RESERVE', sourceKey: `ai-reserve:${reservation.id}`,
      } });
      if (input.userId) await tx.dailyAiUsage.upsert({ where: { userId_date: { userId: input.userId, date: day } },
        create: { userId: input.userId, date: day, count: 1 }, update: { count: { increment: 1 } } });
      if (input.funding === 'PLATFORM') await tx.aiPlatformSpendDay.upsert({ where: { date: day },
        create: { date: day, reservedMicroUsd: input.reservedMicroUsd, requests: 1 },
        update: { reservedMicroUsd: { increment: input.reservedMicroUsd }, requests: { increment: 1 } } });
      return { id: reservation.id, credits: reservation.credits };
    }, { maxWait: 10_000, timeout: 15_000 });
  }
  return { reserve, settle, balance, position, grantDemo, recoverExpired };
}

export const aiCreditLedger = createAiCreditLedger(dbPrisma as PrismaClient);
