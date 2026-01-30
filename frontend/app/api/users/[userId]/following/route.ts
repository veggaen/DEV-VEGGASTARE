import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ userId: string }> };

// GET - Get list of users this user follows
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
    const following = await dbPrisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
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
      const myFollowing = await dbPrisma.follow.findMany({
        where: {
          followerId: session.id,
          followingId: { in: following.map(f => f.followingId) },
        },
        select: { followingId: true },
      });
      followingSet = new Set(myFollowing.map(f => f.followingId));
    }

    const users = following.map(f => ({
      ...f.following,
      followerCount: f.following._count.followers,
      followingCount: f.following._count.following,
      isFollowing: followingSet.has(f.following.id),
      followedAt: f.createdAt,
    }));

    const nextCursor = following.length === limit ? following[following.length - 1]?.id : null;

    return NextResponse.json({
      users,
      nextCursor,
      total: await dbPrisma.follow.count({ where: { followerId: userId } }),
    });
  } catch (error) {
    console.error('[api/users/[userId]/following] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch following' }, { status: 500 });
  }
}
