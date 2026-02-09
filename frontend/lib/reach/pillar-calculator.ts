/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Reach 7-Pillar System — Pillar Calculator
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Computes each pillar score (0-100) for a pulse/product/company,
 * then produces the composite True Reach Score.
 *
 * Dual output:
 *   lifetime  = sum of all pillar contributions (monotonic, never decreases)
 *   momentum  = lifetime × decay + recentLift (dynamic, used for ranking)
 */

import { PILLAR_WEIGHTS, DECAY_CONFIG, VELOCITY_CONFIG, RESONANCE_CONFIG } from './constants';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PillarInputs {
  // Pillar 1: Visibility
  reachScore: number;         // Current weighted view sum
  uniqueViewCount: number;
  viewCount: number;
  
  // Pillar 2: Engagement Depth
  engagementStrengthSum: number; // Sum from EngagementEvent strengths
  uniqueEngagers: number;
  totalEngagements: number;
  
  // Pillar 3: Conversion Impact
  conversionStrengthSum: number; // Sum from conversion events
  exposures: number;             // Total views/impressions
  
  // Pillar 4: Loyalty
  repeatEngagers: number;        // Users with >=3 distinct sessions
  avgInteractionsPerRepeat: number;
  totalAudience: number;
  
  // Pillar 5: Growth  
  newFollowersFromContent: number;
  newOrganicVisits: number;
  previousAudienceSize: number;
  uniqueReferrerSources: number;
  
  // Pillar 6: Recall
  returnVisits: number;
  avgTimeOnReturn: number; // seconds
  totalVisits: number;
  
  // Pillar 7: Velocity
  momentumDelta1h: number;
  momentumDelta24h: number;
  breadthRatio: number; // unique/total for breadth weighting
}

export interface PillarScores {
  visibility: number;     // 0-100
  engagement: number;     // 0-100
  conversion: number;     // 0-100
  loyalty: number;        // 0-100
  growth: number;         // 0-100
  recall: number;         // 0-100
  velocity: number;       // 0-100
}

export interface ReachResult {
  /** True Reach Score: weighted sum of all pillars (0-100) */
  trueReachScore: number;
  /** Individual pillar scores */
  pillars: PillarScores;
  /** Lifetime: monotonic sum of all contributions */
  lifetime: number;
  /** Momentum: decayed dynamic score for ranking */
  momentum: number;
}

// ─── Normalization Caps ──────────────────────────────────────────────────────
// These are the "max expected" values for normalization. Beyond these, score = 100.
// Tuned for your platform size — adjust as you scale.

const NORMALIZATION_CAPS = {
  VISIBILITY_REACH: 500,     // reachScore value for 100% visibility
  ENGAGEMENT_SUM: 200,       // engagement strength sum for 100%
  CONVERSION_SUM: 50,        // conversion strength sum for 100%
  LOYALTY_RATIO: 0.3,        // 30% repeat engagers = 100%
  GROWTH_RATE: 0.1,          // 10% audience growth = 100%
  RECALL_RETURN_RATE: 0.15,  // 15% return rate = 100%
  VELOCITY_DELTA: 100,       // momentum delta for 100%
} as const;

// ─── Pillar Calculators ──────────────────────────────────────────────────────

function calcVisibility(inputs: PillarInputs): number {
  if (inputs.viewCount === 0) return 0;
  // Weighted reach relative to cap, with uniqueness bonus
  const uniquenessBonus = inputs.uniqueViewCount / Math.max(inputs.viewCount, 1);
  const raw = (inputs.reachScore / NORMALIZATION_CAPS.VISIBILITY_REACH) * 100;
  return Math.min(100, raw * (0.7 + 0.3 * uniquenessBonus));
}

function calcEngagement(inputs: PillarInputs): number {
  if (inputs.totalEngagements === 0) return 0;
  const raw = (inputs.engagementStrengthSum / NORMALIZATION_CAPS.ENGAGEMENT_SUM) * 100;
  // Breadth bonus: more unique engagers = better
  const breadth = inputs.uniqueEngagers / Math.max(inputs.totalEngagements, 1);
  return Math.min(100, raw * (0.6 + 0.4 * Math.min(breadth * 2, 1)));
}

