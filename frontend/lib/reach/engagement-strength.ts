/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Reach 7-Pillar System — Engagement Strength Calculator
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Calculates the "strength" of an engagement event (click, hover, comment, etc.)
 * using the same verification-tier system as view strength, plus:
 *   - Intent weight (repulse > long comment > heartbeat > hover)
 *   - Uniqueness decay (first action full weight, repeats diminish)
 *   - Thread depth bonus (deeper threads = more resonance)
 *
 * Formula:
 *   engagementStrength = tierMultiplier × intentWeight × uniquenessDecay × depthFactor
 *   Clamped to [0.01, 5.0]
 */

import {
  ENGAGEMENT_INTENT_WEIGHTS,
  UNIQUENESS_DECAY,
  DEPTH_MULTIPLIERS,
  ANTI_GAMING,
} from './constants';
import {
  VERIFICATION_TIER_MULTIPLIERS,
  type VerificationTier,
} from '@/lib/view-strength';

// ─── Types ───────────────────────────────────────────────────────────────────

export type EngagementType = keyof typeof ENGAGEMENT_INTENT_WEIGHTS;

export interface EngagementStrengthContext {
  /** User's verification tier */
  verificationTier: VerificationTier;
  /** Type of engagement event */
  eventType: EngagementType;
  /** How many times this user has performed this action type on this content */
  previousActionCount: number;
  /** Thread depth (0 = top-level, 1 = reply, 2+ = deep thread) */
  threadDepth?: number;
  /** Number of messages in the thread cluster */
  threadClusterSize?: number;
  /** Account age in days */
  accountAgeDays?: number;
  /** Whether this is a unique referrer (new IP / new domain) */
  isUniqueReferrer?: boolean;
  /** Breadth ratio: unique engagers / total engagements */
  breadthRatio?: number;
}

export interface EngagementStrengthResult {
  /** Final calculated strength */
  strength: number;
  /** Breakdown of multipliers */
  breakdown: {
    tierMultiplier: number;
    intentWeight: number;
    uniquenessDecay: number;
    depthFactor: number;
    breadthPenalty: number;
  };
  /** Which pillar this primarily feeds */
  primaryPillar: 'engagement' | 'conversion' | 'recall' | 'loyalty' | 'growth';
  /** Human-readable summary */
  explanation: string;
}

// ─── Pillar Mapping ──────────────────────────────────────────────────────────

const EVENT_TO_PILLAR: Record<EngagementType, EngagementStrengthResult['primaryPillar']> = {
  CLICK: 'engagement',
  HOVER_DEEP_READ: 'engagement',
  SCROLL_DEPTH: 'engagement',
  DWELL_TIME: 'engagement',
  SAVE_BOOKMARK: 'engagement',
  COPY_TEXT: 'engagement',
  COMMENT_SHORT: 'engagement',
  COMMENT_LONG: 'engagement',
  COMMENT_THREAD: 'engagement',
  HEARTBEAT: 'engagement',
  REPULSE: 'engagement',
  SHARE_EXTERNAL: 'growth',
  PRODUCT_VIEW: 'conversion',
  PRODUCT_CLICK: 'conversion',
  ADD_TO_CART: 'conversion',
  PURCHASE: 'conversion',
  PROFILE_FOLLOW: 'growth',
  RETURN_VISIT: 'recall',
  TAB_REFOCUS: 'recall',
};

// ─── Main Calculator ─────────────────────────────────────────────────────────

export function calculateEngagementStrength(
  context: EngagementStrengthContext
): EngagementStrengthResult {
  // 1. Verification tier multiplier
  const tierMultiplier =
    VERIFICATION_TIER_MULTIPLIERS[context.verificationTier] ?? 0.1;

  // 2. Intent weight from event type
  const intentWeight = ENGAGEMENT_INTENT_WEIGHTS[context.eventType] ?? 0.5;

  // 3. Uniqueness decay — repeated actions from same user lose value
  let uniquenessDecay: number;
  if (context.previousActionCount === 0) {
    uniquenessDecay = UNIQUENESS_DECAY.FIRST_ACTION;
  } else if (context.previousActionCount === 1) {
    uniquenessDecay = UNIQUENESS_DECAY.SECOND_ACTION;
  } else {
    uniquenessDecay = UNIQUENESS_DECAY.THIRD_PLUS;
  }

  // 4. Thread depth / resonance multiplier
  let depthFactor: number = DEPTH_MULTIPLIERS.TOP_LEVEL;
  if (context.threadDepth && context.threadDepth > 0) {
    depthFactor = DEPTH_MULTIPLIERS.THREADED_REPLY;
  }
  if (context.threadClusterSize && context.threadClusterSize > 4) {
    depthFactor = DEPTH_MULTIPLIERS.DEEP_THREAD;
  }

  // 5. Breadth anti-gaming penalty
  let breadthPenalty = 1.0;
  if (
    context.breadthRatio !== undefined &&
    context.breadthRatio < ANTI_GAMING.MIN_BREADTH_RATIO
  ) {
    breadthPenalty = ANTI_GAMING.BREADTH_PENALTY_FACTOR;
  }

  // 6. Final calculation
  const rawStrength =
    tierMultiplier * intentWeight * uniquenessDecay * depthFactor * breadthPenalty;
  const strength = Math.max(0.01, Math.min(5.0, rawStrength));

  // 7. Primary pillar
  const primaryPillar = EVENT_TO_PILLAR[context.eventType] ?? 'engagement';

  // 8. Explanation
  const explanation = [
    `${context.eventType}`,
    `tier=${context.verificationTier}(${tierMultiplier.toFixed(2)})`,
    `intent=${intentWeight}`,
    `unique=${uniquenessDecay}`,
    depthFactor > 1 ? `depth=${depthFactor}` : '',
    breadthPenalty < 1 ? `breadth-penalty=${breadthPenalty}` : '',
    `→ ${strength.toFixed(3)}`,
  ]
    .filter(Boolean)
    .join(' × ');

  return {
    strength,
    breakdown: {
      tierMultiplier,
      intentWeight,
      uniquenessDecay,
      depthFactor,
      breadthPenalty,
    },
    primaryPillar,
    explanation,
  };
}

// ─── Batch Aggregator ────────────────────────────────────────────────────────

/**
 * Aggregate multiple engagement events into pillar-level contributions.
 * Returns per-pillar deltas ready to be added to the conversation/product/company.
 */
export function aggregateEngagementsToPillars(
  events: EngagementStrengthResult[]
): {
  engagement: number;
  conversion: number;
  recall: number;
  loyalty: number;
  growth: number;
} {
  const pillars = {
    engagement: 0,
    conversion: 0,
    recall: 0,
    loyalty: 0,
    growth: 0,
  };

  for (const event of events) {
    pillars[event.primaryPillar] += event.strength;
  }

  return pillars;
}
