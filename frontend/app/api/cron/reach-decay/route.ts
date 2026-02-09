/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POST /api/cron/reach-decay
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Daily cron job for Reach system maintenance:
 *   1. Apply momentum decay to inactive pulses/products/companies
 *   2. Recalculate pillar scores from daily aggregates
 *   3. Aggregate user-level reach from their content
 *   4. Create DailyReachRollup records
 *   5. Expire stale resonance multipliers
 *
 * Triggered by:
 *   - Vercel Cron: Add to vercel.json "crons": [{"path":"/api/cron/reach-decay","schedule":"0 3 * * *"}]
 *   - Or manual: POST with CRON_SECRET header
 *
 * Runs at 3 AM UTC daily. Designed to be idempotent.
 */

import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import {
  DECAY_CONFIG,
  PILLAR_WEIGHTS,
} from '@/lib/reach/constants';
import {
  calculateMomentum,
  calculatePillarScores,
  calculateTrueReachScore,
  type PillarInputs,
} from '@/lib/reach/pillar-calculator';

const LOG_PREFIX = '[cron/reach-decay]';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for batch processing

// ─── Auth ────────────────────────────────────────────────────────────────────

function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // No secret configured = allow (dev mode)
  const authHeader = req.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = {
    pulsesDecayed: 0,
    pulsesUpdated: 0,
    productsDecayed: 0,
    companiesDecayed: 0,
    usersAggregated: 0,
    rollupsCreated: 0,
    resonanceExpired: 0,
  };

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // Step 1: Decay momentum on inactive conversations (pulses)
    // ═══════════════════════════════════════════════════════════════════════
    console.log(LOG_PREFIX, 'Step 1: Decaying pulse momentum...');

    const inactivityThreshold = new Date(
      Date.now() - DECAY_CONFIG.INACTIVITY_GRACE_HOURS * 60 * 60 * 1000
    );
    const recentLiftWindow = new Date(
      Date.now() - DECAY_CONFIG.RECENT_LIFT_WINDOW_HOURS * 60 * 60 * 1000
    );

    // Get pulses that need decay (inactive beyond grace period)
    const inactivePulses = await dbPrisma.conversation.findMany({
      where: {
        type: 'PUBLIC_THREAD',
        visibility: 'PUBLIC',
        reachLifetime: { gt: 0 },
        lastActivityAt: { lt: inactivityThreshold },
      },
      select: {
        id: true,
        reachLifetime: true,
        reachMomentum: true,
        lastActivityAt: true,
        resonanceMultiplier: true,
        resonanceExpiresAt: true,
      },
      take: 1000, // Batch limit
    });

    for (const pulse of inactivePulses) {
      // Get recent activity sum for lift calculation
      const recentEvents = await dbPrisma.engagementEvent.aggregate({
        where: {
          conversationId: pulse.id,
          createdAt: { gte: recentLiftWindow },
        },
        _sum: { strength: true },
      });

      const newMomentum = calculateMomentum({
        lifetime: pulse.reachLifetime,
        currentMomentum: pulse.reachMomentum,
        lastActivityAt: pulse.lastActivityAt,
        recentActivitySum: recentEvents._sum.strength ?? 0,
        resonanceMultiplier: pulse.resonanceMultiplier ?? undefined,
        resonanceExpiresAt: pulse.resonanceExpiresAt ?? undefined,
      });

      if (Math.abs(newMomentum - pulse.reachMomentum) > 0.01) {
        await dbPrisma.conversation.update({
          where: { id: pulse.id },
          data: {
            reachMomentum: newMomentum,
            lastMomentumDecay: new Date(),
          },
        });
        stats.pulsesDecayed++;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Step 2: Recalculate pillar scores for active pulses
    // ═══════════════════════════════════════════════════════════════════════
    console.log(LOG_PREFIX, 'Step 2: Recalculating pillar scores...');

    const activePulses = await dbPrisma.conversation.findMany({
      where: {
        type: 'PUBLIC_THREAD',
        visibility: 'PUBLIC',
        reachLifetime: { gt: 0 },
        lastActivityAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Active in last 7d
      },
      select: {
        id: true,
        reachScore: true,
        reachLifetime: true,
        reachMomentum: true,
        viewCount: true,
        uniqueViewCount: true,
        replyCount: true,
        uniqueRepliers: true,
        pillarEngagement: true,
        pillarConversion: true,
        pillarLoyalty: true,
        pillarGrowth: true,
        pillarRecall: true,
        lastActivityAt: true,
        resonanceMultiplier: true,
        resonanceExpiresAt: true,
      },
      take: 500,
    });

    for (const pulse of activePulses) {
      // Gather engagement data for full pillar calculation
      const [engagementAgg, recentEngagements, recentViews, returnVisits] = await Promise.all([
        // Total engagement events
        dbPrisma.engagementEvent.aggregate({
          where: { conversationId: pulse.id },
          _sum: { strength: true },
          _count: true,
        }),
        // Recent engagements (24h) for velocity
        dbPrisma.engagementEvent.aggregate({
          where: {
            conversationId: pulse.id,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
          _sum: { strength: true },
          _count: true,
        }),
        // Recent views (1h) for velocity
        dbPrisma.viewEvent.aggregate({
          where: {
            conversationId: pulse.id,
            viewedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
          },
          _sum: { strength: true },
        }),
        // Return visits for recall
        dbPrisma.engagementEvent.count({
          where: {
            conversationId: pulse.id,
            eventType: 'RETURN_VISIT',
          },
        }),
      ]);

      // Count unique engagers
      const uniqueEngagerRows = await dbPrisma.engagementEvent.groupBy({
        by: ['userId'],
        where: { conversationId: pulse.id, userId: { not: null } },
      });

      // Count repeat engagers (loyalty: users with >2 distinct days)
      const loyalUsers = await dbPrisma.engagementEvent.findMany({
        where: { conversationId: pulse.id, userId: { not: null } },
        select: { userId: true, createdAt: true },
      });
      const userDayMap = new Map<string, Set<string>>();
      for (const ev of loyalUsers) {
        if (!ev.userId) continue;
        const dayKey = ev.createdAt.toISOString().substring(0, 10);
        const days = userDayMap.get(ev.userId) ?? new Set();
        days.add(dayKey);
        userDayMap.set(ev.userId, days);
      }
      const repeatEngagers = [...userDayMap.values()].filter(days => days.size >= 3).length;

      // Build pillar inputs
      const inputs: PillarInputs = {
        reachScore: pulse.reachScore,
        uniqueViewCount: pulse.uniqueViewCount,
        viewCount: pulse.viewCount,
        engagementStrengthSum: engagementAgg._sum.strength ?? 0,
        uniqueEngagers: uniqueEngagerRows.length,
        totalEngagements: engagementAgg._count ?? 0,
        conversionStrengthSum: pulse.pillarConversion,
        exposures: pulse.viewCount,
        repeatEngagers,
        avgInteractionsPerRepeat: repeatEngagers > 0
          ? (engagementAgg._count ?? 0) / repeatEngagers
          : 0,
        totalAudience: pulse.uniqueViewCount + uniqueEngagerRows.length,
        newFollowersFromContent: 0, // TODO: wire from Follow model
        newOrganicVisits: 0, // TODO: track external referrers
        previousAudienceSize: Math.max(pulse.uniqueViewCount, 1),
        uniqueReferrerSources: 0, // TODO: count distinct referrer domains
        returnVisits,
        avgTimeOnReturn: 60, // TODO: compute from dwell events
        totalVisits: pulse.viewCount,
        momentumDelta1h: recentViews._sum.strength ?? 0,
        momentumDelta24h: recentEngagements._sum.strength ?? 0,
        breadthRatio: (engagementAgg._count ?? 0) > 0
          ? uniqueEngagerRows.length / (engagementAgg._count ?? 1)
          : 0,
      };

      const pillars = calculatePillarScores(inputs);
      const trueReach = calculateTrueReachScore(pillars);

      await dbPrisma.conversation.update({
        where: { id: pulse.id },
        data: {
          pillarVisibility: pillars.visibility,
          pillarEngagement: pillars.engagement,
          pillarConversion: pillars.conversion,
          pillarLoyalty: pillars.loyalty,
          pillarGrowth: pillars.growth,
          pillarRecall: pillars.recall,
          pillarVelocity: pillars.velocity,
        },
      });

      stats.pulsesUpdated++;

      // Create daily rollup
      await dbPrisma.dailyReachRollup.upsert({
        where: { conversationId_date: { conversationId: pulse.id, date: today } },
        update: {
          dVisibility: pillars.visibility,
          dEngagement: pillars.engagement,
          dConversion: pillars.conversion,
          dLoyalty: pillars.loyalty,
          dGrowth: pillars.growth,
          dRecall: pillars.recall,
          dVelocity: pillars.velocity,
          totalViews: pulse.viewCount,
          uniqueViewers: pulse.uniqueViewCount,
          totalEngagements: engagementAgg._count ?? 0,
          uniqueEngagers: uniqueEngagerRows.length,
          addedLifetime: pulse.reachLifetime,
          addedMomentum: pulse.reachMomentum,
          breadthRatio: inputs.breadthRatio,
        },
        create: {
          conversationId: pulse.id,
          date: today,
          dVisibility: pillars.visibility,
          dEngagement: pillars.engagement,
          dConversion: pillars.conversion,
          dLoyalty: pillars.loyalty,
          dGrowth: pillars.growth,
          dRecall: pillars.recall,
          dVelocity: pillars.velocity,
          totalViews: pulse.viewCount,
          uniqueViewers: pulse.uniqueViewCount,
          totalEngagements: engagementAgg._count ?? 0,
          uniqueEngagers: uniqueEngagerRows.length,
          addedLifetime: pulse.reachLifetime,
          addedMomentum: pulse.reachMomentum,
          breadthRatio: inputs.breadthRatio,
        },
      });
      stats.rollupsCreated++;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Step 3: Aggregate user-level reach
    // ═══════════════════════════════════════════════════════════════════════
    console.log(LOG_PREFIX, 'Step 3: Aggregating user-level reach...');

    // Get users who own public pulses with reach
    const usersWithReach = await dbPrisma.conversation.groupBy({
      by: ['userId'],
      where: {
        type: 'PUBLIC_THREAD',
        visibility: 'PUBLIC',
        reachLifetime: { gt: 0 },
      },
      _sum: {
        reachLifetime: true,
        reachMomentum: true,
      },
    });

    for (const userAgg of usersWithReach) {
      try {
        await dbPrisma.user.update({
          where: { id: userAgg.userId },
          data: {
            reachLifetime: userAgg._sum.reachLifetime ?? 0,
            reachMomentum: userAgg._sum.reachMomentum ?? 0,
            lastMomentumDecay: new Date(),
          },
        });
        stats.usersAggregated++;
      } catch {
        // User fields might not exist yet
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Step 4: Expire stale resonance multipliers
    // ═══════════════════════════════════════════════════════════════════════
    console.log(LOG_PREFIX, 'Step 4: Expiring stale resonance...');

    const expiredResult = await dbPrisma.conversation.updateMany({
      where: {
        resonanceExpiresAt: { lt: new Date() },
        resonanceMultiplier: { gt: 1 },
      },
      data: {
        resonanceMultiplier: 1.0,
        resonanceExpiresAt: null,
      },
    });
    stats.resonanceExpired = expiredResult.count;

    // ═══════════════════════════════════════════════════════════════════════
    // Step 5: Product/Company momentum decay
    // ═══════════════════════════════════════════════════════════════════════
    console.log(LOG_PREFIX, 'Step 5: Product/Company decay...');

    // Products
    const inactiveProducts = await dbPrisma.product.findMany({
      where: {
        reachLifetime: { gt: 0 },
        updatedAt: { lt: inactivityThreshold },
      },
      select: { id: true, reachLifetime: true, reachMomentum: true },
      take: 500,
    });

    for (const product of inactiveProducts) {
      const newMomentum = product.reachLifetime * DECAY_CONFIG.DAILY_DECAY_RATE;
      const floor = product.reachLifetime * DECAY_CONFIG.MOMENTUM_FLOOR_RATIO;
      await dbPrisma.product.update({
        where: { id: product.id },
        data: {
          reachMomentum: Math.max(floor, newMomentum),
          lastMomentumDecay: new Date(),
        },
      });
      stats.productsDecayed++;
    }

    // Companies
    const inactiveCompanies = await dbPrisma.company.findMany({
      where: {
        reachLifetime: { gt: 0 },
        updatedAt: { lt: inactivityThreshold },
      },
      select: { id: true, reachLifetime: true, reachMomentum: true },
      take: 200,
    });

    for (const company of inactiveCompanies) {
      const newMomentum = company.reachLifetime * DECAY_CONFIG.DAILY_DECAY_RATE;
      const floor = company.reachLifetime * DECAY_CONFIG.MOMENTUM_FLOOR_RATIO;
      await dbPrisma.company.update({
        where: { id: company.id },
        data: {
          reachMomentum: Math.max(floor, newMomentum),
          lastMomentumDecay: new Date(),
        },
      });
      stats.companiesDecayed++;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Done
    // ═══════════════════════════════════════════════════════════════════════
    const durationMs = Date.now() - startTime;
    console.log(LOG_PREFIX, `Completed in ${durationMs}ms`, stats);

    return NextResponse.json({
      success: true,
      durationMs,
      stats,
    });
  } catch (error) {
    console.error(LOG_PREFIX, 'Cron job failed:', error);
    return NextResponse.json(
      { error: 'Cron job failed', details: String(error) },
      { status: 500 }
    );
  }
}
