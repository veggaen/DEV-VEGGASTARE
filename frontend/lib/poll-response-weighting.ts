/**
 * Poll Response Weighting System
 * 
 * Implements verification-tier weighted poll responses based on:
 * 1. User verification tier (0.1x → 1.2x)
 * 2. Poll completion percentage (partial = reduced weight)
 * 3. Response quality (anti-spam measures)
 * 
 * This ensures higher-verified users have more influence on poll results
 * while still allowing anonymous participation at reduced weight.
 */

import { UserVerificationTier } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION TIER MULTIPLIERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Multiplier values for each verification tier.
 * Higher verification = higher poll power.
 * 
 * These match the view-strength.ts VERIFICATION_TIER_MULTIPLIERS exactly.
 */
export const POLL_TIER_MULTIPLIERS: Record<UserVerificationTier, number> = {
  ANONYMOUS: 0.1,          // Not logged in
  WALLET_ONLY: 0.3,        // Web3 wallet connected only
  WEB2_BASIC: 0.4,         // Email verified
  WEB3_BASIC: 0.45,        // Wallet + signed message
  SOCIAL_BASIC: 0.5,       // One OAuth (Discord/GitHub)
  SOCIAL_VERIFIED: 0.7,    // Google OAuth (stronger identity)
  MULTI_SOCIAL: 0.75,      // 2+ OAuth providers linked
  WEB2_PAYMENT: 0.85,      // Traditional payment verified
  WEB3_VERIFIED: 0.9,      // NFT holder or on-chain history
  WEB3_PAYMENT: 0.92,      // Crypto payment verified
  PAYMENT_VERIFIED: 0.95,  // Multiple payment methods
  PHONE_VERIFIED: 1.0,     // SMS verification complete
  FULLY_VERIFIED: 1.2,     // All verification methods complete (bonus!)
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETION MULTIPLIERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate completion multiplier based on percentage answered.
 * 
 * Incentivizes full completion while still counting partial responses.
 * 
 * @param completionPct - Percentage of questions answered (0-100)
 * @returns Multiplier between 0.2 and 1.0
 */
export function calculateCompletionMultiplier(completionPct: number): number {
  // Normalize to 0-1 range
  const pct = Math.min(100, Math.max(0, completionPct)) / 100;
  
  // Tiered completion bonuses
  if (pct >= 1.0) return 1.0;      // 100% complete = full weight
  if (pct >= 0.9) return 0.95;     // 90-99% = slight penalty
  if (pct >= 0.75) return 0.85;    // 75-89% = moderate penalty
  if (pct >= 0.5) return 0.7;      // 50-74% = significant penalty
  if (pct >= 0.25) return 0.5;     // 25-49% = heavy penalty
  if (pct > 0) return 0.3;         // 1-24% = minimal weight
  return 0.2;                      // 0% = started but no answers (spam?)
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE QUALITY FACTORS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Response quality indicators that can adjust weight.
 */
export interface ResponseQualityFactors {
  /** Time taken to complete (too fast = suspicious) */
  timeSpentSeconds: number;
  /** Expected minimum time based on question count */
  expectedMinSeconds: number;
  /** Number of skipped questions */
  skippedCount: number;
  /** Total question count */
  totalQuestions: number;
  /** IP address hash (for duplicate detection) */
  ipHash?: string;
  /** User agent (for bot detection) */
  userAgent?: string;
  /** Did they fail any anti-bot challenges? */
  failedCaptcha?: boolean;
  /** Straight-line detection: all same answer */
  straightLineScore?: number;
}

/**
 * Calculate response quality multiplier based on behavior.
 * 
 * @param factors - Quality indicators
 * @returns Multiplier between 0 and 1.0
 */
export function calculateResponseQuality(factors: ResponseQualityFactors): number {
  let quality = 1.0;
  
  // ─── Speed Check ───────────────────────────────────────────────────────────
  // Too fast = likely bot or not reading questions
  const speedRatio = factors.timeSpentSeconds / factors.expectedMinSeconds;
  if (speedRatio < 0.2) {
    // Less than 20% of expected time = very suspicious
    quality *= 0.1;
  } else if (speedRatio < 0.4) {
    // 20-40% = somewhat suspicious
    quality *= 0.5;
  } else if (speedRatio < 0.6) {
    // 40-60% = minor penalty
    quality *= 0.85;
  }
  // No bonus for taking longer
  
  // ─── Skip Penalty ──────────────────────────────────────────────────────────
  // Skipping too many questions reduces quality
  const skipRate = factors.skippedCount / factors.totalQuestions;
  if (skipRate > 0.5) {
    quality *= 0.6;
  } else if (skipRate > 0.3) {
    quality *= 0.8;
  } else if (skipRate > 0.1) {
    quality *= 0.9;
  }
  
  // ─── Captcha Failure ───────────────────────────────────────────────────────
  if (factors.failedCaptcha) {
    quality *= 0.7;
  }
  
  // ─── Straight-Line Detection ───────────────────────────────────────────────
  // If they answered everything the same (e.g., all "C" on sliders)
  if (factors.straightLineScore !== undefined && factors.straightLineScore > 0.8) {
    quality *= 0.5;
  }
  
  return Math.max(0.1, quality); // Minimum 10% weight
}

// ─────────────────────────────────────────────────────────────────────────────
// WEIGHTED VALUE CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

export interface WeightedValueInput {
  verificationTier: UserVerificationTier;
  completionPct: number;
  responseQuality?: number;
}

export interface WeightedValueOutput {
  tierMultiplier: number;
  completionMultiplier: number;
  responseQuality: number;
  weightedValue: number;
}

/**
 * Calculate the final weighted value for a poll response.
 * 
 * Formula: weightedValue = tierMultiplier × completionMultiplier × responseQuality
 * 
 * @param input - Verification tier, completion %, and quality score
 * @returns All multipliers and final weighted value
 */
export function calculateWeightedValue(input: WeightedValueInput): WeightedValueOutput {
  const tierMultiplier = POLL_TIER_MULTIPLIERS[input.verificationTier] ?? 0.1;
  const completionMultiplier = calculateCompletionMultiplier(input.completionPct);
  const responseQuality = input.responseQuality ?? 1.0;
  
  const weightedValue = tierMultiplier * completionMultiplier * responseQuality;
  
  return {
    tierMultiplier,
    completionMultiplier,
    responseQuality,
    weightedValue: Math.round(weightedValue * 1000) / 1000, // 3 decimal places
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATION UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single response's answer with its weight.
 */
export interface WeightedAnswer {
  value: string | number;
  weight: number;
}

/**
 * Calculate weighted average for slider/scale questions.
 * 
 * @param answers - Array of values and their weights
 * @returns Weighted average value
 */
export function weightedAverage(answers: WeightedAnswer[]): number {
  if (answers.length === 0) return 0;
  
  const totalWeight = answers.reduce((sum, a) => sum + a.weight, 0);
  if (totalWeight === 0) return 0;
  
  const weightedSum = answers.reduce((sum, a) => {
    const numValue = typeof a.value === 'number' ? a.value : parseFloat(a.value) || 0;
    return sum + (numValue * a.weight);
  }, 0);
  
  return weightedSum / totalWeight;
}

/**
 * Calculate weighted vote distribution for choice questions.
 * 
 * @param answers - Array of option IDs and their weights
 * @returns Object with option IDs as keys and weighted vote counts as values
 */
export function weightedVoteDistribution(answers: WeightedAnswer[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  
  for (const answer of answers) {
    const optionId = String(answer.value);
    distribution[optionId] = (distribution[optionId] || 0) + answer.weight;
  }
  
  return distribution;
}

/**
 * Calculate weighted ranking aggregation using Borda count method.
 * 
 * @param rankings - Array of ranked option arrays with their weights
 * @param optionCount - Total number of options being ranked
 * @returns Object with option IDs as keys and Borda scores as values
 */
export function weightedBordaCount(
  rankings: Array<{ ranking: string[]; weight: number }>,
  optionCount: number
): Record<string, number> {
  const scores: Record<string, number> = {};
  
  for (const { ranking, weight } of rankings) {
    for (let i = 0; i < ranking.length; i++) {
      const optionId = ranking[i];
      // Higher rank = more points: #1 gets (n) points, #2 gets (n-1), etc.
      const points = (optionCount - i) * weight;
      scores[optionId] = (scores[optionId] || 0) + points;
    }
  }
  
  return scores;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER DISPLAY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const TIER_DISPLAY_INFO: Record<UserVerificationTier, {
  label: string;
  icon: string;
  color: string;
  description: string;
}> = {
  ANONYMOUS: {
    label: 'Anonymous',
    icon: '👤',
    color: '#6b7280',
    description: 'Not logged in',
  },
  WALLET_ONLY: {
    label: 'Wallet Connected',
    icon: '🔗',
    color: '#8b5cf6',
    description: 'Web3 wallet connected',
  },
  WEB2_BASIC: {
    label: 'Email Verified',
    icon: '📧',
    color: '#3b82f6',
    description: 'Email address confirmed',
  },
  WEB3_BASIC: {
    label: 'Web3 Basic',
    icon: '⛓️',
    color: '#7c3aed',
    description: 'Wallet with signed message',
  },
  SOCIAL_BASIC: {
    label: 'Social Connected',
    icon: '🔵',
    color: '#06b6d4',
    description: 'Discord or GitHub OAuth',
  },
  SOCIAL_VERIFIED: {
    label: 'Social Verified',
    icon: '✓',
    color: '#10b981',
    description: 'Google OAuth verified',
  },
  MULTI_SOCIAL: {
    label: 'Multi-Social',
    icon: '🔗',
    color: '#14b8a6',
    description: '2+ OAuth providers linked',
  },
  WEB2_PAYMENT: {
    label: 'Payment Verified',
    icon: '💳',
    color: '#f59e0b',
    description: 'Card payment on file',
  },
  WEB3_VERIFIED: {
    label: 'Web3 Verified',
    icon: '🏆',
    color: '#8b5cf6',
    description: 'NFT holder or on-chain history',
  },
  WEB3_PAYMENT: {
    label: 'Crypto Payments',
    icon: '₿',
    color: '#f97316',
    description: 'Crypto transaction verified',
  },
  PAYMENT_VERIFIED: {
    label: 'Full Payment',
    icon: '💰',
    color: '#eab308',
    description: 'Multiple payment methods',
  },
  PHONE_VERIFIED: {
    label: 'Phone Verified',
    icon: '📱',
    color: '#22c55e',
    description: 'SMS verification complete',
  },
  FULLY_VERIFIED: {
    label: 'Fully Verified',
    icon: '⭐',
    color: '#fbbf24',
    description: 'All methods verified (bonus power!)',
  },
};

/**
 * Get display text for tier multiplier.
 */
export function formatTierMultiplier(tier: UserVerificationTier): string {
  const multiplier = POLL_TIER_MULTIPLIERS[tier];
  return `${(multiplier * 100).toFixed(0)}%`;
}

/**
 * Get badge/tooltip text for a response's weighted value.
 */
export function formatWeightedValue(value: number): string {
  if (value >= 1.0) return 'Maximum Weight';
  if (value >= 0.9) return 'High Weight';
  if (value >= 0.7) return 'Good Weight';
  if (value >= 0.5) return 'Moderate Weight';
  if (value >= 0.3) return 'Low Weight';
  return 'Minimal Weight';
}
