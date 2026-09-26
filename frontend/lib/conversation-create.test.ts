import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), burst: vi.fn(), durable: vi.fn(), publish: vi.fn(), tx: {
  $queryRaw: vi.fn(), $executeRaw: vi.fn(), user: { findUnique: vi.fn(), findMany: vi.fn() },
  conversation: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  message: { findUnique: vi.fn(), create: vi.fn(), count: vi.fn() },
} }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ dbPrisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(mocks.tx) } }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: mocks.session }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.burst }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowConversationCreate: mocks.durable }));
vi.mock('@/lib/pusher', () => ({ pusherServer: { trigger: mocks.publish } }));
import { createConversation } from './conversation-create';

const actor = { id: 'actor', role: 'USER', tokenVersion: 3 };
const peer = { id: 'peer', name: 'Peer', email: 'private@example.com', emailDisplayMode: 'HIDDEN' };
const baseline = { id: 'thread', title: 'Hello', description: null, userId: actor.id, participants: ['actor', 'peer'],
  type: 'PRIVATE_DM', visibility: 'PARTICIPANTS', replyPermission: 'PARTICIPANTS', isLocked: false, isPinned: false,
  allowedRoles: [], customViewers: [], visibleToUserIds: [], tags: [], isAnonymized: false,
  createdAt: new Date(), updatedAt: new Date(), lastActivityAt: new Date(), deletionRequestedAt: null, deletionScheduledFor: null,
  User: { id: actor.id, name: 'Actor', email: null, image: null, emailDisplayMode: 'HIDDEN' } };
