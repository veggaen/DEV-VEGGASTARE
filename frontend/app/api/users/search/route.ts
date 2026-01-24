import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';

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
    
    // Parse URL params
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim() || '';
    const limitParam = parseInt(searchParams.get('limit') || '10', 10);
    const excludeSelf = searchParams.get('excludeSelf') !== 'false';
    
    // Validate query
    if (query.length < 1) {
      return NextResponse.json(
        { users: [], message: 'Query must be at least 1 character' },
        { status: 200 }
      );
    }
    
    // Clamp limit
    const limit = Math.min(Math.max(1, limitParam), 50);
    
    console.log(LOG_PREFIX, `Searching users: q="${query}", limit=${limit}, excludeSelf=${excludeSelf}`);
    
    // Build where clause with case-insensitive search
    const whereClause: Record<string, unknown> = {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    };
    
    // Exclude current user if requested and authenticated
    if (excludeSelf && currentUser?.id) {
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

