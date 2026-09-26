/** @fileOverview Message mutation authorization, retries and persistence regressions. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), burst: vi.fn(), durable: vi.fn(), publish: vi.fn(), tx: {
  $queryRaw: vi.fn(), user: { findUnique: vi.fn() }, conversation: { findUnique: vi.fn(), update: vi.fn() },
  message: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), count: vi.fn() },
} }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ dbPrisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(mocks.tx) } }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: mocks.session }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.burst }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowMessageWrite: mocks.durable }));
vi.mock('@/lib/pusher', () => ({ pusherServer: { trigger: mocks.publish } }));
import { writeMessage } from './message-writes';
const conversation = { id: 'thread', userId: 'creator', participants: ['member'], visibility: 'PARTICIPANTS', type: 'GROUP', replyPermission: 'EVERYONE', allowedRoles: [], customViewers: [], visibleToUserIds: [], isLocked: false, replyCount: 1, deletionScheduledFor: null };
const actor = { id: 'member', role: 'USER', tokenVersion: 2 };
const original = { id: 'message', content: 'hello', senderId: 'member', conversationId: 'thread', imageUrl: null, parentId: null, createdAt: new Date(), editedAt: null, User: { id: 'member', name: 'QA', image: null } };
const request = (body: unknown = { conversationId: 'thread', content: 'hello' }, method = 'POST', origin = 'http://localhost:3000') => new Request('http://localhost:3000/api/messages', { method, headers: { origin, 'content-type': 'application/json' }, ...(method !== 'DELETE' ? { body: JSON.stringify(body) } : {}) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ ...actor, sessionVersion: 2 });
  mocks.tx.user.findUnique.mockResolvedValue(actor);
  mocks.burst.mockResolvedValue({ success: true }); mocks.durable.mockResolvedValue(true);
  mocks.tx.conversation.findUnique.mockResolvedValue(conversation);
  mocks.tx.message.findUnique.mockResolvedValue(null);
  mocks.tx.message.count.mockResolvedValue(0);
  mocks.tx.message.create.mockImplementation(async ({ data }) => ({ ...original, ...data }));
  mocks.tx.message.update.mockResolvedValue({ ...original, content: 'changed', editedAt: new Date() });
  mocks.publish.mockResolvedValue({});
});
it('requires authenticated, current, non-demo, non-impersonated sessions', async () => {
  for (const session of [null, { id: 'member', isDemo: true }, { id: 'member', isImpersonating: true }, { id: 'member', sessionVersion: 1 }, { id: 'member' }]) {
    mocks.session.mockResolvedValue(session);
    expect([401, 403]).toContain((await writeMessage(request(), 'create')).status);
  }
  expect(mocks.tx.message.create).not.toHaveBeenCalled();
});
it('rejects missing and cross-site origins before any database write', async () => {
  expect((await writeMessage(request(undefined, 'POST', ''), 'create')).status).toBe(403);
  expect((await writeMessage(request(undefined, 'POST', 'https://evil.example'), 'create')).status).toBe(403);
  expect(mocks.tx.user.findUnique).not.toHaveBeenCalled();
});
it('checks both burst and durable rate limits', async () => {
  mocks.burst.mockResolvedValueOnce({ success: false });
  expect((await writeMessage(request(), 'create')).status).toBe(429);
  mocks.durable.mockResolvedValueOnce(false);
  expect((await writeMessage(request(), 'create')).status).toBe(429);
  expect(mocks.tx.message.create).not.toHaveBeenCalled();
});
it('rejects empty, oversized, spoofed-sender and invalid attachment bodies', async () => {
  for (const body of [{ content: '' }, { content: ' '.repeat(33000) }, { content: 'hello', senderId: 'creator' }, { content: 'hi', imageUrl: 'http://files.edgestore.dev/x' }, { content: 'hi', imageUrl: 'https://evil.example/x' }]) {
    expect([400, 413]).toContain((await writeMessage(request({ conversationId: 'thread', ...body }), 'create')).status);
  }
  expect(mocks.tx.message.create).not.toHaveBeenCalled();
});
it('requires read access even when replies are EVERYONE', async () => {
  mocks.tx.user.findUnique.mockResolvedValue({ ...actor, id: 'outsider' });
  expect((await writeMessage(request(), 'create')).status).toBe(404);
  expect(mocks.tx.message.create).not.toHaveBeenCalled();
});
it('honors current role, locks, reply rules and scheduled deletion', async () => {
  for (const [change, status] of [[{ isLocked: true }, 403], [{ replyPermission: 'CREATOR_ONLY' }, 403], [{ deletionScheduledFor: new Date() }, 409], [{ deletionVisibility: 'PRIVATE', deletionRequestedAt: new Date() }, 404]] as const) {
    mocks.tx.conversation.findUnique.mockResolvedValue({ ...conversation, ...change });
    expect((await writeMessage(request(), 'create')).status).toBe(status);
  }
  expect(mocks.tx.message.create).not.toHaveBeenCalled();
});
it('rejects replies to missing or other-conversation messages', async () => {
  for (const parent of [null, { conversationId: 'someone-elses-thread' }]) {
    mocks.tx.message.findUnique.mockResolvedValue(parent);
    expect((await writeMessage(request({ conversationId: 'thread', content: 'hello', parentId: 'parent' }), 'create')).status).toBe(400);
  }
  expect(mocks.tx.message.create).not.toHaveBeenCalled();
});
it('blocks new public-storage attachments in private chats, including edits', async () => {
  const imageUrl = 'https://files.edgestore.dev/example.png';
  expect((await writeMessage(request({ conversationId: 'thread', content: 'hello', imageUrl }), 'create')).status).toBe(400);
  mocks.tx.message.findUnique.mockResolvedValue(original);
  expect((await writeMessage(request({ imageUrl }, 'PATCH'), 'edit', 'message')).status).toBe(400);
  expect(mocks.tx.message.create).not.toHaveBeenCalled(); expect(mocks.tx.message.update).not.toHaveBeenCalled();
});
it('creates once, returns a DTO and atomically increments counters', async () => {
  const response = await writeMessage(request(), 'create');
  expect(response.status).toBe(201); expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect((await response.json()).senderId).toBe('member');
  expect(mocks.tx.conversation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ replyCount: { increment: 1 }, uniqueRepliers: { increment: 1 } }) }));
});
it('reuses a request identity without another message or counter increment', async () => {
  const body = { conversationId: 'thread', content: 'hello', requestId: '894f7818-32bd-411b-95d6-3cfc4c260015' };
  await writeMessage(request(body), 'create');
  const saved = { ...original, id: mocks.tx.message.create.mock.calls[0][0].data.id };
  mocks.tx.message.findUnique.mockResolvedValue(saved);
  expect((await writeMessage(request(body), 'create')).status).toBe(200);
  expect(mocks.tx.message.create).toHaveBeenCalledTimes(1); expect(mocks.tx.conversation.update).toHaveBeenCalledTimes(1);
  expect((await writeMessage(request({ ...body, content: 'different' }), 'create')).status).toBe(409);
});
it('reports committed success when realtime fails', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  mocks.publish.mockRejectedValue(new Error('provider outage'));
  expect((await writeMessage(request(), 'create')).status).toBe(201);
  expect(mocks.tx.message.create).toHaveBeenCalledTimes(1); warning.mockRestore();
});
it.each(['edit', 'delete'] as const)('denies %s of another member’s message', async operation => {
  mocks.tx.message.findUnique.mockResolvedValue({ ...original, senderId: 'other' });
  expect((await writeMessage(request({ content: 'changed' }, operation === 'edit' ? 'PATCH' : 'DELETE'), operation, 'message')).status).toBe(403);
  expect(mocks.tx.message.update).not.toHaveBeenCalled(); expect(mocks.tx.message.delete).not.toHaveBeenCalled();
});
it('edits own message but cannot move it or turn it empty', async () => {
  mocks.tx.message.findUnique.mockResolvedValue(original);
  expect((await writeMessage(request({ content: 'changed' }, 'PATCH'), 'edit', 'message')).status).toBe(200);
  for (const body of [{ content: '' }, { content: 'changed', parentId: 'other' }, { content: 'changed', conversationId: 'other' }]) expect((await writeMessage(request(body, 'PATCH'), 'edit', 'message')).status).toBe(400);
  expect(mocks.tx.message.update).toHaveBeenCalledTimes(1);
});
it('deletes own reply and floors counters at zero', async () => {
  mocks.tx.message.findUnique.mockResolvedValue({ ...original, parentId: 'parent' });
  mocks.tx.conversation.findUnique.mockResolvedValue({ ...conversation, replyCount: 0 });
  expect((await writeMessage(request({}, 'DELETE'), 'delete', 'message')).status).toBe(200);
  expect(mocks.tx.conversation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ replyCount: 0 }) }));
  expect(mocks.tx.message.updateMany).toHaveBeenCalledWith({ where: { id: 'parent', conversationId: 'thread', replyCount: { gt: 0 } }, data: { replyCount: { decrement: 1 } } });
});
it('fails closed with a generic private error on database outage', async () => {
  mocks.tx.user.findUnique.mockRejectedValue(new Error('sensitive database detail'));
  const response = await writeMessage(request(), 'create');
  expect(response.status).toBe(503); expect(await response.text()).not.toContain('sensitive');
  expect(mocks.publish).not.toHaveBeenCalled();
});
