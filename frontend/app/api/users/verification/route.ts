/**
 * GET /api/users/verification
 * 
 * Returns the current user's verification state:
 * - All boolean flags (hasGoogleAuth, hasWeb2Payment, etc.)
 * - Current tier, score, and multiplier
 * - Linked OAuth accounts
 * 
 * POST /api/users/verification
 * 
 * Triggers a manual recalculation of verification tier + score.
 */

import { NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { VERIFICATION_TIER_MULTIPLIERS } from '@/lib/view-strength';
import { recalculateVerificationTier } from '@/lib/verification-recalc';

type VerificationTierKey = keyof typeof VERIFICATION_TIER_MULTIPLIERS;

export async function GET() {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await dbPrisma.user.findUnique({
      where: { id: session.id },
      select: {
        emailVerified: true,
        hasGoogleAuth: true,
        hasDiscordAuth: true,
        hasGithubAuth: true,
        hasVerifiedWallet: true,
        hasWeb2Payment: true,
        hasWeb3Payment: true,
        phoneVerified: true,
        phoneNumber: true,
        isTwoFactorEnabled: true,
        web3ModeEnabled: true,
        verificationTier: true,
        verificationScore: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get linked OAuth accounts
    const accounts = await dbPrisma.account.findMany({
      where: { userId: session.id },
      select: { provider: true },
    });

    const linkedProviders = accounts.map(a => a.provider);

    const tier = (user.verificationTier ?? 'ANONYMOUS') as VerificationTierKey;
    const multiplier = VERIFICATION_TIER_MULTIPLIERS[tier] ?? 0.1;

    return NextResponse.json({
      flags: {
        emailVerified: user.emailVerified != null,
        hasGoogleAuth: user.hasGoogleAuth ?? false,
        hasDiscordAuth: user.hasDiscordAuth ?? false,
        hasGithubAuth: user.hasGithubAuth ?? false,
        hasVerifiedWallet: user.hasVerifiedWallet ?? false,
        hasWeb2Payment: user.hasWeb2Payment ?? false,
        hasWeb3Payment: user.hasWeb3Payment ?? false,
        phoneVerified: user.phoneVerified != null,
        isTwoFactorEnabled: user.isTwoFactorEnabled ?? false,
      },
      tier,
      score: user.verificationScore ?? 0,
      multiplier,
      linkedProviders,
      phoneNumber: user.phoneNumber
        ? user.phoneNumber.slice(0, -4) + '****'
        : null,
    });
  } catch (error) {
    console.error('[api/users/verification] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST — Manual recalculation of verification tier/score.
 * Useful when the user suspects their tier is stale.
 */
export async function POST() {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await recalculateVerificationTier(session.id);

  if (!result) {
    return NextResponse.json({ error: 'Failed to recalculate' }, { status: 500 });
  }

  const tier = result.tier as VerificationTierKey;
  return NextResponse.json({
    success: true,
    tier,
    score: result.score,
    multiplier: VERIFICATION_TIER_MULTIPLIERS[tier] ?? 0.1,
  });
}
