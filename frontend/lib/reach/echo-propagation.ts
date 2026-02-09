/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Reach 7-Pillar System — Echo Propagation
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The "Origin Echo" mechanic — your signature propagation feature.
 *
 * When content is repulsed (reposted), a percentage of the child's incoming
 * engagement flows back as "echo credit" to the original parent:
 *
 *   A creates pulse → B repulses A → C views B's repulse
 *   → 20% of C's view strength echoes back to A's pulse
 *   → If D repulses B's repulse, 10% flows back to A (grandparent)
 *
 * Anti-gaming: echo only flows if child has >3 unique engagers.
 * This creates measurable viral trees — users see:
 *   "This pulse propagated to 47 child pulses → +2.1k echo reach"
 */

import { dbPrisma } from '@/lib/db';
import { ECHO_CONFIG } from './constants';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EchoResult {
  /** Echoes applied [parentPulseId → echoAmount] */
  echoes: Map<string, number>;
  /** total echo credit distributed */
  totalEchoCredit: number;
}

// ─── Echo on Engagement ──────────────────────────────────────────────────────

/**
 * When a child pulse (repulse) receives engagement, propagate echo credit
 * back through the repulse chain.
 *
 * Call this after recording any engagement on a pulse that is a repost.
 *
 * @param childPulseId - The pulse that received the engagement
 * @param engagementStrength - The strength of the engagement event
 * @returns Map of parentPulseId → echo credit applied
 */
export async function propagateEcho(
  childPulseId: string,
  engagementStrength: number
): Promise<EchoResult> {
  const echoes = new Map<string, number>();
  let totalEchoCredit = 0;

  try {
    // Walk up the repulse chain
    let currentPulseId = childPulseId;
    let depth = 0;

    while (depth < ECHO_CONFIG.MAX_ECHO_DEPTH) {
      // Find if this pulse is a repost of another
      const pulse = await dbPrisma.conversation.findUnique({
        where: { id: currentPulseId },
        select: {
          repostOfConversationId: true,
        },
      });

      if (!pulse?.repostOfConversationId) break; // Not a repost, stop

      const parentPulseId = pulse.repostOfConversationId;
      depth++;

      // Check anti-gaming: child must have enough unique engagers
      const uniqueEngagers = await countUniqueEngagers(currentPulseId);
      if (uniqueEngagers < ECHO_CONFIG.MIN_ENGAGERS_FOR_ECHO) {
        break; // Not enough organic engagement to propagate
      }

      // Calculate echo rate based on depth
      const echoRate =
        depth === 1
          ? ECHO_CONFIG.DIRECT_ECHO_RATE
          : ECHO_CONFIG.INDIRECT_ECHO_RATE / depth; // Further damping

      const echoCredit = Math.min(
        engagementStrength * echoRate,
        ECHO_CONFIG.DAILY_ECHO_CAP
      );

      if (echoCredit < 0.001) break; // Not worth tracking

      // Upsert echo edge
      await dbPrisma.echoEdge.upsert({
        where: {
          parentPulseId_childPulseId: {
            parentPulseId,
            childPulseId: currentPulseId,
          },
        },
        update: {
          echoStrength: { increment: echoCredit },
          uniqueEngagers,
          updatedAt: new Date(),
        },
        create: {
          parentPulseId,
          childPulseId: currentPulseId,
          depth,
          echoStrength: echoCredit,
          uniqueEngagers,
        },
      });

      // Apply echo credit to parent pulse
      await dbPrisma.conversation.update({
        where: { id: parentPulseId },
        data: {
          echoInbound: { increment: echoCredit },
          reachLifetime: { increment: echoCredit },
          reachMomentum: { increment: echoCredit },
          lastActivityAt: new Date(),
        },
      });

      echoes.set(parentPulseId, (echoes.get(parentPulseId) ?? 0) + echoCredit);
      totalEchoCredit += echoCredit;

      // Continue up the chain
      currentPulseId = parentPulseId;
    }
  } catch (error) {
    console.error('[echo-propagation] Error propagating echo:', error);
  }

  return { echoes, totalEchoCredit };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Count unique engagers on a pulse (unique users who viewed, pulsed, commented, or repulsed).
 */
async function countUniqueEngagers(conversationId: string): Promise<number> {
  // Count unique view users + unique message authors + unique pulsers
  const [views, replies, pulses] = await Promise.all([
    dbPrisma.conversationView.count({
      where: { conversationId, userId: { not: null } },
    }),
    dbPrisma.message.groupBy({
      by: ['senderId'],
      where: { conversationId },
    }),
    dbPrisma.pulse.count({
      where: { conversationId },
    }),
  ]);

  // Rough unique count (views are already unique per-user from ConversationView)
  return views + replies.length + pulses;
}

/**
 * Get echo chain stats for display.
 * Returns how many child pulses and total echo reach for a given parent.
 */
export async function getEchoStats(parentPulseId: string): Promise<{
  childPulseCount: number;
  totalEchoReach: number;
  maxDepth: number;
}> {
  const edges = await dbPrisma.echoEdge.findMany({
    where: { parentPulseId },
    select: {
      echoStrength: true,
      depth: true,
    },
  });

  return {
    childPulseCount: edges.length,
    totalEchoReach: edges.reduce((sum: number, e: { echoStrength: number; depth: number }) => sum + e.echoStrength, 0),
    maxDepth: edges.reduce((max: number, e: { echoStrength: number; depth: number }) => Math.max(max, e.depth), 0),
  };
}