function calcConversion(inputs: PillarInputs): number {
  if (inputs.exposures === 0) return 0;
  const raw = (inputs.conversionStrengthSum / NORMALIZATION_CAPS.CONVERSION_SUM) * 100;
  const conversionRate = inputs.conversionStrengthSum / inputs.exposures;
  return Math.min(100, raw * (0.5 + 0.5 * Math.min(conversionRate * 10, 1)));
}

function calcLoyalty(inputs: PillarInputs): number {
  if (inputs.totalAudience === 0) return 0;
  const loyaltyRatio = inputs.repeatEngagers / inputs.totalAudience;
  const raw = (loyaltyRatio / NORMALIZATION_CAPS.LOYALTY_RATIO) * 100;
  // Depth bonus: more interactions per repeat user = stronger loyalty
  const depthBonus = Math.min(inputs.avgInteractionsPerRepeat / 5, 1);
  return Math.min(100, raw * (0.7 + 0.3 * depthBonus));
}

function calcGrowth(inputs: PillarInputs): number {
  if (inputs.previousAudienceSize === 0) {
    // New content — base growth from organic visits
    return Math.min(100, inputs.newOrganicVisits * 2);
  }
  const growthRate =
    (inputs.newFollowersFromContent + inputs.newOrganicVisits) /
    inputs.previousAudienceSize;
  const raw = (growthRate / NORMALIZATION_CAPS.GROWTH_RATE) * 100;
  // Referrer diversity bonus
  const referrerBonus = Math.min(inputs.uniqueReferrerSources / 10, 1);
  return Math.min(100, raw * (0.7 + 0.3 * referrerBonus));
}

function calcRecall(inputs: PillarInputs): number {
  if (inputs.totalVisits === 0) return 0;
  const returnRate = inputs.returnVisits / inputs.totalVisits;
  const raw = (returnRate / NORMALIZATION_CAPS.RECALL_RETURN_RATE) * 100;
  // Time-on-return bonus: engaged returners are worth more
  const timeBonus = Math.min(inputs.avgTimeOnReturn / 120, 1); // 2 min = max bonus
  return Math.min(100, raw * (0.6 + 0.4 * timeBonus));
}

function calcVelocity(inputs: PillarInputs): number {
  // Breadth-weighted momentum delta
  const breadthMultiplier = Math.max(
    VELOCITY_CONFIG.BREADTH_CLAMP[0],
    Math.min(VELOCITY_CONFIG.BREADTH_CLAMP[1], inputs.breadthRatio * 2)
  );
  const combinedDelta =
    inputs.momentumDelta1h * VELOCITY_CONFIG.DELTA_1H_WEIGHT +
    inputs.momentumDelta24h * VELOCITY_CONFIG.DELTA_24H_WEIGHT;
  const raw = ((combinedDelta * breadthMultiplier) / NORMALIZATION_CAPS.VELOCITY_DELTA) * 100;
  return Math.min(100, Math.max(0, raw));
}

// ─── Composite Calculator ────────────────────────────────────────────────────

/**
 * Calculate all 7 pillar scores and the composite True Reach Score.
 */
export function calculatePillarScores(inputs: PillarInputs): PillarScores {
  return {
    visibility: Math.round(calcVisibility(inputs) * 100) / 100,
    engagement: Math.round(calcEngagement(inputs) * 100) / 100,
    conversion: Math.round(calcConversion(inputs) * 100) / 100,
    loyalty: Math.round(calcLoyalty(inputs) * 100) / 100,
    growth: Math.round(calcGrowth(inputs) * 100) / 100,
    recall: Math.round(calcRecall(inputs) * 100) / 100,
    velocity: Math.round(calcVelocity(inputs) * 100) / 100,
  };
}

/**
 * Calculate the composite True Reach Score from individual pillar scores.
 */
