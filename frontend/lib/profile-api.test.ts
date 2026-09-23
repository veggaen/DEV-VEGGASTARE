/** @fileOverview Profile aggregation, privacy, writes and connection pagination regressions. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), user: vi.fn(), update: vi.fn(), aggregate: vi.fn(), followMany: vi.fn(), followFirst: vi.fn(), followOne: vi.fn(), count: vi.fn(), create: vi.fn(), remove: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: mocks.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { user: { findUnique: mocks.user, update: mocks.update }, conversation: { aggregate: mocks.aggregate }, follow: { findMany: mocks.followMany, findFirst: mocks.followFirst, findUnique: mocks.followOne, count: mocks.count, create: mocks.create, delete: mocks.remove } } }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.limit, getClientIdentifier: () => 'qa', rateLimitedResponse: () => new Response(null, { status: 429 }) }));
import { GET as profile, PATCH } from '@/app/api/users/[userId]/route';
import { GET as followers } from '@/app/api/users/[userId]/followers/route';
import { GET as following } from '@/app/api/users/[userId]/following/route';
import { GET as followStatus, POST as follow, DELETE as unfollow } from '@/app/api/users/[userId]/follow/route';
const context = { params: Promise.resolve({ userId: 'target' }) };
const request = (query = '', method = 'GET', body?: string) => new NextRequest('http://localhost/api/users/target' + query, { method, ...(body ? { body, headers: { 'Content-Type': 'application/json' } } : {}) });
const time = new Date('2026-09-23T10:00:00Z');
const person = () => ({ id: 'target', name: 'Profile fixture', email: 'qa@example.invalid', emailDisplayMode: 'HIDE', image: null, banner: null, bio: null, createdAt: time, role: 'USER', reachLifetime: 10, reachMomentum: 2, _count: { followers: 2, following: 1, Conversation: 8 } });
const relation = (id: string) => ({ id, followerId: 'person-' + id, followingId: 'target', createdAt: time, follower: { ...person(), id: 'person-' + id }, following: { ...person(), id: 'person-' + id } });
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: 'viewer', role: 'USER' }); mocks.limit.mockResolvedValue({ success: true }); mocks.user.mockResolvedValue(person());
  mocks.aggregate.mockResolvedValue({ _sum: { viewCount: 200, uniqueViewCount: 100, replyCount: 25 }, _avg: { pillarVisibility: 25.4, pillarEngagement: 35.6, pillarConversion: 20, pillarLoyalty: 0, pillarGrowth: 0, pillarRecall: 0, pillarVelocity: 0 } });
  mocks.followMany.mockResolvedValue([]); mocks.followFirst.mockResolvedValue(null); mocks.followOne.mockResolvedValue(null); mocks.count.mockResolvedValue(0);
});
describe('profile data and writes', () => {
  it('requires an authenticated profile reader and never creates an absent account', async () => {
    mocks.auth.mockResolvedValue(null); expect((await profile(request(), context)).status).toBe(401); expect(mocks.user).not.toHaveBeenCalled();
    mocks.auth.mockResolvedValue({ id: 'target', role: 'USER' }); mocks.user.mockResolvedValue(null);
    expect((await profile(request(), context)).status).toBe(404); expect(mocks.update).not.toHaveBeenCalled();
  });
  it('aggregates public data in SQL and respects hidden email for another viewer', async () => {
    const response = await profile(request(), context), result = (await response.json()).user;
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store'); expect(result).not.toHaveProperty('email');
    // Prisma's legacy relation names are inverted; the DTO is viewer-facing.
    expect(result._count).toEqual({ followers: 1, following: 2, posts: 8 }); expect(result.reach).toMatchObject({ totalViews: 200, uniqueViewers: 100, totalReplies: 25, engagementRate: 25, visibility: 25, engagementDepth: 36 });
    expect(mocks.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'target', visibility: 'PUBLIC' }, _sum: expect.any(Object), _avg: expect.any(Object) }));
    const selection = mocks.user.mock.calls[0][0].select; expect(selection).not.toHaveProperty('Conversation'); expect(selection).not.toHaveProperty('followers'); expect(selection._count).toBeDefined();
  });
  it('allows own email, handles empty aggregates and caps percentages', async () => {
    mocks.auth.mockResolvedValue({ id: 'target', role: 'USER' }); mocks.aggregate.mockResolvedValue({ _sum: { viewCount: null, uniqueViewCount: 1, replyCount: 9 }, _avg: {} });
    const data = (await (await profile(request(), context)).json()).user;
    expect(data.email).toBe('qa@example.invalid'); expect(data.reach.totalViews).toBe(0); expect(data.reach.engagementRate).toBe(100); expect(data.reach.trueReachScore).toBe(0);
  });
  it('denies foreign and demo writes, validates JSON and fields', async () => {
    expect((await PATCH(request('', 'PATCH', '{"name":"changed"}'), context)).status).toBe(403);
    mocks.auth.mockResolvedValue({ id: 'demo_fixture', role: 'USER' });
    expect((await PATCH(request('', 'PATCH', '{"name":"changed"}'), { params: Promise.resolve({ userId: 'demo_fixture' }) })).status).toBe(403);
    mocks.auth.mockResolvedValue({ id: 'target', role: 'USER' });
    for (const body of ['{', '{}', '{"role":"ADMIN"}', '{"bio":' + JSON.stringify('x'.repeat(2001)) + '}']) expect((await PATCH(request('', 'PATCH', body), context)).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('updates only validated own fields and preserves the API contract', async () => {
    mocks.auth.mockResolvedValue({ id: 'target', role: 'USER' }); mocks.update.mockResolvedValue(person());
    const response = await PATCH(request('', 'PATCH', '{"bio":"Updated QA bio"}'), context);
    expect(response.status).toBe(200); expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'target' }, data: { bio: 'Updated QA bio' } }));
  });
});
describe('connection lists and follow boundaries', () => {
  it.each(['?limit=0', '?limit=-1', '?limit=101', '?limit=nope', '?cursor='])('rejects invalid pagination %s', async query => {
    expect((await followers(request(query), context)).status).toBe(400); expect((await following(request(query), context)).status).toBe(400); expect(mocks.followMany).not.toHaveBeenCalled();
  });
  it('uses lookahead and a last-returned cursor, stable ordering and hidden-email protection', async () => {
    for (const route of [followers, following]) {
      mocks.followMany.mockResolvedValueOnce([relation('c'), relation('b'), relation('a')]).mockResolvedValueOnce([]); mocks.count.mockResolvedValue(3);
      const response = await route(request('?limit=2'), context), data = await response.json();
      expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store'); expect(data.nextCursor).toBe('b'); expect(data.users.map((user: { id: string }) => user.id)).toEqual(['person-c', 'person-b']); expect(data.users.every((user: { email: string | null }) => user.email === null)).toBe(true);
      expect(data.users[0]).toMatchObject({ followerCount: 1, followingCount: 2 });
    }
    expect(mocks.followMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }));
  });
  it('rejects another connection list cursor before reading a page', async () => {
    expect((await followers(request('?cursor=foreign'), context)).status).toBe(400); expect((await following(request('?cursor=foreign'), context)).status).toBe(400); expect(mocks.followMany).not.toHaveBeenCalled();
    expect(mocks.followFirst).toHaveBeenCalledWith({ where: { id: 'foreign', followingId: 'target' }, select: { id: true, createdAt: true } });
    expect(mocks.followFirst).toHaveBeenCalledWith({ where: { id: 'foreign', followerId: 'target' }, select: { id: true, createdAt: true } });
  });
  it('blocks demo follow/unfollow even without the request proxy', async () => {
    mocks.auth.mockResolvedValue({ id: 'demo_fixture', role: 'USER' });
    expect((await follow(request('', 'POST'), context)).status).toBe(403); expect((await unfollow(request('', 'DELETE'), context)).status).toBe(403); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('rate limits profile reads, writes, follow status and lists before DB access', async () => {
    mocks.limit.mockResolvedValue({ success: false }); mocks.auth.mockResolvedValue({ id: 'target', role: 'USER' });
    for (const response of [await profile(request(), context), await PATCH(request('', 'PATCH', '{"bio":"test"}'), context), await followStatus(request(), context), await followers(request(), context), await following(request(), context)]) expect(response.status).toBe(429);
    expect(mocks.user).not.toHaveBeenCalled(); expect(mocks.followMany).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
});
