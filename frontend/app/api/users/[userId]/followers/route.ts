import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';
import { UserFollowListResponseSchema } from '@/lib/types/users';
import { resolveVisibleEmail } from '@/lib/email-visibility';
import { z } from 'zod';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

type RouteContext = { params: Promise<{ userId: string }> };

// GET - Get list of users who follow this user
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const session = await MyLibUserAuth();
  const { userId } = await context.params;
  const { searchParams } = new URL(request.url);
  const parsed = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20), cursor: z.string().min(1).max(200).optional() }).safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid pagination' }, { status: 400 });
  const { limit, cursor } = parsed.data;

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }
  const rate = await checkRateLimit(getClientIdentifier(request, session?.id), 'read');
  if (!rate.success) return rateLimitedResponse(rate);

  try {
    const anchor = cursor ? await dbPrisma.follow.findFirst({ where: { id: cursor, followingId: userId }, select: { id: true, createdAt: true } }) : null;
    if (cursor && !anchor) return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
    const followers = await dbPrisma.follow.findMany({
      where: { followingId: userId, ...(anchor ? { OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }] } : {}) },
      include: {
        follower: {
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
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = followers.length > limit;
    if (hasMore) followers.pop();

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
      id: f.follower.id,
      name: f.follower.name,
      email: resolveVisibleEmail({
        targetUserId: f.follower.id,
        targetEmail: f.follower.email,
        targetEmailDisplayMode: f.follower.emailDisplayMode,
        viewerUserId: session?.id,
        viewerRole: session?.role,
      }),
      image: f.follower.image,
      bio: f.follower.bio,
      // Legacy User relation names describe the FK side, not the displayed count.
      followerCount: f.follower._count.following,
      followingCount: f.follower._count.followers,
      isFollowing: followingSet.has(f.follower.id),
      followedAt: toIsoString(f.createdAt),
    }));

    const nextCursor = hasMore ? followers[followers.length - 1]?.id : null;

    const payload = {
      users,
      nextCursor,
      total: await dbPrisma.follow.count({ where: { followingId: userId } }),
    };

    const validated = UserFollowListResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error('[api/users/[userId]/followers] Invalid DTO:', validated.error);
      return NextResponse.json(
        { error: 'Failed to fetch followers', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[api/users/[userId]/followers] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch followers' }, { status: 500 });
  }
}
