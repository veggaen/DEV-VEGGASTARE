import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';
import {
  UserFollowMutationResponseSchema,
  UserFollowStatusResponseSchema,
} from '@/lib/types/users';

const isDev = process.env.NODE_ENV !== 'production';

type RouteContext = { params: Promise<{ userId: string }> };

// GET - Check if current user follows this user + get follow counts
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const session = await MyLibUserAuth();
  const { userId } = await context.params;

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

  try {
    // Get follower and following counts
    const [followerCount, followingCount, isFollowing] = await Promise.all([
      dbPrisma.follow.count({
        where: { followingId: userId },
      }),
      dbPrisma.follow.count({
        where: { followerId: userId },
      }),
      session?.id
        ? dbPrisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: session.id,
                followingId: userId,
              },
            },
          })
        : null,
    ]);

    const payload = {
      followerCount,
      followingCount,
      isFollowing: !!isFollowing,
    };

    const validated = UserFollowStatusResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error('[api/users/[userId]/follow] Invalid GET DTO:', validated.error);
      return NextResponse.json(
        { error: 'Failed to fetch follow status', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data);
  } catch (error) {
    console.error('[api/users/[userId]/follow] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch follow status' }, { status: 500 });
  }
}

// POST - Follow a user
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = await context.params;

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

  if (session.id === userId) {
    return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
  }

  try {
    // Check if user exists
    const targetUser = await dbPrisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create follow relationship
    const follow = await dbPrisma.follow.create({
      data: {
        followerId: session.id,
        followingId: userId,
      },
    });

    // Get updated counts
    const [followerCount, followingCount] = await Promise.all([
      dbPrisma.follow.count({ where: { followingId: userId } }),
      dbPrisma.follow.count({ where: { followerId: userId } }),
    ]);

    const payload = {
      success: true as const,
      isFollowing: true,
      followerCount,
      followingCount,
    };

    const validated = UserFollowMutationResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error('[api/users/[userId]/follow] Invalid POST DTO:', validated.error);
      return NextResponse.json(
        { error: 'Failed to follow user', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data);
  } catch (error: any) {
    // Handle duplicate follow (already following)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Already following this user' }, { status: 409 });
    }
    console.error('[api/users/[userId]/follow] Error:', error);
    return NextResponse.json({ error: 'Failed to follow user' }, { status: 500 });
  }
}

// DELETE - Unfollow a user
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = await context.params;

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

  try {
    await dbPrisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: session.id,
          followingId: userId,
        },
      },
    });

    // Get updated counts
    const [followerCount, followingCount] = await Promise.all([
      dbPrisma.follow.count({ where: { followingId: userId } }),
      dbPrisma.follow.count({ where: { followerId: userId } }),
    ]);

    const payload = {
      success: true as const,
      isFollowing: false,
      followerCount,
      followingCount,
    };

    const validated = UserFollowMutationResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error('[api/users/[userId]/follow] Invalid DELETE DTO:', validated.error);
      return NextResponse.json(
        { error: 'Failed to unfollow user', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Not following this user' }, { status: 404 });
    }
    console.error('[api/users/[userId]/follow] Error:', error);
    return NextResponse.json({ error: 'Failed to unfollow user' }, { status: 500 });
  }
}
