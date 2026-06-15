import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { ensureUser } from '@/lib/ensure-user';
import { NextRequest, NextResponse } from 'next/server';
import {
  UserProfileGetResponseSchema,
  UserProfilePatchResponseSchema,
} from '@/lib/types/users';
import { resolveVisibleEmail } from '@/lib/email-visibility';
import { z } from 'zod';

const UserProfilePatchInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  image: z.string().url().max(2048).optional().nullable(),
  banner: z.string().url().max(2048).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
}).strict();

// Next.js 16+ params type
type RouteContext = { params: Promise<{ userId: string }> };

const LOG_PREFIX = '[api/users/[userId]]';
const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  // Authentication required
  const session = await MyLibUserAuth();
  
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = await context.params;

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  // Users can view their own profile, admins can view any profile
  const isOwnProfile = session.id === userId;
  const isAdmin = session.role === 'ADMIN';

  try {
    // If viewing own profile, ensure user exists in DB first
    if (isOwnProfile) {
      const ensureResult = await ensureUser(session);
      if (!ensureResult.success) {
        console.error(`${LOG_PREFIX} Failed to ensure user:`, ensureResult.error);
        return NextResponse.json({ error: 'Failed to initialize user profile' }, { status: 500 });
      }
    }

    // Fetch user with reach statistics (view counts across all their posts)
    const user = await dbPrisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailDisplayMode: true,
        image: true,
        banner: true,
        bio: true,
        createdAt: true,
        role: true,
        reachLifetime: true,
        reachMomentum: true,
        // Get follower/following counts
        followers: { select: { id: true } },
        following: { select: { id: true } },
        // Get reach stats from conversations
        Conversation: {
          where: { visibility: 'PUBLIC' },
          select: {
            viewCount: true,
            uniqueViewCount: true,
            replyCount: true,
            pillarVisibility: true,
            pillarEngagement: true,
            pillarConversion: true,
            pillarLoyalty: true,
            pillarGrowth: true,
            pillarRecall: true,
            pillarVelocity: true,
          },
        },
      },
    });

    if (!user) {
      // Differentiate: own profile missing vs other user not found
      if (isOwnProfile) {
        // This shouldn't happen after ensureUser, but handle gracefully
        console.error(`${LOG_PREFIX} Own profile not found after ensureUser - session id mismatch?`);
        return NextResponse.json({ error: 'Profile initialization failed' }, { status: 500 });
      }
      // Other user not found - normal 404
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Calculate reach metrics
    const totalViews = user.Conversation.reduce((sum, c) => sum + c.viewCount, 0);
    const uniqueViewers = user.Conversation.reduce((sum, c) => sum + c.uniqueViewCount, 0);
    const totalReplies = user.Conversation.reduce((sum, c) => sum + c.replyCount, 0);
    const followerCount = user.followers.length;
    const followingCount = user.following.length;
    // Engagement rate: reply interactions per unique viewer (0-100%)
    const engagementRate = uniqueViewers > 0
      ? Math.min((totalReplies / uniqueViewers) * 100, 100)
      : 0;

    // Calculate aggregate pillar breakdown from user's public pulses
    const convos = user.Conversation;
    const pulseCount = convos.length || 1;
    const pillarAvg = (field: 'pillarVisibility' | 'pillarEngagement' | 'pillarConversion' | 'pillarLoyalty' | 'pillarGrowth' | 'pillarRecall' | 'pillarVelocity') =>
      Math.min(100, Math.round(convos.reduce((s, c) => s + c[field], 0) / pulseCount));

    const visibility = pillarAvg('pillarVisibility');
    const engagementDepth = pillarAvg('pillarEngagement');
    const conversionImpact = pillarAvg('pillarConversion');
    const loyalty = pillarAvg('pillarLoyalty');
    const growth = pillarAvg('pillarGrowth');
    const recall = pillarAvg('pillarRecall');
    const velocity = pillarAvg('pillarVelocity');

    // Weighted True Reach Score (7-pillar)
    const trueReachScore = Math.round(
      visibility * 0.18 +
      engagementDepth * 0.25 +
      conversionImpact * 0.18 +
      loyalty * 0.14 +
      growth * 0.10 +
      recall * 0.05 +
      velocity * 0.10
    );

    const visibleEmail = resolveVisibleEmail({
      targetUserId: user.id,
      targetEmail: user.email,
      targetEmailDisplayMode: user.emailDisplayMode,
      viewerUserId: session.id,
      viewerRole: session.role,
    });

    // Generate username from email or name
    const username = visibleEmail?.split('@')[0]
      || user.name?.toLowerCase().replace(/\s+/g, '') 
      || user.id.slice(0, 8);

    // Return user data with conditional fields based on permissions
    const safeUser = {
      id: user.id,
      name: user.name,
      username,
      ...(visibleEmail ? { email: visibleEmail } : {}),
      image: user.image,
      banner: user.banner,
      bio: user.bio,
      createdAt: toIsoString(user.createdAt),
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
        totalReplies,
        engagementRate, // Higher = content actually reaches people
        reachLifetime: user.reachLifetime,
        reachMomentum: user.reachMomentum,
        visibility,
        engagementDepth,
        conversionImpact,
        loyalty,
        growth,
        recall,
        velocity,
        trueReachScore,
      },
    };

    const payload = { user: safeUser };
    const validated = UserProfileGetResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error(`${LOG_PREFIX} Invalid user profile GET DTO:`, validated.error);
      return NextResponse.json(
        { error: 'Failed to fetch user', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data, { status: 200 });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching user:`, error);
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
    const json = await request.json();
    const parsed = UserProfilePatchInputSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 400 }
      );
    }
    const updateData = parsed.data;

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

    const payload = {
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email ?? null,
        image: updatedUser.image,
        banner: updatedUser.banner,
        bio: updatedUser.bio,
      },
    };

    const validated = UserProfilePatchResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error(LOG_PREFIX, 'Invalid user profile PATCH DTO:', validated.error);
      return NextResponse.json(
        { error: 'Failed to update user', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}