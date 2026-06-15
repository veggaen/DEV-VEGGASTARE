import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';
import { UserFollowListResponseSchema } from '@/lib/types/users';
import { resolveVisibleEmail } from '@/lib/email-visibility';

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

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
            emailDisplayMode: true,
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
      id: f.following.id,
      name: f.following.name,
      email: resolveVisibleEmail({
        targetUserId: f.following.id,
        targetEmail: f.following.email,
        targetEmailDisplayMode: f.following.emailDisplayMode,
        viewerUserId: session?.id,
        viewerRole: session?.role,
      }),
      image: f.following.image,
      bio: f.following.bio,
      followerCount: f.following._count.followers,
      followingCount: f.following._count.following,
      isFollowing: followingSet.has(f.following.id),
      followedAt: toIsoString(f.createdAt),
    }));

    const nextCursor = following.length === limit ? following[following.length - 1]?.id : null;

    const payload = {
      users,
      nextCursor,
      total: await dbPrisma.follow.count({ where: { followerId: userId } }),
    };

    const validated = UserFollowListResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error('[api/users/[userId]/following] Invalid DTO:', validated.error);
      return NextResponse.json(
        { error: 'Failed to fetch following', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data);
  } catch (error) {
    console.error('[api/users/[userId]/following] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch following' }, { status: 500 });
  }
}
