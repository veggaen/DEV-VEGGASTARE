/** @fileOverview Realtime authorization is scoped to fresh identity and read permissions. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), conversation: vi.fn(), limit: vi.fn(), authorize: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ dbPrisma: { user: { findUnique: mocks.user }, conversation: { findUnique: mocks.conversation } } }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: mocks.session }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowRealtimeAuthorization: mocks.limit }));
vi.mock('@/lib/pusher', () => ({ pusherServer: { authorizeChannel: mocks.authorize } }));
import { POST } from './route';
const request = (channel = 'private-preview__ConversationChannel_thread', socket = '123.456', origin = 'http://localhost:3000') => new Request('http://localhost:3000/api/pusher/auth', { method: 'POST', headers: { origin, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ channel_name: channel, socket_id: socket }) });
const conversation = { id: 'thread', userId: 'creator', participants: ['member'], type: 'GROUP', visibility: 'PARTICIPANTS', replyPermission: 'EVERYONE', allowedRoles: [], customViewers: [], visibleToUserIds: [], isLocked: false };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview');
  mocks.session.mockResolvedValue({ id: 'member', role: 'USER', sessionVersion: 2 }); mocks.user.mockResolvedValue({ id: 'member', role: 'USER', tokenVersion: 2 });
  mocks.limit.mockResolvedValue(true); mocks.conversation.mockResolvedValue(conversation); mocks.authorize.mockReturnValue({ auth: 'test-signature' });
});
it('authorizes a current private member with a private uncached response', async () => {
  const response = await POST(request()); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(mocks.authorize).toHaveBeenCalledWith('123.456', 'private-preview__ConversationChannel_thread');
});
it('denies guest, non-member, removed member and missing conversations', async () => {
  mocks.session.mockResolvedValueOnce(null); expect((await POST(request())).status).toBe(403);
  mocks.conversation.mockResolvedValueOnce({ ...conversation, participants: [] }); expect((await POST(request())).status).toBe(403);
  mocks.conversation.mockResolvedValueOnce(null); expect((await POST(request())).status).toBe(403);
  expect(mocks.authorize).not.toHaveBeenCalled();
});
it('allows a guest to subscribe to a public thread but not deletion-hidden content', async () => {
  mocks.session.mockResolvedValue(null); mocks.conversation.mockResolvedValue({ ...conversation, type: 'PUBLIC_THREAD', visibility: 'PUBLIC' });
  expect((await POST(request())).status).toBe(200);
  mocks.conversation.mockResolvedValue({ ...conversation, type: 'PUBLIC_THREAD', visibility: 'PUBLIC', deletionVisibility: 'PRIVATE', deletionRequestedAt: new Date() });
  expect((await POST(request())).status).toBe(403);
});
it.each(['PRIVATE_DM', 'GROUP'])('denies legacy public %s subscriptions to guests and non-members', async type => {
  mocks.conversation.mockResolvedValue({ ...conversation, type, visibility: 'PUBLIC', participants: [] });
  expect((await POST(request())).status).toBe(403);
  mocks.session.mockResolvedValue(null); expect((await POST(request())).status).toBe(403);
  expect(mocks.authorize).not.toHaveBeenCalled();
});
it('only authorizes the current user’s notification channel', async () => {
  expect((await POST(request('private-preview__user_member'))).status).toBe(200);
  expect((await POST(request('private-preview__user_other'))).status).toBe(403);
  mocks.user.mockResolvedValue({ id: 'member', role: 'ADMIN', tokenVersion: 2 });
  expect((await POST(request('private-preview__user_other'))).status).toBe(403);
});
it('rejects stale sessions and impersonation', async () => {
  mocks.user.mockResolvedValueOnce({ id: 'member', role: 'USER', tokenVersion: 3 }); expect((await POST(request())).status).toBe(401);
  mocks.session.mockResolvedValueOnce({ id: 'member', sessionVersion: 2, isImpersonating: true }); expect((await POST(request())).status).toBe(401);
  expect(mocks.authorize).not.toHaveBeenCalled();
});
it('rejects cross-site, foreign environment and socket injection requests', async () => {
  expect((await POST(request(undefined, undefined, 'https://evil.example'))).status).toBe(403);
  expect((await POST(request('private-ConversationChannel_thread'))).status).toBe(403);
  expect((await POST(request(undefined, '1.2:injected'))).status).toBe(403);
  expect(mocks.authorize).not.toHaveBeenCalled();
});
it('rate-limits and bounds incoming authorization bodies', async () => {
  mocks.limit.mockResolvedValueOnce(false); expect((await POST(request())).status).toBe(429);
  expect((await POST(request('a'.repeat(2500)))).status).toBe(413);
  expect(mocks.authorize).not.toHaveBeenCalled();
});
