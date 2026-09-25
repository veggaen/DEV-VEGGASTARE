/** @fileOverview Current verification evidence shared by settings and Reach. @stability evolving */
import { Prisma } from '@/generated/prisma/client';
import { dbPrisma } from '@/lib/db';
import { isDemoUserId } from '@/lib/demo-policy';
import { calculateVerificationScore, determineUserVerificationTier, VERIFICATION_TIER_MULTIPLIERS } from '@/lib/view-strength';
import { computeReach } from '@/lib/reach/reach-engine';
import { recordedCheckoutMoney, recordedCaptureProof, unadjustedPaidCapture } from './payments/checkout-reporting';

/** Never use cached tiers, wallet donation totals or caller-supplied overrides
 * as proof. Read all contributing records from the same database snapshot. */
export async function loadVerificationEvidence(tx: Prisma.TransactionClient, userId: string) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: {
    emailVerified: true, phoneVerified: true, phoneNumber: true, isTwoFactorEnabled: true,
    hasGoogleAuth: true, hasGithubAuth: true, hasDiscordAuth: true, web3ModeEnabled: true,
    bankidVerified: true, vippsVerified: true, emailRisk: true, reachLifetime: true,
  } });
  if (!user) return null;
  const [accounts, pending, wallets, liveCapture] = await Promise.all([
    tx.account.findMany({ where: { userId }, select: { provider: true } }),
    tx.pendingOAuthLink.findMany({ where: { userId, expires: { gt: new Date() } }, select: { provider: true } }),
    tx.wallet.findMany({ where: { ownerUserId: userId, ownerCompanyId: null,
      family: { in: ['EVM', 'SOLANA'] }, verifiedAt: { not: null } }, select: { id: true } }),
    // Sandbox, browser returns, refunded/reversed payments and legacy
    // Payment.status alone are not evidence of a verified Live purchase.
    tx.$queryRaw<{ orderId: string }[]>(Prisma.sql`
      SELECT c."orderId" FROM "CheckoutAttempt" c JOIN "Order" o ON o.id = c."orderId"
      WHERE c."userId" = ${userId} AND c."environment" = 'LIVE'
        AND ${recordedCheckoutMoney} AND ${recordedCaptureProof} AND ${unadjustedPaidCapture}
      LIMIT 1
    `),
  ]);
  const linkedProviders = accounts.map(a => a.provider);
  const flags = {
    emailVerified: user.emailVerified != null,
    hasGoogleAuth: user.hasGoogleAuth && linkedProviders.includes('google'),
    hasGithubAuth: user.hasGithubAuth && linkedProviders.includes('github'),
    hasDiscordAuth: user.hasDiscordAuth && linkedProviders.includes('discord'),
    hasVerifiedWallet: wallets.length > 0,
    hasWeb2Payment: !isDemoUserId(userId) && liveCapture.length > 0,
    // Legacy crypto completion accepts browser claims; no server-owned chain
    // proof is persisted yet. Do not promote it or pending donations to trust.
    hasWeb3Payment: false,
    phoneVerified: user.phoneVerified != null,
    isTwoFactorEnabled: user.isTwoFactorEnabled,
  };
  // Enabling a UI preference is not proof of wallet ownership or connection.
  const verified = { ...user, ...flags, web3ModeEnabled: false, emailVerified: user.emailVerified, phoneVerified: user.phoneVerified };
  const tier = determineUserVerificationTier(verified);
  const score = calculateVerificationScore(verified);
  const reach = computeReach({
    bankidVerified: user.bankidVerified != null, vippsVerified: user.vippsVerified != null,
    phoneVerified: flags.phoneVerified, hasCardPayment: flags.hasWeb2Payment, hasWeb3Spend: flags.hasWeb3Payment,
    hasGoogle: flags.hasGoogleAuth, hasGithub: flags.hasGithubAuth, hasDiscord: flags.hasDiscordAuth,
    emailVerified: flags.emailVerified && user.emailRisk !== 'unverified',
    // Ownership signatures are evidence; cached donations and wallet brands
    // are not independently verified provenance or KYC evidence.
    wallets: wallets.map(() => ({ verified: true, riskTier: 'neutral' as const, hasHistory: false })),
    emailDisposable: user.emailRisk === 'disposable', emailPresentButUnverified: user.emailRisk === 'unverified',
    behaviorReach: user.reachLifetime ?? 0,
  });
  return { user, flags, tier, score, multiplier: VERIFICATION_TIER_MULTIPLIERS[tier], reach,
    linkedProviders, pendingProviders: pending.map(p => p.provider) };
}

/** Read-only: opening settings never writes flags, sends mail or grants trust. */
export function readVerificationEvidence(userId: string) {
  return dbPrisma.$transaction(tx => loadVerificationEvidence(tx, userId), { isolationLevel: 'RepeatableRead' });
}
