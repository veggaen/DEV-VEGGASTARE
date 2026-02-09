/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POST /api/interact
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Unified interaction hub for the 7-pillar Reach system.
 * Accepts batched engagement events from the client-side tracker
 * and processes them into the EngagementEvent table + pillar increments.
 *
 * This runs alongside the existing /api/conversations/[id]/view route
 * (Pillar 1 views stay there for backward compat). This hub handles
 * Pillars 2-7: clicks, hovers, scrolls, dwell, saves, comments,
 * heartbeats, repulses, conversions, return visits, tab focus, etc.
 *
 * Client sends batches every 10s or on page unload via sendBeacon.
 */

import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import {
  calculateEngagementStrength,
  type EngagementType,
} from '@/lib/reach/engagement-strength';
import {
  determineUserVerificationTier,
  type VerificationTier,
} from '@/lib/view-strength';
import { propagateEcho } from '@/lib/reach/echo-propagation';
import { checkResonance } from '@/lib/reach/pillar-calculator';
import { ANTI_GAMING, RESONANCE_CONFIG } from '@/lib/reach/constants';
import { z } from 'zod';

const LOG_PREFIX = '[api/interact]';

// ─── Request Validation ──────────────────────────────────────────────────────

const InteractionEventSchema = z.object({
  eventType: z.enum([
    'CLICK', 'HOVER_DEEP_READ', 'SCROLL_DEPTH', 'DWELL_TIME',
    'SAVE_BOOKMARK', 'COPY_TEXT', 'COMMENT_SHORT', 'COMMENT_LONG',
    'COMMENT_THREAD', 'HEARTBEAT', 'REPULSE', 'SHARE_EXTERNAL',
    'PRODUCT_VIEW', 'PRODUCT_CLICK', 'ADD_TO_CART', 'PURCHASE',
    'PROFILE_FOLLOW', 'RETURN_VISIT', 'TAB_REFOCUS',
  ]),
  details: z.record(z.unknown()).optional(),
  timestamp: z.number().optional(), // Unix ms
});

const InteractRequestSchema = z.object({
  conversationId: z.string().optional(),
  productId: z.string().optional(),
  companyId: z.string().optional(),
  sessionId: z.string().optional(),
  events: z.array(InteractionEventSchema).min(1).max(50),
});

// ─── IP Hashing ──────────────────────────────────────────────────────────────

