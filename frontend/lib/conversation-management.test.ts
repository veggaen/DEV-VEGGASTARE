import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), burst: vi.fn(), durable: vi.fn(), publish: vi.fn(), tx: {
  $queryRaw: vi.fn(), user: { findUnique: vi.fn() },
  conversation: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
} }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ dbPrisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(mocks.tx) } }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: mocks.session }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.burst }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowConversationManagement: mocks.durable }));
vi.mock('@/lib/pusher', () => ({ pusherServer: { trigger: mocks.publish } }));
import { readManagedConversation as read, updateManagedConversation as patch, deleteManagedConversation as remove } from './conversation-management';

const actor = { id: 'creator', role: 'USER', tokenVersion: 4 };
const baseline = {
  id: 'thread', userId: actor.id, title: 'Private title', description: 'Draft', participants: ['creator', 'peer'],
  type: 'GROUP', visibility: 'PARTICIPANTS', replyPermission: 'PARTICIPANTS', isLocked: false, isPinned: false,
  allowedRoles: [], customViewers: [], visibleToUserIds: [], tags: [], isAnonymized: false,
  createdAt: new Date(Date.now() - 86_400_000), updatedAt: new Date(), lastActivityAt: new Date(),
  deletionRequestedAt: null, deletionScheduledFor: null, deletionVisibility: 'PRIVATE', originalUserId: null,
  viewCount: 0, replyCount: 0, uniqueRepliers: 0,
  User: { id: actor.id, name: 'Creator', email: 'private@example.invalid', emailDisplayMode: 'HIDE', image: null },
};
const context = { params: Promise.resolve({ id: 'thread' }) };
const request = (method = 'PATCH', body: unknown = { title: 'Updated' }, query = '', origin = 'https://veggat.test') => new Request(`https://veggat.test/api/conversations/thread${query}`, {
  method, headers: { Origin: origin, 'content-type': 'application/json' }, ...(method === 'PATCH' ? { body: JSON.stringify(body) } : {}),
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ ...actor, sessionVersion: 4 }); mocks.burst.mockResolvedValue({ success: true }); mocks.durable.mockResolvedValue(true);
  mocks.tx.user.findUnique.mockResolvedValue(actor); mocks.tx.conversation.findUnique.mockResolvedValue(baseline);
  mocks.tx.conversation.update.mockImplementation(async ({ data }) => ({ ...baseline, ...data }));
});
it.each([read, patch, remove])('requires authentication for each management operation', async handler => {
  mocks.session.mockResolvedValue(null); expect((await handler(request(), context)).status).toBe(401);
  expect(mocks.tx.$queryRaw).not.toHaveBeenCalled();
});
it.each([patch, remove])('rejects missing/foreign origins and read-only sessions before database writes', async handler => {
  for (const origin of ['', 'https://foreign.test']) expect((await handler(request('DELETE', undefined, '', origin), context)).status).toBe(403);
  for (const override of [{ isDemo: true }, { isImpersonating: true }]) {
    mocks.session.mockResolvedValue({ ...actor, sessionVersion: 4, ...override });
    expect((await handler(request('DELETE'), context)).status).toBe(403);
  }
  expect(mocks.tx.$queryRaw).not.toHaveBeenCalled();
});
it.each([patch, remove])('fails closed for durable limits and bursts', async handler => {
  mocks.durable.mockResolvedValue(false); expect((await handler(request(), context)).status).toBe(429);
  mocks.burst.mockResolvedValue({ success: false }); mocks.durable.mockClear();
  expect((await handler(request(), context)).status).toBe(429); expect(mocks.durable).not.toHaveBeenCalled();
});
it.each([read, patch, remove])('checks token version and present identity before access', async handler => {
  for (const identity of [null, { ...actor, tokenVersion: 5 }]) {
    mocks.tx.user.findUnique.mockResolvedValue(identity); expect((await handler(request(), context)).status).toBe(401);
  }
  expect(mocks.tx.conversation.findUnique).not.toHaveBeenCalled();
});
it.each([read, patch, remove])('rejects non-owner participants without disclosing a record', async handler => {
  // Stale elevated JWT role must not override the current database role.
  mocks.session.mockResolvedValue({ id: 'peer', role: 'OWNER', sessionVersion: 4 });
  mocks.tx.user.findUnique.mockResolvedValue({ ...actor, id: 'peer' });
  expect((await handler(request(), context)).status).toBe(404);
  expect(mocks.tx.conversation.update).not.toHaveBeenCalled(); expect(mocks.tx.conversation.delete).not.toHaveBeenCalled();
});
it('reads only the allowlisted DTO and keeps responses private', async () => {
  mocks.tx.conversation.findUnique.mockResolvedValue({ ...baseline, databaseSecret: 'never expose' });
  const response = await read(request('GET'), context);
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
  const body = await response.json(); expect(body.databaseSecret).toBeUndefined();
  expect(body.title).toBe(baseline.title); expect(mocks.durable).not.toHaveBeenCalled();
});
it.each([{ userId: 'peer' }, { participants: ['stranger'] }, { title: 'x'.repeat(201) }, {}, { tags: [''] }])('rejects invalid/unknown changes %j', async body => {
  expect((await patch(request('PATCH', body), context)).status).toBe(400);
  expect(mocks.tx.conversation.update).not.toHaveBeenCalled();
});
it('bounds the request stream and enforces valid JSON', async () => {
  expect((await patch(request('PATCH', { title: 'x'.repeat(33000) }), context)).status).toBe(413);
  const bad = request(); bad.headers.set('content-type', 'text/plain');
  expect((await patch(bad, context)).status).toBe(415);
  expect((await patch(new Request('https://veggat.test/api/conversations/thread', { method: 'PATCH', headers: { Origin: 'https://veggat.test', 'content-type': 'application/json' }, body: '{' }), context)).status).toBe(400);
});
it.each(['PRIVATE_DM', 'GROUP'])('never widens %s access, even for an administrator', async type => {
  mocks.tx.user.findUnique.mockResolvedValue({ ...actor, role: 'ADMIN' });
  mocks.tx.conversation.findUnique.mockResolvedValue({ ...baseline, type });
  for (const body of [{ visibility: 'PUBLIC' }, { visibility: 'CUSTOM' }, { customViewers: ['stranger'] }, { visibleToUserIds: ['stranger'] }, { visibleToGroupIds: ['stranger'] }]) expect((await patch(request('PATCH', body), context)).status).toBe(400);
  expect(mocks.tx.conversation.update).not.toHaveBeenCalled();
});
it.each([{ isPinned: true }, { isLocked: false }])('denies moderator-only edits %j', async body => {
  expect((await patch(request('PATCH', body), context)).status).toBe(403);
});
it('uses current administrator permissions, not stale JWT roles', async () => {
  mocks.tx.user.findUnique.mockResolvedValue({ ...actor, id: 'moderator', role: 'OWNER' });
  expect((await patch(request('PATCH', { isLocked: true }), context)).status).toBe(200);
  expect(mocks.tx.conversation.update.mock.calls[0][0].data.isLocked).toBe(true);
});
it('locks identity then conversation, clears nullable fields and validates before committing', async () => {
  const response = await patch(request('PATCH', { title: null, description: null }), context);
  expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ title: null, description: null });
  expect(mocks.tx.$queryRaw.mock.calls.map(call => call[0].join('?'))).toEqual([
    'SELECT "id" FROM "User" WHERE "id" = ? FOR SHARE', 'SELECT "id" FROM "Conversation" WHERE "id" = ? FOR UPDATE',
  ]);
  expect(mocks.publish).toHaveBeenCalledWith('ConversationChannel_thread', 'conversation-updated', {});
  mocks.tx.conversation.update.mockResolvedValue({ ...baseline, User: null });
  expect((await patch(request(), context)).status).toBe(503);
});
it('allows public-thread visibility edits but blocks changes during pending deletion', async () => {
  mocks.tx.conversation.findUnique.mockResolvedValue({ ...baseline, type: 'PUBLIC_THREAD', visibility: 'PUBLIC' });
  expect((await patch(request('PATCH', { visibility: 'PRIVATE' }), context)).status).toBe(200);
  mocks.tx.conversation.findUnique.mockResolvedValue({ ...baseline, deletionScheduledFor: new Date() });
  expect((await patch(request(), context)).status).toBe(409);
});
it.each(['?force=garbage', '?cancel=garbage', '?force=true&cancel=true', '?force=true&force=false', '?unexpected=true'])('rejects ambiguous delete options %s', async query => {
  expect((await remove(request('DELETE', undefined, query), context)).status).toBe(400);
});
it('requires current administrator privileges to force deletion', async () => {
  expect((await remove(request('DELETE', undefined, '?force=true'), context)).status).toBe(403);
  mocks.tx.user.findUnique.mockResolvedValue({ ...actor, role: 'ADMIN' });
  expect((await remove(request('DELETE', undefined, '?force=true'), context)).status).toBe(200);
  expect(mocks.tx.conversation.delete).toHaveBeenCalledTimes(1);
});
it('deletes low-reach content and permits harmless replay after a lost response', async () => {
  expect((await remove(request('DELETE'), context)).status).toBe(200);
  mocks.tx.conversation.findUnique.mockResolvedValue(null);
  expect(await (await remove(request('DELETE'), context)).json()).toMatchObject({ deleted: true });
  expect(mocks.tx.conversation.delete).toHaveBeenCalledTimes(1);
});
it('preserves a scheduled deletion date across repeated requests', async () => {
  mocks.tx.conversation.findUnique.mockResolvedValue({ ...baseline, replyCount: 11 });
  const first = await remove(request('DELETE', undefined, '?visibility=PUBLIC'), context);
  expect(first.status).toBe(200); const scheduled = await first.json(); expect(scheduled.visibility).toBe('PRIVATE');
  mocks.tx.conversation.findUnique.mockResolvedValue({ ...baseline, replyCount: 11, deletionRequestedAt: new Date(), deletionScheduledFor: new Date(scheduled.deletionScheduledFor), isAnonymized: true });
  expect((await (await remove(request('DELETE'), context)).json()).deletionScheduledFor).toBe(scheduled.deletionScheduledFor);
  expect(mocks.tx.conversation.update).toHaveBeenCalledTimes(1);
});
it('allows the original creator to cancel and makes cancellation replay harmless', async () => {
  mocks.tx.conversation.findUnique.mockResolvedValue({ ...baseline, userId: 'anonymized', originalUserId: actor.id, deletionRequestedAt: new Date(), deletionScheduledFor: new Date(Date.now() + 60000) });
  expect((await remove(request('DELETE', undefined, '?cancel=true'), context)).status).toBe(200);
  expect(mocks.tx.conversation.update.mock.calls[0][0].data).toMatchObject({ userId: actor.id, originalUserId: null, deletionScheduledFor: null });
  mocks.tx.conversation.findUnique.mockResolvedValue(baseline);
  expect((await remove(request('DELETE', undefined, '?cancel=true'), context)).status).toBe(200);
  expect(mocks.tx.conversation.update).toHaveBeenCalledTimes(1);
});
it('does not restore an expired cancellation window', async () => {
  mocks.tx.conversation.findUnique.mockResolvedValue({ ...baseline, deletionRequestedAt: new Date(), deletionScheduledFor: new Date(Date.now() - 1000) });
  expect((await remove(request('DELETE', undefined, '?cancel=true'), context)).status).toBe(409);
});
it('does not turn a realtime outage into a failed committed write or expose internal errors', async () => {
  mocks.publish.mockRejectedValue(new Error('secret provider details'));
  expect((await patch(request(), context)).status).toBe(200);
  mocks.tx.conversation.update.mockRejectedValue(new Error('secret database details'));
  const response = await patch(request(), context); expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret');
});
