import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const session = await auth();
    const currentUserId = session?.user?.id;

    const user = await dbPrisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        image: true,
        banner: true,
        bio: true,
        createdAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if current user is following this user
    let isFollowing = false;
    if (currentUserId && currentUserId !== userId) {
      const follow = await dbPrisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: userId,
          },
        },
      });
      isFollowing = !!follow;
    }

    return NextResponse.json({
      ...user,
      isFollowing,
    });
  } catch (error) {
    console.error('Error fetching user preview:', error);
    return NextResponse.json({ error: 'Failed to fetch user preview' }, { status: 500 });
  }
}
