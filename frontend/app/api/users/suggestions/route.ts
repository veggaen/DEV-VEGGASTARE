import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UserSuggestionsResponseSchema } from '@/lib/types/users';
import { isDemoUserId, DEMO_ID_PREFIX } from '@/lib/demo-policy';
import { checkRateLimit } from '@/lib/rate-limit';

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(30).default(10) });
const selectPerson = { id: true, name: true, email: true, emailDisplayMode: true, image: true, bio: true } as const;
type Person = { id: string; name: string | null; email: string | null; emailDisplayMode?: string | null; image: string | null; bio: string | null };
function reply(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie', ...extra } });
}

/** Suggestions use existing relationships, never a global directory fallback. */
export async function GET(request: Request) {
  try {
    const viewer = await MyLibUserAuth();
    if (!viewer?.id) return reply({ error: 'Sign in to find people.' }, 401);
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return reply({ error: 'Invalid suggestion options.' }, 400);
    if (isDemoUserId(viewer.id)) return reply({ suggestions: [] });
    const rate = await checkRateLimit('people-suggestions:' + viewer.id, 'read');
    if (!rate.success) return reply({ error: 'Please wait before refreshing people.' }, 429, { 'Retry-After': String(Math.max(1, rate.resetIn)) });

    const eligible = (id: string) => id !== viewer.id && !isDemoUserId(id);
    const excludeDemo = { id: { not: { startsWith: DEMO_ID_PREFIX.replace(/[\\%_]/g, '\\$&') } } };
    // Independent bounded relationship reads start together.
    const [conversations, friendships, following, employments] = await Promise.all([
      dbPrisma.conversation.findMany({
        where: { OR: [{ userId: viewer.id }, { participants: { has: viewer.id } }], type: { in: ['PRIVATE_DM', 'GROUP'] } },
        orderBy: [{ lastActivityAt: 'desc' }, { id: 'asc' }], take: 20,
        select: { participants: true, userId: true },
      }),
      dbPrisma.friendship.findMany({
        where: { OR: [{ userAId: viewer.id }, { userBId: viewer.id }] },
        select: { userAId: true, userBId: true }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 10,
      }),
      dbPrisma.follow.findMany({
        where: { followerId: viewer.id, following: excludeDemo },
        select: { following: { select: selectPerson } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 10,
      }),
      dbPrisma.employee.findMany({
        where: { userId: viewer.id }, select: { companyId: true }, orderBy: { id: 'asc' }, take: 30,
      }),
    ]);
    const recentIds = [...new Set(conversations.flatMap(row => [row.userId, ...row.participants]).filter(eligible))].slice(0, 100);
    const friendIds = friendships.map(row => row.userAId === viewer.id ? row.userBId : row.userAId).filter(eligible);
    const [recent, friends, colleagues] = await Promise.all([
      recentIds.length ? dbPrisma.user.findMany({ where: { id: { in: recentIds } }, select: selectPerson, orderBy: { id: 'asc' }, take: 100 }) : [],
      friendIds.length ? dbPrisma.user.findMany({ where: { id: { in: friendIds } }, select: selectPerson, orderBy: { id: 'asc' }, take: 10 }) : [],
      employments.length ? dbPrisma.employee.findMany({
        where: { companyId: { in: employments.map(row => row.companyId) }, userId: { not: viewer.id }, User: excludeDemo },
        select: { User: { select: selectPerson } }, orderBy: [{ userId: 'asc' }, { id: 'asc' }], take: 10,
      }) : [],
    ]);
    const rows: (Person & { reason: string; priority: number })[] = [];
    const seen = new Set<string>();
    const add = (people: Person[], reason: string, priority: number) => {
      for (const person of people) if (eligible(person.id) && !seen.has(person.id)) {
        seen.add(person.id); rows.push({ ...person, reason, priority });
      }
    };
    // Preserve conversation recency rather than the order of the database IN query.
    const recentMap = new Map(recent.map(person => [person.id, person]));
    add(recentIds.flatMap(id => recentMap.has(id) ? [recentMap.get(id)!] : []).slice(0, 5), 'Recent chat', 1);
    add(friends, 'Friend', 2);
    add(following.map(row => row.following), 'Following', 3);
    add(colleagues.map(row => row.User), 'Colleague', 4);
    const selected = rows.slice(0, parsed.data.limit);
    if (!selected.length) return reply({ suggestions: [] });
    const ids = selected.map(row => row.id);
    const [counts, status] = await Promise.all([
      dbPrisma.follow.groupBy({ by: ['followingId'], where: { followingId: { in: ids } }, _count: { followingId: true } }),
      dbPrisma.follow.findMany({ where: { followerId: viewer.id, followingId: { in: ids } }, select: { followingId: true } }),
    ]);
    const countMap = new Map(counts.map(row => [row.followingId, row._count.followingId]));
    const followed = new Set(status.map(row => row.followingId));
    const privileged = viewer.role === 'ADMIN' || viewer.role === 'OWNER';
    return reply(UserSuggestionsResponseSchema.parse({ suggestions: selected.map(person => ({
      id: person.id, name: person.name, image: person.image, bio: person.bio,
      email: privileged || person.id === viewer.id || person.emailDisplayMode === 'PRIMARY' ? person.email : null,
      reason: person.reason, priority: person.priority, followerCount: countMap.get(person.id) || 0, isFollowing: followed.has(person.id),
    })) }));
  } catch {
    console.error('[api/users/suggestions] Suggestions failed');
    return reply({ error: 'People suggestions are temporarily unavailable.' }, 500);
  }
}
