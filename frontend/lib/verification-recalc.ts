/** @fileOverview Persist derived verification caches from current evidence only. @stability evolving */
import { dbPrisma } from '@/lib/db';
import { loadVerificationEvidence } from '@/lib/verification-evidence';

function serializationConflict(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  if (error.code === 'P2034') return true;
  // PostgreSQL reports a conflicting FOR UPDATE through Prisma's raw-query
  // error, rather than P2034. Retry only the specific serialization SQLSTATE.
  if (error.code !== 'P2010' || !('meta' in error) || !error.meta || typeof error.meta !== 'object') return false;
  if ('code' in error.meta && error.meta.code === '40001') return true;
  const adapter = 'driverAdapterError' in error.meta ? error.meta.driverAdapterError : null;
  const cause = adapter && typeof adapter === 'object' && 'cause' in adapter ? adapter.cause : null;
  return cause != null && typeof cause === 'object' && 'originalCode' in cause && cause.originalCode === '40001';
}

/** Cache maintenance is silent: explicit auth/wallet actions own their emails.
 * No override parameter can turn a client claim into a verified flag. */
export async function recalculateVerificationTier(userId: string): Promise<{ tier: string; score: number } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await dbPrisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
        const evidence = await loadVerificationEvidence(tx, userId);
        if (!evidence) return null;
        const { flags, tier, score, reach } = evidence;
        await tx.user.update({ where: { id: userId }, data: {
          hasGoogleAuth: flags.hasGoogleAuth, hasGithubAuth: flags.hasGithubAuth, hasDiscordAuth: flags.hasDiscordAuth,
          hasVerifiedWallet: flags.hasVerifiedWallet, hasWeb2Payment: flags.hasWeb2Payment, hasWeb3Payment: flags.hasWeb3Payment,
          verificationTier: tier, verificationScore: score, trueReach: reach.trueReach, riskScore: reach.riskScore,
        }, select: { id: true } });
        return { tier, score };
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (serializationConflict(error) && attempt < 2) continue;
      console.error('[verification-recalc] Unable to refresh verification cache');
      return null;
    }
  }
  return null;
}
