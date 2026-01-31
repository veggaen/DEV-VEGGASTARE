import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { UserPreviewResponseSchema } from '@/lib/types/users';

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

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

    const dto = {
      id: user.id,
      name: user.name,
      image: user.image,
      banner: user.banner,
      bio: user.bio,
      createdAt: toIsoString(user.createdAt),
      _count: {
        followers: user._count.followers,
        following: user._count.following,
      },
      isFollowing,
    };

    const parsed = UserPreviewResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error('Invalid user preview DTO:', parsed.error.issues);
      return NextResponse.json(
        { error: 'Failed to fetch user preview', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error('Error fetching user preview:', error);
    return NextResponse.json({ error: 'Failed to fetch user preview' }, { status: 500 });
  }
}
