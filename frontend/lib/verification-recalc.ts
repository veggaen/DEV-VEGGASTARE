/**
 * Verification Tier Recalculation Utility
 * 
 * Shared function to recalculate a user's verification tier and score.
 * Used by: auth.ts (OAuth link), order routes (payment completion),
 * payment webhooks, phone verification, and manual recalculation.
 */

import { dbPrisma } from '@/lib/db';
import { 
  determineUserVerificationTier, 
  calculateVerificationScore,
  VERIFICATION_TIER_MULTIPLIERS
} from '@/lib/view-strength';
import { sendAuthLevelChangeEmail } from '@/lib/mail';

const LOG_PREFIX = '[verification-recalc]';

/**
 * Recalculate and persist a user's verification tier + score.
 * 
 * @param userId  — The user ID to recalculate for
 * @param overrides — Optional partial overrides to apply before calculation
 *                    (e.g. { hasGoogleAuth: true } when we know a flag just changed)
 * @returns The new tier and score, or null on error
 */
export async function recalculateVerificationTier(
  userId: string,
  overrides?: Partial<{
    hasGoogleAuth: boolean;
    hasDiscordAuth: boolean;
    hasGithubAuth: boolean;
    hasVerifiedWallet: boolean;
    hasWeb2Payment: boolean;
    hasWeb3Payment: boolean;
    phoneVerified: Date | null;
    emailVerified: Date | null;
    isTwoFactorEnabled: boolean;
  }>,
  triggerAction?: string
): Promise<{ tier: string; score: number } | null> {
  try {
    const user = await dbPrisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        hasGoogleAuth: true,
        hasDiscordAuth: true,
        hasGithubAuth: true,
        hasVerifiedWallet: true,
        hasWeb2Payment: true,
        hasWeb3Payment: true,
        phoneVerified: true,
        emailVerified: true,
        isTwoFactorEnabled: true,
        web3ModeEnabled: true,
        verificationTier: true,
        verificationScore: true,
      },
    });

    if (!user) {
      console.error(LOG_PREFIX, `User ${userId} not found`);
      return null;
    }

    // Query highest single-wallet donation total for donation-based trust
    let maxWalletDonationUsd = 0;
    try {
      const topWallet = await dbPrisma.wallet.findFirst({
        where: { ownerUserId: userId, verifiedAt: { not: null } },
        orderBy: { donationTotalUsd: 'desc' },
        select: { donationTotalUsd: true },
      });
      maxWalletDonationUsd = topWallet?.donationTotalUsd ?? 0;
    } catch {
      // donationTotalUsd column may not exist yet (pre-migration) — ignore
    }

    // Merge current DB state with any overrides (for just-changed flags)
    const merged = { ...user, ...overrides };
    const donationOpts = { maxWalletDonationUsd };

    const tier = determineUserVerificationTier(merged, donationOpts);
    const score = calculateVerificationScore(merged, donationOpts);

    await dbPrisma.user.update({
      where: { id: userId },
      data: {
        verificationTier: tier,
        verificationScore: score,
      },
    });

    console.log(LOG_PREFIX, `User ${userId}: tier=${tier}, score=${score}`);

    // Send email notification if tier actually changed
    const previousTier = user.verificationTier ?? 'ANONYMOUS';
    if (tier !== previousTier && user.email) {
      type TierKey = keyof typeof VERIFICATION_TIER_MULTIPLIERS;
      const multiplier = VERIFICATION_TIER_MULTIPLIERS[tier as TierKey] ?? 0.1;
      sendAuthLevelChangeEmail(user.email, {
        userName: user.name,
        previousTier,
        newTier: tier,
        newScore: score,
        newMultiplier: multiplier,
        triggerAction: triggerAction ?? 'Verification recalculation',
      }).catch((err) => console.error(LOG_PREFIX, 'Failed to send auth level email:', err));
    }

    return { tier, score };
  } catch (error) {
    console.error(LOG_PREFIX, `Error recalculating for user ${userId}:`, error);
    return null;
  }
}
