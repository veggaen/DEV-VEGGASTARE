import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { parseQueryOrError } from '@/lib/api-validate';
import { z } from 'zod';

const LOG_PREFIX = '[api/users/search]';

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
    const whereClause: Record<string, unknown> = {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
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
        image: true,
        role: true,
      },
      take: limit,
      orderBy: [
        // Prioritize exact name matches, then partial matches
        { name: 'asc' },
      ],
    });
    
    // Process results
    const processedUsers = users.map(user => ({
      id: user.id,
      name: user.name || 'Unknown',
      email: user.email || '',
      image: user.image || '/users/avatar.webp',
      role: user.role,
    }));
    
    return NextResponse.json({
      users: processedUsers,
      count: processedUsers.length,
    });
    
  } catch (error) {
    console.error(LOG_PREFIX, 'Error searching users:', error);
    return NextResponse.json(
      { users: [], message: 'Server error while searching users' },
      { status: 500 }
    );
  }
}

