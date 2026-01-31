import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { ReachResponseSchema } from '@/lib/types/analytics';

const LOG_PREFIX = '[api/analytics/reach]';

/**
 * GET /api/analytics/reach
 * 
 * Get reach analytics for a user's content
 * Query params:
 * - userId: User to get analytics for (defaults to current user)
 * - conversationId: Get analytics for specific conversation
 * - period: 'day' | 'week' | 'month' | 'all' (default: 'all')
 */
export async function GET(req: Request) {
  const session = await MyLibUserAuth();
  const { searchParams } = new URL(req.url);
  
  const targetUserId = searchParams.get('userId') || session?.id;
  const conversationId = searchParams.get('conversationId');
  const period = searchParams.get('period') || 'all';

  if (!targetUserId && !conversationId) {
    const dto = { message: 'User ID or Conversation ID required' };
    const parsed = ReachResponseSchema.safeParse(dto);
    return NextResponse.json(parsed.success ? parsed.data : dto, { status: 400 });
  }

  try {
    // Calculate date range
    let dateFilter: Date | undefined;
    const now = new Date();
    
    switch (period) {
      case 'day':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = undefined;
    }

    if (conversationId) {
      // Get analytics for specific conversation
      const conversation = await dbPrisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          title: true,
          viewCount: true,
          uniqueViewCount: true,
          uniqueIpCount: true,
          loggedInViewCount: true,
          anonymousViewCount: true,
          reachScore: true,
          replyCount: true,
          uniqueRepliers: true,
          createdAt: true,
        },
      });

      if (!conversation) {
        const dto = { message: 'Conversation not found' };
        const parsed = ReachResponseSchema.safeParse(dto);
        return NextResponse.json(parsed.success ? parsed.data : dto, { status: 404 });
      }

      // Get view breakdown by type
      const viewEvents = await dbPrisma.viewEvent.groupBy({
        by: ['viewType'],
        where: {
          conversationId,
          ...(dateFilter && { viewedAt: { gte: dateFilter } }),
        },
        _count: true,
        _sum: { strength: true },
      });

      // Get top viewers
      const topViewers = await dbPrisma.conversationView.findMany({
        where: { 
          conversationId,
          userId: { not: null },
        },
        orderBy: { viewCount: 'desc' },
        take: 10,
        include: {
          User: {
            select: { id: true, name: true, image: true },
          },
        },
      });

      // Calculate engagement rate
      const engagementRate = conversation.uniqueViewCount > 0
        ? (conversation.replyCount / conversation.uniqueViewCount) * 100
        : 0;

      // Calculate quality score based on view diversity
      const ipDiversity = conversation.viewCount > 0 
        ? conversation.uniqueIpCount / conversation.viewCount 
        : 0;
      const userDiversity = conversation.viewCount > 0 
        ? conversation.uniqueViewCount / conversation.viewCount 
        : 0;
      const qualityScore = (ipDiversity * 0.4 + userDiversity * 0.4 + Math.min(engagementRate / 10, 0.2)) * 100;

      const dto = {
        conversation: {
          id: conversation.id,
          title: conversation.title,
          viewCount: conversation.viewCount,
          uniqueViewCount: conversation.uniqueViewCount,
          uniqueIpCount: conversation.uniqueIpCount,
          loggedInViewCount: conversation.loggedInViewCount,
          anonymousViewCount: conversation.anonymousViewCount,
          reachScore: conversation.reachScore,
          replyCount: conversation.replyCount,
          uniqueRepliers: conversation.uniqueRepliers,
          createdAt: conversation.createdAt.toISOString(),
          engagementRate: engagementRate.toFixed(2),
          qualityScore: qualityScore.toFixed(1),
        },
        viewBreakdown: viewEvents.map((v) => {
          const count =
            typeof (v as any)._count === 'number'
              ? (v as any)._count
              : (v as any)._count?._all ?? 0;
          return {
            type: v.viewType,
            count,
            totalStrength: v._sum.strength ?? 0,
          };
        }),
        topViewers: topViewers.map((v) => ({
          user: {
            // `userId` is guaranteed non-null by the query filter.
            id: v.User?.id ?? v.userId!,
            name: v.User?.name ?? null,
            image: v.User?.image ?? null,
          },
          viewCount: v.viewCount,
          firstViewedAt: v.firstViewedAt.toISOString(),
          lastViewedAt: v.lastViewedAt.toISOString(),
        })),
      };

      const parsed = ReachResponseSchema.safeParse(dto);
      if (!parsed.success) {
        console.error(LOG_PREFIX, 'Invalid response DTO:', parsed.error.issues);
        return NextResponse.json(
          {
            message: 'Invalid response shape',
            issues: process.env.NODE_ENV === 'development' ? parsed.error.issues : undefined,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(parsed.data);
    }

    // Get analytics for user's all content
    const conversations = await dbPrisma.conversation.findMany({
      where: {
        userId: targetUserId,
        type: 'PUBLIC_THREAD',
      },
      select: {
        id: true,
        title: true,
        viewCount: true,
        uniqueViewCount: true,
        uniqueIpCount: true,
        loggedInViewCount: true,
        anonymousViewCount: true,
        reachScore: true,
        replyCount: true,
        createdAt: true,
      },
      orderBy: { reachScore: 'desc' },
    });

    // Aggregate totals
    const totals = conversations.reduce(
      (acc, conv) => ({
        totalViews: acc.totalViews + conv.viewCount,
        uniqueViews: acc.uniqueViews + conv.uniqueViewCount,
        uniqueIps: acc.uniqueIps + conv.uniqueIpCount,
        loggedInViews: acc.loggedInViews + conv.loggedInViewCount,
        anonymousViews: acc.anonymousViews + conv.anonymousViewCount,
        totalReachScore: acc.totalReachScore + conv.reachScore,
        totalReplies: acc.totalReplies + conv.replyCount,
      }),
      {
        totalViews: 0,
        uniqueViews: 0,
        uniqueIps: 0,
        loggedInViews: 0,
        anonymousViews: 0,
        totalReachScore: 0,
        totalReplies: 0,
      }
    );

    // Calculate overall metrics
    const avgEngagementRate = totals.uniqueViews > 0
      ? (totals.totalReplies / totals.uniqueViews) * 100
      : 0;

    const reachQuality = totals.totalViews > 0
      ? (totals.uniqueIps / totals.totalViews) * 100
      : 0;

    // Get recent view events for trend
    const recentViews = await dbPrisma.viewEvent.groupBy({
      by: ['viewType'],
      where: {
        conversationId: { in: conversations.map(c => c.id) },
        viewedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
      _count: true,
      _sum: { strength: true },
    });

    const dto = {
      totals: {
        ...totals,
        postCount: conversations.length,
        avgEngagementRate: avgEngagementRate.toFixed(2),
        reachQuality: reachQuality.toFixed(1),
      },
      topPosts: conversations.slice(0, 5).map((c) => ({
        id: c.id,
        title: c.title,
        reachScore: c.reachScore,
        viewCount: c.viewCount,
        uniqueViewCount: c.uniqueViewCount,
      })),
      recentViewBreakdown: recentViews.map((v) => {
        const count =
          typeof (v as any)._count === 'number'
            ? (v as any)._count
            : (v as any)._count?._all ?? 0;
        return {
          type: v.viewType,
          count,
          totalStrength: v._sum.strength ?? 0,
        };
      }),
    };

    const parsed = ReachResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error(LOG_PREFIX, 'Invalid response DTO:', parsed.error.issues);
      return NextResponse.json(
        {
          message: 'Invalid response shape',
          issues: process.env.NODE_ENV === 'development' ? parsed.error.issues : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error(LOG_PREFIX, 'Error fetching reach analytics:', error);
    const dto = { message: 'Error fetching analytics' };
    const parsed = ReachResponseSchema.safeParse(dto);
    return NextResponse.json(parsed.success ? parsed.data : dto, { status: 500 });
  }
}
