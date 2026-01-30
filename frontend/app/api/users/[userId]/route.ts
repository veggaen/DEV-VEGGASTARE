import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextRequest, NextResponse } from 'next/server';

// Next.js 16+ params type
type RouteContext = { params: Promise<{ userId: string }> };

const LOG_PREFIX = '[api/users/[userId]]';

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  // Authentication required
  const session = await MyLibUserAuth();
  console.log(LOG_PREFIX, 'Session:', session?.id, session?.role);
  
  if (!session?.id) {
    console.log(LOG_PREFIX, 'No session - returning 401');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = await context.params;
  console.log(LOG_PREFIX, 'Looking for userId:', userId);

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  // Users can view their own profile, admins can view any profile
  const isOwnProfile = session.id === userId;
  const isAdmin = session.role === 'ADMIN';
  console.log(LOG_PREFIX, 'isOwnProfile:', isOwnProfile, 'isAdmin:', isAdmin);

  try {
    // Fetch user with reach statistics (view counts across all their posts)
    const user = await dbPrisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        banner: true,
        bio: true,
        createdAt: true,
        role: true,
        // Get follower/following counts
        followers: { select: { id: true } },
        following: { select: { id: true } },
        // Get reach stats from conversations
        Conversation: {
          where: { visibility: 'PUBLIC' },
          select: {
            viewCount: true,
            uniqueViewCount: true,
          },
        },
      },
    });

    console.log(LOG_PREFIX, 'User found:', user?.id, user?.name);

    if (!user) {
      console.log(LOG_PREFIX, 'User not found in DB');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Calculate reach metrics
    const totalViews = user.Conversation.reduce((sum, c) => sum + c.viewCount, 0);
    const uniqueViewers = user.Conversation.reduce((sum, c) => sum + c.uniqueViewCount, 0);
    const followerCount = user.followers.length;
    const followingCount = user.following.length;
    // Engagement rate: total views / followers (capped at 1000% to handle edge cases)
    const engagementRate = followerCount > 0 
      ? Math.min(Math.round((totalViews / followerCount) * 100), 100000) 
      : 0;

    // Generate username from email or name
    const username = user.email?.split('@')[0] 
      || user.name?.toLowerCase().replace(/\s+/g, '') 
      || user.id.slice(0, 8);

    // Return user data with conditional fields based on permissions
    const safeUser = {
      id: user.id,
      name: user.name,
      username,
      ...(isOwnProfile || isAdmin ? { email: user.email } : {}),
      image: user.image,
      banner: user.banner,
      bio: user.bio,
      createdAt: user.createdAt,
      ...(isAdmin ? { role: user.role } : {}),
      // Include follower/following counts
      _count: {
        followers: followerCount,
        following: followingCount,
        posts: user.Conversation.length,
      },
      // Reach metrics - actual engagement vs vanity followers
      reach: {
        totalViews,
        uniqueViewers,
        engagementRate, // Higher = content actually reaches people
      },
    };

    return NextResponse.json({ user: safeUser }, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PATCH - Update user profile (own profile only)
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = await context.params;

  // Users can only update their own profile
  if (session.id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    
    // Only allow specific fields to be updated
    const allowedFields = ['name', 'image', 'banner', 'bio'];
    const updateData: Record<string, string> = {};
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Validate URLs for image fields
        if (['image', 'banner'].includes(field) && body[field]) {
          try {
            new URL(body[field]);
          } catch {
            return NextResponse.json(
              { error: `Invalid URL for ${field}` },
              { status: 400 }
            );
          }
        }
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const updatedUser = await dbPrisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        banner: true,
        bio: true,
      },
    });

    return NextResponse.json({ user: updatedUser }, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}