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
  calculateVerificationScore 
} from '@/lib/view-strength';

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
  }>
): Promise<{ tier: string; score: number } | null> {
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
        isTwoFactorEnabled: true,
        web3ModeEnabled: true,
      },
    });

    if (!user) {
      console.error(LOG_PREFIX, `User ${userId} not found`);
      return null;
    }

    // Merge current DB state with any overrides (for just-changed flags)
    const merged = { ...user, ...overrides };

    const tier = determineUserVerificationTier(merged);
    const score = calculateVerificationScore(merged);

    await dbPrisma.user.update({
      where: { id: userId },
      data: {
        verificationTier: tier,
        verificationScore: score,
      },
    });

    console.log(LOG_PREFIX, `User ${userId}: tier=${tier}, score=${score}`);
    return { tier, score };
  } catch (error) {
    console.error(LOG_PREFIX, `Error recalculating for user ${userId}:`, error);
    return null;
  }
}