export function calculateTrueReachScore(pillars: PillarScores): number {
  const score =
    pillars.visibility * PILLAR_WEIGHTS.VISIBILITY +
    pillars.engagement * PILLAR_WEIGHTS.ENGAGEMENT_DEPTH +
    pillars.conversion * PILLAR_WEIGHTS.CONVERSION_IMPACT +
    pillars.loyalty * PILLAR_WEIGHTS.LOYALTY +
    pillars.growth * PILLAR_WEIGHTS.GROWTH +
    pillars.recall * PILLAR_WEIGHTS.RECALL +
    pillars.velocity * PILLAR_WEIGHTS.VELOCITY;
  return Math.round(score * 100) / 100;
}

// ─── Momentum Calculator ─────────────────────────────────────────────────────

/**
 * Calculate momentum with decay.
 * momentum = lifetime × decayFactor + recentActivityLift
 */
export function calculateMomentum(params: {
  lifetime: number;
  currentMomentum: number;
  lastActivityAt: Date | null;
  recentActivitySum: number; // Sum of strengths in last RECENT_LIFT_WINDOW hours
  resonanceMultiplier?: number;
  resonanceExpiresAt?: Date | null;
}): number {
  const now = Date.now();

  // 1. Calculate how many days since last activity
  const lastActivity = params.lastActivityAt?.getTime() ?? now;
  const hoursSinceActivity = (now - lastActivity) / (1000 * 60 * 60);
  const daysSinceActivity = hoursSinceActivity / 24;

  // 2. Apply decay if inactive beyond grace period
  let decayFactor = 1.0;
  if (hoursSinceActivity > DECAY_CONFIG.INACTIVITY_GRACE_HOURS) {
    const decayDays = daysSinceActivity - DECAY_CONFIG.INACTIVITY_GRACE_HOURS / 24;
    decayFactor = Math.pow(DECAY_CONFIG.DAILY_DECAY_RATE, Math.max(0, decayDays));
  }

  // 3. Base momentum = lifetime × decay
  const decayedBase = params.lifetime * decayFactor;

  // 4. Recent activity lift (additive bonus from last 72h)
  const recentLift = params.recentActivitySum * 0.5; // 50% of recent activity as lift

  // 5. Resonance multiplier (temporary community boost)
  let resonance = 1.0;
  if (
    params.resonanceMultiplier &&
    params.resonanceMultiplier > 1.0 &&
    params.resonanceExpiresAt &&
    params.resonanceExpiresAt.getTime() > now
  ) {
    resonance = params.resonanceMultiplier;
  }

  // 6. Final momentum (floored at ratio of lifetime)
  const floor = params.lifetime * DECAY_CONFIG.MOMENTUM_FLOOR_RATIO;
  const momentum = Math.max(floor, (decayedBase + recentLift) * resonance);

  return Math.round(momentum * 100) / 100;
}

// ─── Resonance Checker ───────────────────────────────────────────────────────

/**
 * Check if a pulse qualifies for community resonance boost.
 * Triggered when >N unique engagers with high breadth in time window.
 */
export function checkResonance(params: {
  uniqueEngagersInWindow: number;
  totalEventsInWindow: number;
}): { triggered: boolean; multiplier: number; expiresAt: Date } | null {
  const breadthRatio =
    params.totalEventsInWindow > 0
      ? params.uniqueEngagersInWindow / params.totalEventsInWindow
      : 0;

  if (
    params.uniqueEngagersInWindow >= RESONANCE_CONFIG.MIN_UNIQUE_ENGAGERS &&
    breadthRatio >= RESONANCE_CONFIG.MIN_BREADTH_RATIO
  ) {
    // Scale multiplier based on breadth and engagement count
    const scale = Math.min(
      (params.uniqueEngagersInWindow / (RESONANCE_CONFIG.MIN_UNIQUE_ENGAGERS * 3)),
      1
    );
    const [low, high] = RESONANCE_CONFIG.MULTIPLIER_RANGE;
    const multiplier = low + scale * (high - low);

    const expiresAt = new Date(
      Date.now() + RESONANCE_CONFIG.DURATION_HOURS * 60 * 60 * 1000
    );

    return { triggered: true, multiplier: Math.round(multiplier * 100) / 100, expiresAt };
  }

  return null;
}
