import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';
import { UserSuggestionsResponseSchema } from '@/lib/types/users';

const isDev = process.env.NODE_ENV !== 'production';

// GET - Get user suggestions for starting a conversation
// Priority: Recent chats > Friends > Following > Colleagues
export async function GET(request: NextRequest) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 30);

  try {
    const suggestions: Array<{
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
      bio: string | null;
      reason: string;
      priority: number;
    }> = [];

    const addedIds = new Set<string>();

    // 1. Recent conversation partners (highest priority)
    const recentConversations = await dbPrisma.conversation.findMany({
      where: {
        OR: [
          { userId: session.id },
          { participants: { has: session.id } },
        ],
        type: { in: ['PRIVATE_DM', 'GROUP'] },
      },
      orderBy: { lastActivityAt: 'desc' },
      take: 20,
      select: {
        participants: true,
        userId: true,
      },
    });

    const recentUserIds = new Set<string>();
    for (const conv of recentConversations) {
      const participants = conv.participants as string[];
      for (const id of participants) {
        if (id !== session.id) recentUserIds.add(id);
      }
      if (conv.userId !== session.id) recentUserIds.add(conv.userId);
    }

    if (recentUserIds.size > 0) {
      const recentUsers = await dbPrisma.user.findMany({
        where: { id: { in: Array.from(recentUserIds) } },
        select: { id: true, name: true, email: true, image: true, bio: true },
        take: 5,
      });
      for (const user of recentUsers) {
        if (!addedIds.has(user.id)) {
          suggestions.push({ ...user, reason: 'Recent chat', priority: 1 });
          addedIds.add(user.id);
        }
      }
    }

    // 2. Friends (second priority)
    const friendships = await dbPrisma.friendship.findMany({
      where: {
        OR: [
          { userAId: session.id },
          { userBId: session.id },
        ],
      },
      take: 10,
    });

    const friendIds = friendships.map(f => 
      f.userAId === session.id ? f.userBId : f.userAId
    ).filter(id => !addedIds.has(id));

    if (friendIds.length > 0) {
      const friends = await dbPrisma.user.findMany({
        where: { id: { in: friendIds } },
        select: { id: true, name: true, email: true, image: true, bio: true },
      });
      for (const user of friends) {
        if (!addedIds.has(user.id)) {
          suggestions.push({ ...user, reason: 'Friend', priority: 2 });
          addedIds.add(user.id);
        }
      }
    }

    // 3. People you follow (third priority)
    const following = await dbPrisma.follow.findMany({
      where: { followerId: session.id },
      include: {
        following: {
          select: { id: true, name: true, email: true, image: true, bio: true },
        },
      },
      take: 10,
    });

    for (const f of following) {
      if (!addedIds.has(f.following.id)) {
        suggestions.push({ ...f.following, reason: 'Following', priority: 3 });
        addedIds.add(f.following.id);
      }
    }

    // 4. Colleagues (same company)
    const employments = await dbPrisma.employee.findMany({
      where: { userId: session.id },
      select: { companyId: true },
    });

    if (employments.length > 0) {
      const colleagues = await dbPrisma.employee.findMany({
        where: {
          companyId: { in: employments.map(e => e.companyId) },
          userId: { not: session.id },
        },
        include: {
          User: {
            select: { id: true, name: true, email: true, image: true, bio: true },
          },
        },
        take: 10,
      });

      for (const c of colleagues) {
        if (!addedIds.has(c.User.id)) {
          suggestions.push({ ...c.User, reason: 'Colleague', priority: 4 });
          addedIds.add(c.User.id);
        }
      }
    }

    // Sort by priority and limit
    const sortedSuggestions = suggestions
      .sort((a, b) => a.priority - b.priority)
      .slice(0, limit);

    // Fetch follower counts for all suggestions
    const suggestionIds = sortedSuggestions.map(s => s.id);
    const followerCounts = await dbPrisma.follow.groupBy({
      by: ['followingId'],
      where: { followingId: { in: suggestionIds } },
      _count: { followingId: true },
    });

    const countMap = new Map(
      followerCounts.map(f => [f.followingId, f._count.followingId])
    );

    // Check which users the current user is following
    const followingStatus = await dbPrisma.follow.findMany({
      where: {
        followerId: session.id,
        followingId: { in: suggestionIds },
      },
      select: { followingId: true },
    });
    const followingSet = new Set(followingStatus.map(f => f.followingId));

    const enrichedSuggestions = sortedSuggestions.map(s => ({
      ...s,
      followerCount: countMap.get(s.id) || 0,
      isFollowing: followingSet.has(s.id),
    }));

    const payload = { suggestions: enrichedSuggestions };

    const validated = UserSuggestionsResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error('[api/users/suggestions] Invalid DTO:', validated.error);
      return NextResponse.json(
        { error: 'Failed to fetch suggestions', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data);
  } catch (error) {
    console.error('[api/users/suggestions] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
