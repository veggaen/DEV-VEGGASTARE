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

// GET - Get list of users this user follows
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
    const anchor = cursor ? await dbPrisma.follow.findFirst({ where: { id: cursor, followerId: userId }, select: { id: true, createdAt: true } }) : null;
    if (cursor && !anchor) return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
    const following = await dbPrisma.follow.findMany({
      where: { followerId: userId, ...(anchor ? { OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }] } : {}) },
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
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = following.length > limit;
    if (hasMore) following.pop();

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
      // Legacy User relation names describe the FK side, not the displayed count.
      followerCount: f.following._count.following,
      followingCount: f.following._count.followers,
      isFollowing: followingSet.has(f.following.id),
      followedAt: toIsoString(f.createdAt),
    }));

    const nextCursor = hasMore ? following[following.length - 1]?.id : null;

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

    return NextResponse.json(validated.data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[api/users/[userId]/following] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch following' }, { status: 500 });
  }
}