function hashIp(ip: string): string {
  return crypto
    .createHash('sha256')
    .update(ip + (process.env.NEXTAUTH_SECRET ?? ''))
    .digest('hex')
    .substring(0, 32);
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = InteractRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { conversationId, productId, companyId, sessionId, events } = parsed.data;

    // At least one target required
    if (!conversationId && !productId && !companyId) {
      return NextResponse.json(
        { error: 'At least one of conversationId, productId, or companyId is required' },
        { status: 400 }
      );
    }

    // Auth + IP
    const session = await MyLibUserAuth();
    const userId = session?.id ?? null;
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';
    const ipHash = hashIp(ip);

    // Rate limit check: count recent events from this user/ip on this content
    if (conversationId && userId) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCount = await dbPrisma.engagementEvent.count({
        where: {
          conversationId,
          userId,
          createdAt: { gte: oneHourAgo },
        },
      });
      if (recentCount >= ANTI_GAMING.MAX_EVENTS_PER_USER_PER_HOUR) {
        return NextResponse.json(
          { error: 'Rate limited', processed: 0 },
          { status: 429 }
        );
      }
    }

    // Get user verification tier
    let verificationTier: VerificationTier = 'ANONYMOUS';
    if (userId) {
      try {
        const user = await dbPrisma.user.findUnique({
          where: { id: userId },
          select: {
            hasGoogleAuth: true,
            hasDiscordAuth: true,
            hasGithubAuth: true,
            hasVerifiedWallet: true,
            hasWeb2Payment: true,
            hasWeb3Payment: true,
            phoneVerified: true,
            emailVerified: true,
            web3ModeEnabled: true,
            createdAt: true,
          },
        });
        if (user) {
          verificationTier = determineUserVerificationTier(user);
        }
      } catch {
        // Fallback: fields might not exist yet
      }
    }

    // Count previous actions for uniqueness decay
    let previousActionCount = 0;
    if (userId && conversationId) {
      previousActionCount = await dbPrisma.engagementEvent.count({
        where: {
          conversationId,
          userId,
        },
      });
    }

    // Process each event
    let totalStrength = 0;
    const pillarDeltas = {
      engagement: 0,
      conversion: 0,
      recall: 0,
      loyalty: 0,
      growth: 0,
    };

    for (const event of events) {
      const result = calculateEngagementStrength({
        verificationTier,
        eventType: event.eventType as EngagementType,
        previousActionCount,
        threadDepth: (event.details?.threadDepth as number) ?? 0,
        threadClusterSize: (event.details?.threadClusterSize as number) ?? 0,
      });

      // Persist engagement event
      await dbPrisma.engagementEvent.create({
        data: {
          conversationId,
          productId,
          companyId,
          userId,
          ipHash,
          sessionId: sessionId ?? undefined,
          eventType: event.eventType,
          strength: result.strength,
          details: event.details ?? undefined,
          referrer: headersList.get('referer') ?? undefined,
        },
      });

      totalStrength += result.strength;
      pillarDeltas[result.primaryPillar] += result.strength;
      previousActionCount++; // Increment for subsequent events in batch
    }

    // Update conversation reach metrics
    if (conversationId) {
      await dbPrisma.conversation.update({
        where: { id: conversationId },
        data: {
          reachLifetime: { increment: totalStrength },
          reachMomentum: { increment: totalStrength },
          reachScore: { increment: totalStrength }, // Keep legacy field in sync
          pillarEngagement: { increment: pillarDeltas.engagement },
          pillarConversion: { increment: pillarDeltas.conversion },
          pillarRecall: { increment: pillarDeltas.recall },
          pillarLoyalty: { increment: pillarDeltas.loyalty },
          pillarGrowth: { increment: pillarDeltas.growth },
          lastActivityAt: new Date(),
        },
      });

      // Echo propagation: if this pulse is a repost, echo credit flows upstream
      const conv = await dbPrisma.conversation.findUnique({
        where: { id: conversationId },
        select: { repostOfConversationId: true },
      });
      if (conv?.repostOfConversationId) {
        await propagateEcho(conversationId, totalStrength);
      }

      // Check for community resonance
      await checkAndApplyResonance(conversationId);
    }

    // Update product reach
    if (productId) {
      await dbPrisma.product.update({
        where: { id: productId },
        data: {
          reachLifetime: { increment: totalStrength },
          reachMomentum: { increment: totalStrength },
          viewCount: events.some(e => e.eventType === 'PRODUCT_VIEW')
            ? { increment: 1 }
            : undefined,
        },
      });

      // Echo from product to linked pulses
      const links = await dbPrisma.pulseProductLink.findMany({
        where: { productId },
        select: { conversationId: true, weight: true },
      });
      for (const link of links) {
        const echoAmount = totalStrength * 0.15 * link.weight;
        if (echoAmount > 0.01) {
          await dbPrisma.conversation.update({
            where: { id: link.conversationId },
            data: {
              reachMomentum: { increment: echoAmount },
              reachLifetime: { increment: echoAmount },
              echoInbound: { increment: echoAmount },
            },
          });
        }
      }
    }

    // Update company reach
    if (companyId) {
      await dbPrisma.company.update({
        where: { id: companyId },
        data: {
          reachLifetime: { increment: totalStrength * 0.3 },
          reachMomentum: { increment: totalStrength * 0.3 },
        },
      });
    }

    // Update user-level reach (materialized aggregate)
    if (userId) {
      await dbPrisma.user.update({
        where: { id: userId },
        data: {
          // User reach grows from their engagements at a reduced rate
          // (user reach mostly comes from their *content's* reach, not their browsing)
        },
      }).catch(() => {
        // Fields might not exist yet
      });
    }

    console.log(
      LOG_PREFIX,
      `Processed ${events.length} events | tier=${verificationTier} | strength=${totalStrength.toFixed(2)} | pulse=${conversationId ?? 'none'} | product=${productId ?? 'none'}`
    );

    return NextResponse.json({
      processed: events.length,
      totalStrength: Math.round(totalStrength * 100) / 100,
      pillarDeltas,
    });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error processing interactions:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// ─── Resonance Helper ────────────────────────────────────────────────────────

async function checkAndApplyResonance(conversationId: string) {
  try {
    const windowStart = new Date(
      Date.now() - RESONANCE_CONFIG.WINDOW_HOURS * 60 * 60 * 1000
    );

    // Count unique engagers and total events in window
    const recentEvents = await dbPrisma.engagementEvent.findMany({
      where: {
        conversationId,
        createdAt: { gte: windowStart },
        userId: { not: null },
      },
      select: { userId: true },
    });

    const uniqueUserIds = new Set(recentEvents.map((e: { userId: string | null }) => e.userId));
    const result = checkResonance({
      uniqueEngagersInWindow: uniqueUserIds.size,
      totalEventsInWindow: recentEvents.length,
    });

    if (result) {
      await dbPrisma.conversation.update({
        where: { id: conversationId },
        data: {
          resonanceMultiplier: result.multiplier,
          resonanceExpiresAt: result.expiresAt,
        },
      });
      console.log(
        LOG_PREFIX,
        `[resonance] Triggered for ${conversationId}: ${result.multiplier}x until ${result.expiresAt.toISOString()}`
      );
    }
  } catch (error) {
    console.error(LOG_PREFIX, 'Resonance check failed:', error);
  }
}
