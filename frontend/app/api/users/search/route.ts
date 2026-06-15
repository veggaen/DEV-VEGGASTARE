import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { parseQueryOrError } from '@/lib/api-validate';
import { z } from 'zod';
import { UserSearchResponseSchema } from '@/lib/types/users';
import { resolveVisibleEmail } from '@/lib/email-visibility';

const LOG_PREFIX = '[api/users/search]';
const isDev = process.env.NODE_ENV !== 'production';

/**
 * GET /api/users/search?q=<query>&limit=<number>&excludeSelf=<boolean>
 * 
 * Case-insensitive user search for autocomplete.
 * Searches by name and email.
 * 
 * Query params:
 *   - q: search query (min 1 char)
 *   - limit: max results (default 10, max 50)
 *   - excludeSelf: exclude current user from results (default true)
 */
export async function GET(req: Request) {
  try {
    const currentUser = await MyLibUserAuth();
    if (!currentUser?.id) {
      return NextResponse.json({ users: [], message: 'Unauthorized' }, { status: 401 });
    }
    
    const queryResult = parseQueryOrError(
      req,
      z.object({
        q: z.string().trim().min(1).max(100),
        limit: z.coerce.number().int().min(1).max(20).optional().default(10),
        excludeSelf: z
          .preprocess((v) => v !== 'false', z.boolean())
          .optional()
          .default(true),
      })
    );
    if (!queryResult.ok) return queryResult.response;
    const { q, limit, excludeSelf } = queryResult.data;
    
    // Reduce enumeration: require at least 2 chars.
    if (q.length < 2) {
      return NextResponse.json({ users: [], count: 0, message: 'Query too short' }, { status: 200 });
    }
    
    // Build where clause with case-insensitive search
    const canSeeAllEmails = currentUser.role === 'ADMIN' || currentUser.role === 'OWNER';
    const whereClause: Record<string, unknown> = {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        canSeeAllEmails
          ? { email: { contains: q, mode: 'insensitive' } }
          : {
              AND: [
                { email: { contains: q, mode: 'insensitive' } },
                {
                  OR: [
                    { emailDisplayMode: 'PRIMARY' },
                    { id: currentUser.id },
                  ],
                },
              ],
            },
      ],
    };
    
    // Exclude current user if requested and authenticated
    if (excludeSelf) {
      whereClause.NOT = { id: currentUser.id };
    }
    
    const users = await dbPrisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        emailDisplayMode: true,
        image: true,
        role: true,
        bio: true,
      },
      take: limit,
      orderBy: [
        // Prioritize exact name matches, then partial matches
        { name: 'asc' },
      ],
    });
    
    // Fetch follower counts for all results
    const userIds = users.map(u => u.id);
    const followerCounts = await dbPrisma.follow.groupBy({
      by: ['followingId'],
      where: { followingId: { in: userIds } },
      _count: { followingId: true },
    });
    
    const countMap = new Map(
      followerCounts.map(f => [f.followingId, f._count.followingId])
    );

    // Check which users the current user is following
    const followingStatus = await dbPrisma.follow.findMany({
      where: {
        followerId: currentUser.id,
        followingId: { in: userIds },
      },
      select: { followingId: true },
    });
    const followingSet = new Set(followingStatus.map(f => f.followingId));
    
    // Process results
    const processedUsers = users.map(user => ({
      id: user.id,
      name: user.name || 'Unknown',
      email: resolveVisibleEmail({
        targetUserId: user.id,
        targetEmail: user.email,
        targetEmailDisplayMode: user.emailDisplayMode,
        viewerUserId: currentUser.id,
        viewerRole: currentUser.role,
      }),
      image: user.image || '/users/avatar.webp',
      role: user.role,
      bio: user.bio || null,
      followerCount: countMap.get(user.id) || 0,
      isFollowing: followingSet.has(user.id),
    }));

    const payload = {
      users: processedUsers,
      count: processedUsers.length,
    };

    const validated = UserSearchResponseSchema.safeParse(payload);
    if (!validated.success) {
      console.error(LOG_PREFIX, 'Invalid user search DTO:', validated.error);
      return NextResponse.json(
        { users: [], message: 'Server error while searching users', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data);
  } catch (error) {
    console.error(LOG_PREFIX, 'Error searching users:', error);
    return NextResponse.json(
      { users: [], message: 'Server error while searching users' },
      { status: 500 }
    );
  }
}

