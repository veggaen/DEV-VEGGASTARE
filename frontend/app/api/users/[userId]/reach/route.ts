import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';
import { computeReach, REACH_CONFIG, type WalletSignal } from '@/lib/reach/reach-engine';

type RouteContext = { params: Promise<{ userId: string }> };

/**
 * GET /api/users/[userId]/reach
 * Returns user-level reach analytics: momentum trend (30d) and badges.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = await context.params;

  try {
    // Get user reach data + True Reach trust inputs
    const user = await dbPrisma.user.findUnique({
      where: { id: userId },
      select: {
        reachLifetime: true,
        reachMomentum: true,
        trueReach: true,
        riskScore: true,
        verificationTier: true,
        // trust inputs
        bankidVerified: true,
        vippsVerified: true,
        phoneVerified: true,
        emailVerified: true,
        emailRisk: true,
        hasGoogleAuth: true,
        hasGithubAuth: true,
        hasDiscordAuth: true,
        hasWeb2Payment: true,
        hasWeb3Payment: true,
        _count: {
          select: {
            Conversation: true,
            followers: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Wallet provenance signals
    let walletSignals: WalletSignal[] = [];
    try {
      const wallets = await dbPrisma.wallet.findMany({
        where: { ownerUserId: userId },
        select: { verifiedAt: true, riskTier: true, donationTotalUsd: true },
      });
      walletSignals = wallets.map((w) => ({
        verified: w.verifiedAt != null,
        riskTier: (w.riskTier as WalletSignal['riskTier']) ?? 'neutral',
        hasHistory: (w.donationTotalUsd ?? 0) > 0 || w.riskTier === 'kyc',
      }));
    } catch { /* pre-migration safety */ }

    // Recompute the True Reach breakdown LIVE (always honest, never stale).
    const reach = computeReach({
      bankidVerified: user.bankidVerified != null,
      vippsVerified: user.vippsVerified != null,
      phoneVerified: user.phoneVerified != null,
      hasCardPayment: !!user.hasWeb2Payment,
      hasWeb3Spend: !!user.hasWeb3Payment,
      hasGoogle: !!user.hasGoogleAuth,
      hasGithub: !!user.hasGithubAuth,
      hasDiscord: !!user.hasDiscordAuth,
      emailVerified: user.emailVerified != null && user.emailRisk !== 'unverified',
      wallets: walletSignals,
      emailDisposable: user.emailRisk === 'disposable',
      emailPresentButUnverified: user.emailRisk === 'unverified',
      behaviorReach: user.reachLifetime ?? 0,
    });

    const trueReach = {
      score: reach.trueReach,
      riskScore: reach.riskScore,
      verificationTier: user.verificationTier,
      // class breakdown for the chart (each /cap → 0..1 ring)
      classes: [
        { key: 'governmentEid', label: 'Government eID', value: reach.trust.governmentEid, cap: REACH_CONFIG.classCaps.governmentEid, verified: user.bankidVerified != null },
        { key: 'bankPhone', label: 'Bank / Phone', value: reach.trust.bankPhone, cap: REACH_CONFIG.classCaps.bankPhone, verified: user.vippsVerified != null || user.phoneVerified != null },
        { key: 'payment', label: 'Payment', value: reach.trust.payment, cap: REACH_CONFIG.classCaps.payment, verified: !!user.hasWeb2Payment || !!user.hasWeb3Payment },
        { key: 'social', label: 'Social / Email', value: reach.trust.social, cap: REACH_CONFIG.classCaps.social, verified: !!user.hasGoogleAuth || !!user.hasGithubAuth || !!user.hasDiscordAuth },
        { key: 'walletProvenance', label: 'Wallet', value: reach.trust.walletProvenance, cap: REACH_CONFIG.classCaps.walletProvenance, verified: walletSignals.some((w) => w.verified) },
      ],
      trustTotal: reach.trust.total,
      trustCeiling: REACH_CONFIG.trueReach.trustNorm,
    };

    // Momentum trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const rollups = await dbPrisma.dailyReachRollup.findMany({
      where: {
        userId,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        addedMomentum: true,
        totalViews: true,
        totalEngagements: true,
      },
    });

    const momentumTrend = rollups.map(r => ({
      date: r.date.toISOString().split('T')[0],
      momentum: r.addedMomentum,
      views: r.totalViews,
      engagements: r.totalEngagements,
    }));

    // Aggregate view count across conversations
    const viewAgg = await dbPrisma.conversation.aggregate({
      where: { userId, visibility: 'PUBLIC' },
      _sum: { viewCount: true },
    });
    const totalViews = viewAgg._sum.viewCount || 0;

    // Compute user badges
    const badges = computeUserBadges(
      user.reachMomentum,
      user.reachLifetime,
      totalViews,
      user._count.Conversation,
      user._count.followers
    );

    return NextResponse.json({
      momentumTrend,
      badges,
      trueReach,
    }, { status: 200 });
  } catch (error) {
    console.error('[api/users/reach] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch reach data' }, { status: 500 });
  }
}

