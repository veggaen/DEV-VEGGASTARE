import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/browser';
import { UserSearchResponseSchema } from '@/lib/types/users';
import { DEMO_ID_PREFIX, isDemoUserId } from '@/lib/demo-policy';
import { checkRateLimit } from '@/lib/rate-limit';

const querySchema = z.object({
  q: z.string().trim().max(100).default(''),
  limit: z.coerce.number().int().min(1).max(20).default(10),
  excludeSelf: z.enum(['true', 'false']).default('true').transform(value => value === 'true'),
});
function privateJson(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie', ...extraHeaders } });
}

/** Bounded autocomplete for signed-in people; no directory enumeration in demo. */
export async function GET(req: Request) {
  try {
    // auth() refreshes the database identity/role on every request, including
    // deleted-account and token-version checks. Never accept a viewer from query.
    const viewer = await MyLibUserAuth();
    if (!viewer?.id) return privateJson({ users: [], count: 0, message: 'Sign in to find people.' }, 401);
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return privateJson({ users: [], count: 0, message: 'Invalid search options.' }, 400);
    const { q, limit, excludeSelf } = parsed.data;
    if (isDemoUserId(viewer.id) || q.length < 2) return privateJson({ users: [], count: 0 });

    const rate = await checkRateLimit('people-search:' + viewer.id, 'read');
    if (!rate.success) return privateJson({ users: [], count: 0, message: 'Please wait before searching again.' }, 429, { 'Retry-After': String(Math.max(1, rate.resetIn)) });
    const privileged = viewer.role === 'ADMIN' || viewer.role === 'OWNER';
    // Prisma's contains/startsWith use SQL LIKE patterns; user input is literal.
    const literal = (value: string) => value.replace(/[\\%_]/g, '\\$&');
    const term = literal(q);
    const visibleEmail: Prisma.UserWhereInput = privileged
      ? { email: { contains: term, mode: 'insensitive' } }
      : { AND: [{ email: { contains: term, mode: 'insensitive' } }, { OR: [{ emailDisplayMode: 'PRIMARY' }, { id: viewer.id }] }] };
    const users = await dbPrisma.user.findMany({
      where: { AND: [
        { id: { not: { startsWith: literal(DEMO_ID_PREFIX) } } },
        ...(excludeSelf ? [{ id: { not: viewer.id } }] : []),
        { OR: [{ name: { contains: term, mode: 'insensitive' } }, visibleEmail] },
      ] },
      select: { id: true, name: true, email: true, emailDisplayMode: true, image: true, role: true, bio: true },
      take: limit,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    if (!users.length) return privateJson({ users: [], count: 0 });
    const ids = users.map(user => user.id);
    // Independent reads run together; empty searches avoid both queries.
    const [counts, following] = await Promise.all([
      dbPrisma.follow.groupBy({ by: ['followingId'], where: { followingId: { in: ids } }, _count: { followingId: true } }),
      dbPrisma.follow.findMany({ where: { followerId: viewer.id, followingId: { in: ids } }, select: { followingId: true } }),
    ]);
    const countMap = new Map(counts.map(row => [row.followingId, row._count.followingId]));
    const followingSet = new Set(following.map(row => row.followingId));
    const payload = UserSearchResponseSchema.safeParse({
      users: users.map(user => ({
        id: user.id, name: user.name || 'Veggat member',
        email: privileged || user.id === viewer.id || user.emailDisplayMode === 'PRIMARY' ? user.email : null,
        image: user.image || '/users/avatar.webp',
        role: privileged ? user.role : null, bio: user.bio || null,
        followerCount: countMap.get(user.id) || 0, isFollowing: followingSet.has(user.id),
      })),
      count: users.length,
    });
    if (!payload.success) throw new Error('Invalid search result');
    return privateJson(payload.data);
  } catch {
    // Never log a raw Prisma/provider error: it may include connection details.
    console.error('[api/users/search] Search failed');
    return privateJson({ users: [], count: 0, message: 'People search is temporarily unavailable.' }, 500);
  }
}

