/**
 * View Strength Calculation System
 * 
 * This module calculates the "strength" or "weight" of a view for reach analytics.
 * Views from highly verified users are worth more than anonymous views.
 * 
 * VERIFICATION TIERS (from lowest to highest):
 * - ANONYMOUS: Not logged in (0.1x multiplier)
 * - WALLET_ONLY: Web3 wallet connected, no other verification (0.3x)
 * - WEB2_BASIC: Signed up with email, no payment (0.4x)
 * - WEB3_BASIC: Web3 wallet + signed message, no payment (0.45x)
 * - SOCIAL_BASIC: Discord/GitHub OAuth (0.5x)
 * - SOCIAL_VERIFIED: Google OAuth - higher trust (0.7x)
 * - MULTI_SOCIAL: Multiple OAuth providers linked (0.75x) - cross-verified identity
 * - WEB2_PAYMENT: Verified payment method (0.85x)
 * - WEB3_VERIFIED: Google + Verified wallet (0.9x)
 * - WEB3_PAYMENT: Web3 payment verified (crypto purchase) (0.92x)
 * - PAYMENT_VERIFIED: Web2 AND Web3 payment verified (0.95x)
 * - PHONE_VERIFIED: Phone number verified (1.0x)
 * - FULLY_VERIFIED: All verifications (1.2x)
 * 
 * SECURITY NOTE ON MULTI-OAUTH:
 * Multiple linked OAuth providers INCREASE trust because:
 * - Each provider (Google, GitHub, Discord) independently verifies the email
 * - An attacker would need to compromise MULTIPLE OAuth accounts
 * - Cross-verification proves consistent identity across platforms
 * - Example: Google + GitHub linked = 2 independent identity confirmations
 * 
 * FIRST VIEW BONUS:
 * First-time views have higher weight than repeat views.
 * - First view: 1.0x multiplier
 * - Subsequent views: 0.1x - 0.2x multiplier (diminishing returns)
 * 
 * ADDITIONAL FACTORS:
 * - Unique IP: +20% bonus for truly unique viewers
 * - Same IP different user: -30% (could be gaming the system)
 * - Account age: +10% for accounts > 30 days old
 * - Multi-OAuth bonus: +5% per additional linked provider
 */

import type { User } from '@/generated/prisma/browser';

// ─── Verification Tier Multipliers ───────────────────────────────────────────

export const VERIFICATION_TIER_MULTIPLIERS = {
  ANONYMOUS: 0.1,          // Not logged in - minimal trust
  WALLET_ONLY: 0.3,        // Just a random wallet - easy to fake
  WEB2_BASIC: 0.4,         // Signed up with email, no payment yet
  WEB3_BASIC: 0.45,        // Web3 wallet + signed message, no payment
  SOCIAL_BASIC: 0.5,       // Discord/GitHub - moderate trust
  SOCIAL_VERIFIED: 0.7,    // Google OAuth - real email, higher trust
  MULTI_SOCIAL: 0.75,      // Multiple OAuth providers - cross-verified identity
  WEB2_PAYMENT: 0.85,      // Verified payment card - significant trust
  WEB3_VERIFIED: 0.9,      // Google + verified wallet signature
  WEB3_PAYMENT: 0.92,      // Crypto purchase completed
  PAYMENT_VERIFIED: 0.95,  // Both Web2 and Web3 payment verified
  PHONE_VERIFIED: 1.0,     // Phone verified - strong identity
  FULLY_VERIFIED: 1.2,     // All verifications - highest trust
} as const;

export type VerificationTier = keyof typeof VERIFICATION_TIER_MULTIPLIERS;

// ─── View Context Multipliers ────────────────────────────────────────────────