const input = { participants: ['peer'], initialMessage: 'Hello', requestId: 'a632dd01-5310-40cc-8cd1-615ac12a70a7' };
function request(body: unknown = input, origin = 'https://veggat.test', contentType = 'application/json') {
  return new Request('https://veggat.test/api/conversations', { method: 'POST', headers: { origin, 'content-type': contentType }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ ...actor, sessionVersion: 3 }); mocks.burst.mockResolvedValue({ success: true }); mocks.durable.mockResolvedValue(true);
  mocks.tx.user.findUnique.mockResolvedValue(actor); mocks.tx.user.findMany.mockResolvedValue([peer]);
  mocks.tx.conversation.findFirst.mockResolvedValue(null); mocks.tx.conversation.findUnique.mockResolvedValue(baseline);
  mocks.tx.conversation.create.mockImplementation(async ({ data }) => ({ ...baseline, ...data }));
  mocks.tx.message.findUnique.mockResolvedValue(null); mocks.tx.message.count.mockResolvedValue(0);
});
it.each([null, { ...actor, isDemo: true }, { ...actor, isImpersonating: true }])('denies unauthenticated or read-only session %j', async session => {
  mocks.session.mockResolvedValue(session);
  expect((await createConversation(request())).status).toBe(session ? 403 : 401);
  expect(mocks.tx.conversation.create).not.toHaveBeenCalled();
});
it.each(['', 'https://evil.example'])('requires the exact request origin (%s)', async origin => {
  expect((await createConversation(request(input, origin))).status).toBe(403);
  expect(mocks.tx.user.findUnique).not.toHaveBeenCalled();
});
it('uses independent burst and durable creation budgets', async () => {
  mocks.durable.mockResolvedValue(false);
  expect((await createConversation(request())).status).toBe(429);
  expect(mocks.tx.conversation.create).not.toHaveBeenCalled();
  mocks.burst.mockResolvedValue({ success: false }); mocks.durable.mockClear();
  expect((await createConversation(request())).status).toBe(429); expect(mocks.durable).not.toHaveBeenCalled();
});
it('rejects non-JSON, malformed JSON, and oversized streaming bodies', async () => {
  expect((await createConversation(request(input, 'https://veggat.test', 'text/plain'))).status).toBe(415);
  expect((await createConversation(new Request('https://veggat.test/api/conversations', { method: 'POST', headers: { origin: 'https://veggat.test', 'content-type': 'application/json' }, body: '{' }))).status).toBe(400);
  expect((await createConversation(request({ initialMessage: 'x'.repeat(33000) }))).status).toBe(413);
});
it.each([{ visibility: 'PUBLIC' }, { customViewers: ['stranger'] }, { participants: ['peer', 'third'] }, { type: 'GROUP', visibility: 'PUBLIC' }, { initialImageUrl: 'https://files.edgestore.dev/file.png' }, { userId: 'someone-else' }, { requestId: 'bad-id' }])('rejects invalid/private-scope changes %j', async change => {
  expect((await createConversation(request({ ...input, ...change }))).status).toBe(400);
  expect(mocks.tx.conversation.create).not.toHaveBeenCalled();
});
it.each([null, { ...actor, tokenVersion: 4 }])('checks the current identity under lock %j', async current => {
  mocks.tx.user.findUnique.mockResolvedValue(current);
  expect((await createConversation(request())).status).toBe(401);
  expect(mocks.tx.conversation.create).not.toHaveBeenCalled();
});
it('does not resolve private emails, including when the same user ID was also submitted', async () => {
  for (const participants of [[peer.email], [peer.id, peer.email]]) expect((await createConversation(request({ ...input, participants }))).status).toBe(400);
  const query = mocks.tx.user.findMany.mock.calls[0][0];
  expect(query.where.OR[0].OR[1].emailDisplayMode).toBe('PRIMARY');
});
it('allows a shared email but never silently discards missing recipients', async () => {
  mocks.tx.user.findMany.mockResolvedValue([{ ...peer, emailDisplayMode: 'PRIMARY' }]);
  expect((await createConversation(request({ ...input, participants: [peer.email] }))).status).toBe(201);
  expect((await createConversation(request({ ...input, participants: ['peer', 'unavailable'] }))).status).toBe(400);
});
it('creates the first message and counter in the same nested transaction write', async () => {
  const response = await createConversation(request());
  expect(response.status).toBe(201); expect(response.headers.get('cache-control')).toBe('private, no-store');
  const data = mocks.tx.conversation.create.mock.calls[0][0].data;
  expect(data).toMatchObject({ participants: ['actor', 'peer'], replyCount: 1, Message: { create: { senderId: actor.id, content: 'Hello' } } });
  expect(mocks.tx.message.create).not.toHaveBeenCalled(); expect(mocks.publish).not.toHaveBeenCalled();
  const locks = mocks.tx.$executeRaw.mock.calls.map(call => call.slice(1).join(' '));
  expect(locks.some(value => value.includes('dm-pair:["actor","peer"]'))).toBe(true);
});
it('replays a group creation without repeating writes and rejects a changed payload', async () => {
  const group = { ...input, type: 'GROUP', title: 'Our group' };
  const first = await createConversation(request(group));
  const created = { ...baseline, ...await first.json() };
  mocks.tx.conversation.findFirst.mockResolvedValue(created); mocks.tx.conversation.findUnique.mockResolvedValue(created);
  expect((await createConversation(request(group))).status).toBe(200);
  expect(mocks.tx.conversation.create).toHaveBeenCalledTimes(1);
  expect((await createConversation(request({ ...group, initialMessage: 'Changed' }))).status).toBe(409);
});
it('rechecks access and deletion state before returning a replay', async () => {
  const first = await createConversation(request()); const created = await first.json();
  mocks.tx.conversation.findFirst.mockResolvedValue(created);
  mocks.tx.conversation.findUnique.mockResolvedValue({ ...baseline, ...created, deletionScheduledFor: new Date() });
  expect((await createConversation(request())).status).toBe(404);
});
it('sends the first message to an existing exact-pair DM, only once on retry', async () => {
  mocks.tx.conversation.findFirst.mockImplementation(async ({ where }) => where.type ? { id: baseline.id } : null);
  expect((await createConversation(request())).status).toBe(200);
  const data = mocks.tx.message.create.mock.calls[0][0].data;
  expect(data).toMatchObject({ content: 'Hello', senderId: actor.id, conversationId: baseline.id });
  const pairQuery = mocks.tx.conversation.findFirst.mock.calls.find(call => call[0].where.type)![0].where;
  expect(pairQuery).toMatchObject({ visibility: 'PARTICIPANTS', deletionScheduledFor: null, OR: [{ participants: { equals: ['actor', 'peer'] } }, { participants: { equals: ['peer', 'actor'] } }] });
  mocks.tx.message.findUnique.mockResolvedValue(data);
  expect((await createConversation(request())).status).toBe(200);
  expect(mocks.tx.message.create).toHaveBeenCalledTimes(1); expect(mocks.tx.conversation.update).toHaveBeenCalledTimes(1);
  expect((await createConversation(request({ ...input, initialMessage: 'Changed' }))).status).toBe(409);
});
it('cannot append to a locked existing DM as the non-owner', async () => {
  mocks.tx.conversation.findFirst.mockImplementation(async ({ where }) => where.type ? { id: baseline.id } : null);
  mocks.tx.conversation.findUnique.mockResolvedValue({ ...baseline, userId: 'peer', isLocked: true });
  expect((await createConversation(request())).status).toBe(403); expect(mocks.tx.message.create).not.toHaveBeenCalled();
});
it.each([{ visibility: 'PUBLIC' }, { type: 'GROUP' }, { participants: ['actor', 'peer', 'stranger'] }, { deletionRequestedAt: new Date() }])('rechecks the existing DM after acquiring its row lock %j', async change => {
  mocks.tx.conversation.findFirst.mockImplementation(async ({ where }) => where.type ? { id: baseline.id } : null);
  mocks.tx.conversation.findUnique.mockResolvedValue({ ...baseline, ...change });
  expect((await createConversation(request())).status).toBe(404); expect(mocks.tx.message.create).not.toHaveBeenCalled();
});
it.each(['PARTICIPANTS', 'PRIVATE', 'SPECIFIC_USERS', 'PUBLIC'])('only publishes publicly visible threads (%s)', async visibility => {
  const response = await createConversation(request({ type: 'PUBLIC_THREAD', visibility, initialMessage: 'A post' }));
  expect(response.status).toBe(201);
  expect(mocks.publish).toHaveBeenCalledTimes(visibility === 'PUBLIC' ? 1 : 0);
  if (visibility === 'PUBLIC') expect(mocks.publish.mock.calls[0][2]).toEqual({ conversationId: (await response.json()).id });
});
it('does not report a persisted post as failed when realtime is down', async () => {
  mocks.publish.mockRejectedValue(new Error('provider secret')); vi.spyOn(console, 'warn').mockImplementation(() => {});
  expect((await createConversation(request({ type: 'PUBLIC_THREAD', visibility: 'PUBLIC', initialMessage: 'A post' }))).status).toBe(201);
});
it('fails closed without returning database/provider details', async () => {
  mocks.tx.conversation.create.mockRejectedValue(new Error('database secret'));
  const response = await createConversation(request());
  expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret'); expect(mocks.publish).not.toHaveBeenCalled();
});
