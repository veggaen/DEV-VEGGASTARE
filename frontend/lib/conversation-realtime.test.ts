/** @fileOverview No message content on realtime, including stale authorized sockets. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
const lookup = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ dbPrisma: { conversation: { findUnique: lookup } } }));
import { realtimePublication } from './conversation-realtime';
import { scopeChannel, authorizedChannelTarget } from './pusher-channel';
beforeEach(() => { vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview'); lookup.mockReset(); lookup.mockResolvedValue({ visibility: 'PUBLIC' }); });
it.each(['development', 'preview', 'production'])('scopes authenticated channels in %s without double-prefixing', environment => {
  vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', environment); vi.stubEnv('NODE_ENV', environment === 'development' ? 'development' : 'production');
  const prefix = environment === 'preview' ? 'preview__' : environment === 'development' ? 'dev__' : '';
  expect(scopeChannel('ConversationChannel_chat')).toBe(`private-${prefix}ConversationChannel_chat`);
  expect(scopeChannel(scopeChannel('ConversationChannel_chat'))).toBe(`private-${prefix}ConversationChannel_chat`);
  expect(authorizedChannelTarget(`private-${prefix}ConversationChannel_chat`)).toEqual({ kind: 'conversation', id: 'chat' });
  expect(authorizedChannelTarget(`private-${prefix}user_member`)).toEqual({ kind: 'user', id: 'member' });
  expect(scopeChannel('UserChannel_cart')).toBe(`${prefix}UserChannel_cart`);
});
it('rejects public, foreign-environment, unknown and malformed authorization targets', () => {
  for (const channel of ['ConversationChannel_chat', 'private-ConversationChannel_chat', 'private-dev__ConversationChannel_chat', 'private-preview__anything_else', 'private-preview__ConversationChannel_a/b', `private-preview__user_${'a'.repeat(129)}`]) expect(authorizedChannelTarget(channel)).toBeNull();
});
it.each(['new-message', 'edit-message', 'delete-message'])('%s always carries only an invalidation, without a racy visibility lookup', async event => {
  const result = await realtimePublication('ConversationChannel_chat', event, { content: 'private', imageUrl: 'https://private', User: { email: 'private' } });
  expect(result).toEqual({ channel: 'private-preview__ConversationChannel_chat', event: 'conversation-updated', data: {} });
  expect(lookup).not.toHaveBeenCalled();
});
it('strips private stats, user notifications and unknown public payloads', async () => {
  lookup.mockResolvedValueOnce({ visibility: 'PARTICIPANTS' });
  expect((await realtimePublication('ConversationChannel_chat', 'view-update', { viewCount: 4, title: 'private' })).data).toEqual({});
  expect((await realtimePublication('user_member', 'deleted', { title: 'private' })).data).toEqual({});
  expect((await realtimePublication('ConversationChannel_chat', 'unknown', { title: 'private' })).data).toEqual({});
});
it('allowlists numeric public stats but never accepts extra content fields', async () => {
  expect((await realtimePublication('ConversationChannel_chat', 'view-update', { viewCount: 2, uniqueViewCount: 1, content: 'do not publish' })).data).toEqual({ conversationId: 'chat', viewCount: 2, uniqueViewCount: 1 });
});