export const VIEW_CONTEXT_MULTIPLIERS = {
  // First vs repeat views
  FIRST_VIEW: 1.0,
  REPEAT_VIEW_2: 0.2,      // Second view same content
  REPEAT_VIEW_3_5: 0.1,    // 3rd-5th view
  REPEAT_VIEW_6_PLUS: 0.05, // 6+ views - basically refreshing doesn't help

  // IP uniqueness
  NEW_UNIQUE_IP: 1.2,      // Completely new IP
  SAME_IP_NEW_USER: 0.7,   // Different user, same IP (office/home)
  SAME_IP_SAME_USER: 1.0,  // Expected case
  
  // Account age bonus
  ACCOUNT_NEW: 1.0,        // < 7 days
  ACCOUNT_ESTABLISHED: 1.05, // 7-30 days
  ACCOUNT_MATURE: 1.1,     // > 30 days
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ViewStrengthContext {
  // User verification level
  verificationTier: VerificationTier;
  
  // View history
  isFirstView: boolean;
  previousViewCount: number;
  
  // IP context
  isNewIp: boolean;
  isSameIpDifferentUser: boolean;
  
  // Account context
  accountAgeDays?: number;
  
  // Optional: engagement signals
  hasInteracted?: boolean; // Pulsed, commented, etc.
}

export interface ViewStrengthResult {
  // Final calculated strength (0.0 - 2.0 typical range)
  strength: number;
  
  // Breakdown of multipliers applied
  breakdown: {
    tierMultiplier: number;
    viewCountMultiplier: number;
    ipMultiplier: number;
    accountAgeMultiplier: number;
    interactionBonus: number;
  };
  
  // Classification for analytics
  strengthCategory: 'very_weak' | 'weak' | 'moderate' | 'strong' | 'very_strong';
  
  // Human-readable explanation
  explanation: string;
}

// ─── Main Calculation Function ───────────────────────────────────────────────

/**
 * Calculate the strength/weight of a view based on user verification and context.
 */
export function calculateViewStrength(context: ViewStrengthContext): ViewStrengthResult {
  // 1. Get base tier multiplier
  const tierMultiplier = VERIFICATION_TIER_MULTIPLIERS[context.verificationTier] ?? 0.1;
  
  // 2. Calculate view count multiplier (diminishing returns)
  let viewCountMultiplier: number;
  if (context.isFirstView) {
    viewCountMultiplier = VIEW_CONTEXT_MULTIPLIERS.FIRST_VIEW;
  } else if (context.previousViewCount <= 1) {
    viewCountMultiplier = VIEW_CONTEXT_MULTIPLIERS.REPEAT_VIEW_2;
  } else if (context.previousViewCount <= 4) {
    viewCountMultiplier = VIEW_CONTEXT_MULTIPLIERS.REPEAT_VIEW_3_5;
  } else {
    viewCountMultiplier = VIEW_CONTEXT_MULTIPLIERS.REPEAT_VIEW_6_PLUS;
  }
  
  // 3. Calculate IP multiplier
  let ipMultiplier: number;
  if (context.isNewIp) {
    ipMultiplier = VIEW_CONTEXT_MULTIPLIERS.NEW_UNIQUE_IP;
  } else if (context.isSameIpDifferentUser) {
    ipMultiplier = VIEW_CONTEXT_MULTIPLIERS.SAME_IP_NEW_USER;
  } else {
    ipMultiplier = VIEW_CONTEXT_MULTIPLIERS.SAME_IP_SAME_USER;
  }
  
  // 4. Account age multiplier
  let accountAgeMultiplier: number;
  if (context.accountAgeDays === undefined || context.accountAgeDays < 7) {
    accountAgeMultiplier = VIEW_CONTEXT_MULTIPLIERS.ACCOUNT_NEW;
  } else if (context.accountAgeDays < 30) {
    accountAgeMultiplier = VIEW_CONTEXT_MULTIPLIERS.ACCOUNT_ESTABLISHED;
  } else {
    accountAgeMultiplier = VIEW_CONTEXT_MULTIPLIERS.ACCOUNT_MATURE;
  }
  
  // 5. Interaction bonus (if they engaged, view is worth more)
  const interactionBonus = context.hasInteracted ? 0.1 : 0;
  
  // 6. Calculate final strength
  const baseStrength = tierMultiplier * viewCountMultiplier * ipMultiplier * accountAgeMultiplier;
  const strength = Math.max(0.01, Math.min(2.0, baseStrength + interactionBonus));
  
  // 7. Categorize the strength
  let strengthCategory: ViewStrengthResult['strengthCategory'];
  if (strength < 0.15) {
    strengthCategory = 'very_weak';
  } else if (strength < 0.4) {
    strengthCategory = 'weak';
  } else if (strength < 0.7) {
    strengthCategory = 'moderate';
  } else if (strength < 1.0) {
    strengthCategory = 'strong';
  } else {
    strengthCategory = 'very_strong';
  }
  
  // 8. Generate explanation
  const explanation = generateExplanation(context, strength, strengthCategory);
  
  return {
    strength,
    breakdown: {
      tierMultiplier,
      viewCountMultiplier,
      ipMultiplier,
      accountAgeMultiplier,
      interactionBonus,
    },
    strengthCategory,
    explanation,
  };
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function generateExplanation(
  context: ViewStrengthContext,
  strength: number,
  category: ViewStrengthResult['strengthCategory']
): string {
  const parts: string[] = [];
  
  // Tier explanation
  switch (context.verificationTier) {
    case 'ANONYMOUS':
      parts.push('Anonymous view');
      break;
    case 'WALLET_ONLY':
      parts.push('Web3 wallet user');
      break;
    case 'WEB2_BASIC':
      parts.push('Email signup (no payment)');
      break;
    case 'WEB3_BASIC':
      parts.push('Web3 verified wallet (no payment)');
      break;
    case 'SOCIAL_BASIC':
      parts.push('Social login user');
      break;
    case 'SOCIAL_VERIFIED':
      parts.push('Google-verified user');
      break;
    case 'MULTI_SOCIAL':
      parts.push('Multi-OAuth verified (cross-platform identity)');
      break;
    case 'WEB2_PAYMENT':
      parts.push('Web2 payment verified');
      break;
    case 'WEB3_PAYMENT':
      parts.push('Web3 payment verified');
      break;
    case 'PAYMENT_VERIFIED':
      parts.push('Full payment verified (Web2+Web3)');
      break;
    case 'FULLY_VERIFIED':
      parts.push('Fully verified user');
      break;
    default:
      parts.push('Verified user');
  }
  
  // First view
  if (context.isFirstView) {
    parts.push('first view');
  } else {
    parts.push(`view #${context.previousViewCount + 1}`);
  }
  
  // IP context
  if (context.isNewIp) {
    parts.push('unique IP');
  }
  
  return `${parts.join(', ')} → ${category} strength (${strength.toFixed(2)})`;
}

/**
 * Determine a user's verification tier based on their profile data.
 * This should be called when calculating view strength for a logged-in user.
 * 
 * Tier hierarchy (lowest to highest):
 * ANONYMOUS → WALLET_ONLY → WEB2_BASIC → WEB3_BASIC → SOCIAL_BASIC → SOCIAL_VERIFIED 
 * → WEB2_PAYMENT → WEB3_VERIFIED → WEB3_PAYMENT → PAYMENT_VERIFIED → PHONE_VERIFIED → FULLY_VERIFIED
 */
export function determineUserVerificationTier(user: Partial<User> & {
  hasGoogleAuth?: boolean;
  hasDiscordAuth?: boolean;
  hasGithubAuth?: boolean;
  hasVerifiedWallet?: boolean;
  hasWeb2Payment?: boolean;
  hasWeb3Payment?: boolean;
  phoneVerified?: Date | null;
  emailVerified?: Date | null;
}): VerificationTier {
  // Check verification states
  const hasGoogle = user.hasGoogleAuth ?? false;
  const hasDiscord = user.hasDiscordAuth ?? false;
  const hasGithub = user.hasGithubAuth ?? false;
  const hasPhone = user.phoneVerified != null;
  const hasWeb2Payment = user.hasWeb2Payment ?? false;
  const hasWeb3Payment = user.hasWeb3Payment ?? false;
  const hasBothPayments = hasWeb2Payment && hasWeb3Payment;
  const hasAnyPayment = hasWeb2Payment || hasWeb3Payment;
  const hasWallet = user.hasVerifiedWallet ?? false;
  const hasEmailVerified = user.emailVerified != null;
  const isWeb3Mode = (user as any).web3ModeEnabled ?? false;
  
  // Fully verified: Google + Phone + Both Payments + Wallet
  if (hasGoogle && hasPhone && hasBothPayments && hasWallet) {
    return 'FULLY_VERIFIED';
  }
  
  // Phone verified takes precedence (strong identity)
  if (hasPhone && hasAnyPayment) {
    return 'PHONE_VERIFIED';
  }
  
  // Payment verified - both Web2 AND Web3 payments
  if (hasBothPayments) {
    return 'PAYMENT_VERIFIED';
  }
  
  // Web3 payment only (crypto purchase completed)
  if (hasWeb3Payment && hasWallet) {
    return 'WEB3_PAYMENT';
  }
  
  // Web3 verified (Google + verified wallet)
  if (hasGoogle && hasWallet) {
    return 'WEB3_VERIFIED';
  }
  
  // Web2 payment only
  if (hasWeb2Payment) {
    return 'WEB2_PAYMENT';
  }
  
  // Count linked OAuth providers for multi-social tier
  const oauthCount = [hasGoogle, hasDiscord, hasGithub].filter(Boolean).length;
  
  // Multi-social: 2+ OAuth providers linked = cross-verified identity
  // This is MORE secure than single OAuth because attacker would need to
  // compromise multiple independent identity providers
  if (oauthCount >= 2) {
    return 'MULTI_SOCIAL';
  }
  
  // Google OAuth (verified email provider)
  if (hasGoogle) {
    return 'SOCIAL_VERIFIED';
  }
  
  // Discord or GitHub OAuth
  if (hasDiscord || hasGithub) {
    return 'SOCIAL_BASIC';
  }
  
  // Web3 basic - wallet with signed message but no payment
  if (hasWallet) {
    return 'WEB3_BASIC';
  }
  
  // Web2 basic - email signup, verified email but no OAuth/payment
  if (hasEmailVerified) {
    return 'WEB2_BASIC';
  }
  
  // Wallet only (just connected, no signature verification)
  if (isWeb3Mode) {
    return 'WALLET_ONLY';
  }
  
  // Default: anonymous/unverified
  return 'ANONYMOUS';
}

/**
 * Calculate a user's verification score (0-100) based on all their verifications.
 * Used for display purposes and tier calculation.
 */
export function calculateVerificationScore(user: Partial<User> & {
  hasGoogleAuth?: boolean;
  hasDiscordAuth?: boolean;
  hasGithubAuth?: boolean;
  hasVerifiedWallet?: boolean;
  hasWeb2Payment?: boolean;
  hasWeb3Payment?: boolean;
  phoneVerified?: Date | null;
  emailVerified?: Date | null;
}): number {
  let score = 0;
  
  // Email verified: +10
  if (user.emailVerified) score += 10;
  
  // Social OAuth scoring
  // Each OAuth provider independently verifies your email
  // Multiple providers = cross-verified identity = MORE secure
  const oauthProviders = [
    user.hasGoogleAuth,
    user.hasDiscordAuth,
    user.hasGithubAuth,
  ].filter(Boolean).length;
  
  // Base OAuth scores
  if (user.hasGoogleAuth) score += 20; // Google is worth more (stricter verification)
  if (user.hasDiscordAuth) score += 10;
  if (user.hasGithubAuth) score += 12; // GitHub slightly more (developer identity)
  
  // MULTI-OAUTH BONUS: +5 for each provider beyond the first
  // Rationale: An attacker would need to compromise multiple OAuth providers
  // to impersonate you, which is exponentially harder
  if (oauthProviders >= 2) {
    score += (oauthProviders - 1) * 5;
  }
  
  // Web3 wallet: +15
  if (user.hasVerifiedWallet) score += 15;
  
  // Payments: +15 each
  if (user.hasWeb2Payment) score += 15;
  if (user.hasWeb3Payment) score += 15;
  
  // Phone: +20 (strong identity verification)
  if (user.phoneVerified) score += 20;
  
  // 2FA enabled: +5
  if (user.isTwoFactorEnabled) score += 5;
  
  return Math.min(100, score);
}

// ─── Reach Score Aggregation ─────────────────────────────────────────────────

/**
 * Calculate total reach score from a collection of views.
 * This aggregates individual view strengths into a meaningful metric.
 */
export function calculateTotalReachScore(views: Array<{
  strength: number;
  isFirstView: boolean;
  verificationTier: VerificationTier;
}>): {
  totalScore: number;
  strongViews: number;
  moderateViews: number;
  weakViews: number;
  averageStrength: number;
} {
  if (views.length === 0) {
    return {
      totalScore: 0,
      strongViews: 0,
      moderateViews: 0,
      weakViews: 0,
      averageStrength: 0,
    };
  }
  
  let totalScore = 0;
  let strongViews = 0;
  let moderateViews = 0;
  let weakViews = 0;
  
  for (const view of views) {
    totalScore += view.strength;
    
    if (view.strength >= 0.7) {
      strongViews++;
    } else if (view.strength >= 0.4) {
      moderateViews++;
    } else {
      weakViews++;
    }
  }
  
  return {
    totalScore: Math.round(totalScore * 100) / 100,
    strongViews,
    moderateViews,
    weakViews,
    averageStrength: Math.round((totalScore / views.length) * 100) / 100,
  };
}
