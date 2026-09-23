/** @fileOverview Notification isolation, pagination, mutation and rate-limit regressions. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { notification: mocks } }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.limit, getClientIdentifier: () => 'test', rateLimitedResponse: () => new Response(null, { status: 429 }) }));
import { GET, POST } from '@/app/api/notifications/route';
import { GET as one, PATCH, DELETE } from '@/app/api/notifications/[id]/route';
import { POST as all } from '@/app/api/notifications/mark-all-read/route';
const context = { params: Promise.resolve({ id: 'private-alert' }) };
const request = (path = '', method = 'GET', body?: object) => new Request('http://localhost/api/notifications' + path, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { id: 'qa-user', role: 'USER' } }); mocks.limit.mockResolvedValue({ success: true });
  mocks.findMany.mockResolvedValue([]); mocks.count.mockResolvedValue(0); mocks.update.mockResolvedValue({ id: 'private-alert' });
});
describe('private inbox', () => {
  it('requires a session for every endpoint', async () => {
    mocks.auth.mockResolvedValue(null);
    for (const response of [await GET(request()), await POST(request('', 'POST')), await one(request(), context), await PATCH(request('', 'PATCH'), context), await DELETE(request('', 'DELETE'), context), await all(request('', 'POST'))]) expect(response.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it.each(['limit=0', 'limit=-1', 'limit=101', 'limit=nope', 'limit=1.5', 'unread=yes', 'archived=1'])('rejects invalid %s', async query => {
    expect((await GET(request('?' + query))).status).toBe(400); expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it('honors archived and unread filters, excludes expired rows, and never caches private data', async () => {
    const response = await GET(request('?archived=true&unread=true'));
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'qa-user', isArchived: true, isRead: false, AND: expect.any(Array) }), take: 51 }));
    expect(mocks.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'qa-user', isArchived: false, isRead: false }) }));
  });
  it('uses the last returned row as the cursor, never the popped lookahead row', async () => {
    mocks.findMany.mockResolvedValue([{ id: 'z' }, { id: 'a' }, { id: 'b' }]);
    const data = await (await GET(request('?limit=2'))).json();
    expect(data.notifications.map((row: { id: string }) => row.id)).toEqual(['z', 'a']); expect(data.nextCursor).toBe('a');
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }));
  });
  it('keysets by time plus id and denies a foreign or missing anchor', async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect((await GET(request('?cursor=foreign'))).status).toBe(400); expect(mocks.findMany).not.toHaveBeenCalled();
    const time = new Date(); mocks.findFirst.mockResolvedValue({ id: 'anchor', createdAt: time });
    expect((await GET(request('?cursor=anchor'))).status).toBe(200);
    expect(mocks.findFirst).toHaveBeenLastCalledWith({ where: { id: 'anchor', userId: 'qa-user' }, select: { id: true, createdAt: true } });
    expect(mocks.findMany.mock.calls[0][0].where.AND[1]).toEqual({ OR: [{ createdAt: { lt: time } }, { createdAt: time, id: { lt: 'anchor' } }] });
  });
  it('blocks forged system notifications from ordinary users before any database access', async () => {
    expect((await POST(request('', 'POST', { userId: 'victim', type: 'SYSTEM', title: 'fake', message: 'fake' }))).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('requires ownership for reads, patches and deletes without revealing whether another user owns the id', async () => {
    mocks.findFirst.mockResolvedValue(null); mocks.deleteMany.mockResolvedValue({ count: 0 });
    expect((await one(request(), context)).status).toBe(404);
    expect((await PATCH(request('', 'PATCH', { isRead: true }), context)).status).toBe(404);
    expect((await DELETE(request('', 'DELETE'), context)).status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: 'private-alert', userId: 'qa-user' } });
  });
  it('only accepts explicit state fields and handles malformed JSON', async () => {
    for (const body of [{}, { userId: 'victim' }, { isRead: 'yes' }]) expect((await PATCH(request('', 'PATCH', body), context)).status).toBe(400);
    expect((await PATCH(new Request('http://localhost/api/notifications/id', { method: 'PATCH', body: '{' }), context)).status).toBe(400);
  });
  it('preserves the original read time on replay and clears it when marking unread', async () => {
    const readAt = new Date('2026-01-01'); mocks.findFirst.mockResolvedValue({ isRead: true, readAt });
    await PATCH(request('', 'PATCH', { isRead: true }), context);
    expect(mocks.update).toHaveBeenLastCalledWith({ where: { id: 'private-alert', userId: 'qa-user' }, data: { isRead: true, readAt } });
    await PATCH(request('', 'PATCH', { isRead: false, isArchived: true }), context);
    expect(mocks.update).toHaveBeenLastCalledWith({ where: { id: 'private-alert', userId: 'qa-user' }, data: { isRead: false, readAt: null, isArchived: true } });
  });
  it('keeps demo notifications read-only even without the proxy', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'demo_isolated', role: 'USER' } });
    expect((await PATCH(request('', 'PATCH', { isRead: true }), context)).status).toBe(403);
    expect((await DELETE(request('', 'DELETE'), context)).status).toBe(403);
    expect((await all(request('', 'POST'))).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it('marks only the current user active inbox read', async () => {
    expect((await all(request('', 'POST'))).status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'qa-user', isRead: false, isArchived: false, OR: expect.any(Array) }) }));
  });
  it('rate limits list and mutations', async () => {
    mocks.limit.mockResolvedValue({ success: false });
    for (const response of [await GET(request()), await PATCH(request('', 'PATCH', { isRead: true }), context), await DELETE(request('', 'DELETE'), context), await all(request('', 'POST'))]) expect(response.status).toBe(429);
    expect(mocks.findMany).not.toHaveBeenCalled(); expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
