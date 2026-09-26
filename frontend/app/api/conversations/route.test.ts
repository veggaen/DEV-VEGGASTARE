/** @fileOverview List query privacy and inbox-preview regression checks. @stability active */
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { conversation: { findMany: m.list } } }));
vi.mock('@/lib/pusher', () => ({ pusherServer: {} }));
vi.mock('@/data/user', () => ({ fetchUserManyDetails: vi.fn() }));
import { GET } from './route';
const get = (query: string) => GET(new Request(`http://localhost:3000/api/conversations?${query}`));
beforeEach(() => { vi.resetAllMocks(); m.auth.mockResolvedValue({ id: 'viewer', role: 'USER' }); m.list.mockResolvedValue([]); });
it.each(['created', 'participated'])('rejects %s without a profile instead of listing all private chats', async filter => {
  expect((await get(`filter=${filter}`)).status).toBe(400); expect(m.list).not.toHaveBeenCalled();
});
it.each(['private', 'mine', 'all'])('rejects conflicting profile and %s scope', async filter => {
  expect((await get(`filter=${filter}&creatorId=someone`)).status).toBe(400); expect(m.list).not.toHaveBeenCalled();
});
it('requires authentication for an explicit inbox request', async () => {
  m.auth.mockResolvedValue(null); expect((await get('filter=private')).status).toBe(401); expect(m.list).not.toHaveBeenCalled();
});
it.each(['created', 'participated', 'public'])('limits %s profile results to public data', async filter => {
  expect((await get(`filter=${filter}&creatorId=someone`)).status).toBe(200); expect(m.list.mock.calls[0][0].where.visibility).toBe('PUBLIC');
});
it('scopes inbox to membership and returns newest message, bounded pages and stable order', async () => {
  const response = await get('filter=private&sort=active&limit=50&cursor=previous');
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(m.list.mock.calls[0][0]).toMatchObject({
    where: { AND: [{ OR: [{ userId: 'viewer' }, { participants: { has: 'viewer' } }] }, { type: { not: 'PUBLIC_THREAD' } }] },
    include: { Message: { take: 1, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] } },
    orderBy: [{ pinnedToFeed: 'desc' }, { isPinned: 'desc' }, { lastActivityAt: 'desc' }, { id: 'desc' }],
    take: 50, cursor: { id: 'previous' }, skip: 1,
  });
});
it('keeps Pulse original-post ordering unchanged', async () => {
  expect((await get('filter=public')).status).toBe(200); expect(m.list.mock.calls[0][0].include.Message.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
});
it('never gives ordinary all-filter viewers an unrestricted query', async () => {
  expect((await get('filter=all')).status).toBe(200); expect(m.list.mock.calls[0][0].where.OR).toEqual(expect.arrayContaining([{ visibility: 'PUBLIC' }, { userId: 'viewer' }, { participants: { has: 'viewer' } }]));
  expect(m.list.mock.calls[0][0].where).not.toEqual({});
});
it('preserves existing administrator all-filter access', async () => {
  m.auth.mockResolvedValue({ id: 'owner', role: 'OWNER' }); expect((await get('filter=all')).status).toBe(200); expect(m.list.mock.calls[0][0].where).toEqual({});
});
it('guests see only public conversations by default', async () => {
  m.auth.mockResolvedValue(null); expect((await get('')).status).toBe(200); expect(m.list.mock.calls[0][0].where).toEqual({ visibility: 'PUBLIC' });
});
it.each(['limit=101', 'filter=unknown', 'sort=unread'])('rejects invalid query %s before the database', async query => {
  expect((await get(query)).status).toBe(400); expect(m.list).not.toHaveBeenCalled();
});
