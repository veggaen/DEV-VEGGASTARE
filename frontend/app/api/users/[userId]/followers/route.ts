import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ userId: string }> };

// GET - Get list of users who follow this user
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const session = await MyLibUserAuth();
  const { userId } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const cursor = searchParams.get('cursor') || undefined;

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

  try {
    const followers = await dbPrisma.follow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            bio: true,
            _count: {
              select: {
                followers: true,
                following: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    // Check if current user follows each of these users
    let followingSet = new Set<string>();
    if (session?.id) {
      const following = await dbPrisma.follow.findMany({
        where: {
          followerId: session.id,
          followingId: { in: followers.map(f => f.followerId) },
        },
        select: { followingId: true },
      });
      followingSet = new Set(following.map(f => f.followingId));
    }

    const users = followers.map(f => ({
      ...f.follower,
      followerCount: f.follower._count.followers,
      followingCount: f.follower._count.following,
      isFollowing: followingSet.has(f.follower.id),
      followedAt: f.createdAt,
    }));

    const nextCursor = followers.length === limit ? followers[followers.length - 1]?.id : null;

    return NextResponse.json({
      users,
      nextCursor,
      total: await dbPrisma.follow.count({ where: { followingId: userId } }),
    });
  } catch (error) {
    console.error('[api/users/[userId]/followers] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch followers' }, { status: 500 });
  }
}