// ─── User Badge System ────────────────────────────────────────────────────

interface ReachBadge {
  id: string;
  label: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  description: string;
  earned: boolean;
  progress: number;
}

function computeUserBadges(
  momentum: number,
  lifetime: number,
  totalViews: number,
  pulseCount: number,
  followers: number
): ReachBadge[] {
  return [
    {
      id: 'first-pulse',
      label: 'First Pulse',
      icon: '💫',
      tier: 'bronze',
      description: 'Create your first pulse — every journey starts here',
      earned: pulseCount >= 1,
      progress: Math.min(100, pulseCount >= 1 ? 100 : 0),
    },
    {
      id: 'rising-voice',
      label: 'Rising Voice',
      icon: '🌱',
      tier: 'bronze',
      description: 'Reach 50 momentum — people are starting to notice',
      earned: momentum >= 50,
      progress: Math.min(100, Math.round((momentum / 50) * 100)),
    },
    {
      id: 'pulse-creator',
      label: 'Pulse Creator',
      icon: '✍️',
      tier: 'silver',
      description: 'Publish 10+ pulses — consistent content creator',
      earned: pulseCount >= 10,
      progress: Math.min(100, Math.round((pulseCount / 10) * 100)),
    },
    {
      id: 'momentum-builder',
      label: 'Momentum Builder',
      icon: '🚀',
      tier: 'silver',
      description: 'Reach 250 momentum — your content has real traction',
      earned: momentum >= 250,
      progress: Math.min(100, Math.round((momentum / 250) * 100)),
    },
    {
      id: 'community-magnet',
      label: 'Community Magnet',
      icon: '🧲',
      tier: 'gold',
      description: 'Gain 100+ followers — people want your content',
      earned: followers >= 100,
      progress: Math.min(100, Math.round((followers / 100) * 100)),
    },
    {
      id: 'reach-master',
      label: 'Reach Master',
      icon: '⭐',
      tier: 'gold',
      description: 'Reach 1,000 momentum — you\'re a platform influencer',
      earned: momentum >= 1000,
      progress: Math.min(100, Math.round((momentum / 1000) * 100)),
    },
    {
      id: 'viral-force',
      label: 'Viral Force',
      icon: '🔥',
      tier: 'platinum',
      description: 'Reach 5,000 momentum — your content goes viral regularly',
      earned: momentum >= 5000,
      progress: Math.min(100, Math.round((momentum / 5000) * 100)),
    },
    {
      id: 'view-tsunami',
      label: 'View Tsunami',
      icon: '🌊',
      tier: 'platinum',
      description: 'Accumulate 50,000 total views across all content',
      earned: totalViews >= 50000,
      progress: Math.min(100, Math.round((totalViews / 50000) * 100)),
    },
    {
      id: 'legacy-icon',
      label: 'Legacy Icon',
      icon: '💎',
      tier: 'diamond',
      description: 'Reach 25,000 lifetime reach — an enduring voice',
      earned: lifetime >= 25000,
      progress: Math.min(100, Math.round((lifetime / 25000) * 100)),
    },
  ];
}
