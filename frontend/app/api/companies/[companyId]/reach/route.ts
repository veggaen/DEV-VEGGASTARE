import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ companyId: string }> };

/**
 * GET /api/companies/[companyId]/reach
 * Returns company reach analytics: pillar breakdown, momentum trend,
 * top products, top employee contributors, badges.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { companyId } = await context.params;

  try {
    // Fetch company with reach data + products + employees
    const company = await dbPrisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        reachLifetime: true,
        reachMomentum: true,
        employeePulseBonus: true,
        Employee: {
          select: {
            userId: true,
            role: true,
            User: {
              select: {
                id: true,
                name: true,
                image: true,
                reachLifetime: true,
                reachMomentum: true,
              },
            },
          },
        },
        Product: {
          select: {
            id: true,
            title: true,
            reachLifetime: true,
            reachMomentum: true,
            viewCount: true,
            uniqueViewCount: true,
            image: true,
          },
          orderBy: { reachMomentum: 'desc' },
          take: 10,
        },
        Conversation: {
          where: { visibility: 'PUBLIC' },
          select: {
            id: true,
            title: true,
            reachScore: true,
            reachLifetime: true,
            reachMomentum: true,
            pillarVisibility: true,
            pillarEngagement: true,
            pillarConversion: true,
            pillarLoyalty: true,
            pillarGrowth: true,
            pillarRecall: true,
            pillarVelocity: true,
            viewCount: true,
            uniqueViewCount: true,
          },
          orderBy: { reachMomentum: 'desc' },
          take: 20,
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Check membership (owner, creator, or employee)
    const isMember = company.Employee.some(e => e.userId === session.id);
    // Non-members get a limited view
    const isFullAccess = isMember || session.role === 'ADMIN';

    // ─── Compute aggregate pillar breakdown from all public pulses ────
    const pulses = company.Conversation;
    const pillarAgg = {
      visibility: 0,
      engagement: 0,
      conversion: 0,
      loyalty: 0,
      growth: 0,
      recall: 0,
      velocity: 0,
    };
    const pulseCount = pulses.length || 1;
    for (const p of pulses) {
      pillarAgg.visibility += p.pillarVisibility;
      pillarAgg.engagement += p.pillarEngagement;
      pillarAgg.conversion += p.pillarConversion;
      pillarAgg.loyalty += p.pillarLoyalty;
      pillarAgg.growth += p.pillarGrowth;
      pillarAgg.recall += p.pillarRecall;
      pillarAgg.velocity += p.pillarVelocity;
    }

    // Average across pulses, capped at 100
    const pillarBreakdown = {
      visibility: Math.min(100, Math.round(pillarAgg.visibility / pulseCount)),
      engagement: Math.min(100, Math.round(pillarAgg.engagement / pulseCount)),
      conversion: Math.min(100, Math.round(pillarAgg.conversion / pulseCount)),
      loyalty: Math.min(100, Math.round(pillarAgg.loyalty / pulseCount)),
      growth: Math.min(100, Math.round(pillarAgg.growth / pulseCount)),
      recall: Math.min(100, Math.round(pillarAgg.recall / pulseCount)),
      velocity: Math.min(100, Math.round(pillarAgg.velocity / pulseCount)),
    };

    // ─── Aggregate stats ────────────────────────────────────────────
    const totalViews = pulses.reduce((s, p) => s + p.viewCount, 0)
      + company.Product.reduce((s, p) => s + p.viewCount, 0);
    const uniqueViewers = pulses.reduce((s, p) => s + p.uniqueViewCount, 0)
      + company.Product.reduce((s, p) => s + p.uniqueViewCount, 0);

    // ─── Momentum trend (last 30 days from DailyReachRollup) ────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const rollups = await dbPrisma.dailyReachRollup.findMany({
      where: {
        companyId,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        addedMomentum: true,
        addedLifetime: true,
        totalViews: true,
        uniqueViewers: true,
        totalEngagements: true,
        dVisibility: true,
        dEngagement: true,
        dConversion: true,
        dLoyalty: true,
        dGrowth: true,
        dRecall: true,
        dVelocity: true,
      },
    });

    const momentumTrend = rollups.map(r => ({
      date: r.date.toISOString().split('T')[0],
      momentum: r.addedMomentum,
      lifetime: r.addedLifetime,
      views: r.totalViews,
      engagements: r.totalEngagements,
    }));

    // ─── Top employees by reach ─────────────────────────────────────
    const topEmployees = company.Employee
      .map(e => ({
        userId: e.userId,
        name: e.User.name,
        image: e.User.image,
        role: e.role,
        reachLifetime: e.User.reachLifetime,
        reachMomentum: e.User.reachMomentum,
      }))
      .sort((a, b) => b.reachMomentum - a.reachMomentum)
      .slice(0, 5);

    // ─── Top products by momentum ───────────────────────────────────
    const topProducts = company.Product.map(p => ({
      id: p.id,
      name: p.title,
      image: p.image?.[0] || null,
      reachLifetime: p.reachLifetime,
      reachMomentum: p.reachMomentum,
      views: p.viewCount,
    })).slice(0, 5);

    // ─── Top pulses by momentum ─────────────────────────────────────
    const topPulses = pulses.slice(0, 5).map(p => ({
      id: p.id,
      title: p.title,
      reachMomentum: p.reachMomentum,
      views: p.viewCount,
    }));

    // ─── Badges / Perks ─────────────────────────────────────────────
    const badges = computeCompanyBadges(company.reachMomentum, company.reachLifetime, totalViews, pulseCount);

    return NextResponse.json({
      companyId: company.id,
      companyName: company.name,
      reachLifetime: company.reachLifetime,
      reachMomentum: company.reachMomentum,
      employeePulseBonus: company.employeePulseBonus,
      pillarBreakdown,
      totalViews,
      uniqueViewers,
      pulseCount: pulses.length,
      productCount: company.Product.length,
      momentumTrend,
      ...(isFullAccess ? { topEmployees } : {}),
      topProducts,
      topPulses,
      badges,
    }, { status: 200 });
  } catch (error) {
    console.error('[api/companies/reach] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch reach analytics' }, { status: 500 });
  }
}

// ─── Badge System ─────────────────────────────────────────────────────────

interface ReachBadge {
  id: string;
  label: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  description: string;
  earned: boolean;
  progress: number; // 0-100
}

function computeCompanyBadges(
  momentum: number,
  lifetime: number,
  totalViews: number,
  pulseCount: number
): ReachBadge[] {
  return [
    {
      id: 'rising-brand',
      label: 'Rising Brand',
      icon: '🌱',
      tier: 'bronze',
      description: 'Reach 100 momentum — your brand is gaining traction',
      earned: momentum >= 100,
      progress: Math.min(100, Math.round((momentum / 100) * 100)),
    },
    {
      id: 'momentum-maker',
      label: 'Momentum Maker',
      icon: '🚀',
      tier: 'silver',
      description: 'Reach 500 momentum — your content is spreading fast',
      earned: momentum >= 500,
      progress: Math.min(100, Math.round((momentum / 500) * 100)),
    },
    {
      id: 'market-presence',
      label: 'Market Presence',
      icon: '⭐',
      tier: 'gold',
      description: 'Reach 2,000 momentum — featured company status',
      earned: momentum >= 2000,
      progress: Math.min(100, Math.round((momentum / 2000) * 100)),
    },
    {
      id: 'industry-leader',
      label: 'Industry Leader',
      icon: '👑',
      tier: 'platinum',
      description: 'Reach 10,000 momentum — top company on the platform',
      earned: momentum >= 10000,
      progress: Math.min(100, Math.round((momentum / 10000) * 100)),
    },
    {
      id: 'view-magnet',
      label: 'View Magnet',
      icon: '🧲',
      tier: 'silver',
      description: 'Accumulate 10,000 total views across all content',
      earned: totalViews >= 10000,
      progress: Math.min(100, Math.round((totalViews / 10000) * 100)),
    },
    {
      id: 'content-engine',
      label: 'Content Engine',
      icon: '⚡',
      tier: 'gold',
      description: 'Publish 50+ pulses — consistent content creation',
      earned: pulseCount >= 50,
      progress: Math.min(100, Math.round((pulseCount / 50) * 100)),
    },
    {
      id: 'legacy-builder',
      label: 'Legacy Builder',
      icon: '🏛️',
      tier: 'diamond',
      description: 'Reach 50,000 lifetime reach — lasting brand impact',
      earned: lifetime >= 50000,
      progress: Math.min(100, Math.round((lifetime / 50000) * 100)),
    },
  ];
}
