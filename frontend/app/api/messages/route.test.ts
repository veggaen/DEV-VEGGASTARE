/** @fileOverview Private reads and nested reposts never bypass conversation permissions. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), conversation: vi.fn(), messages: vi.fn(), users: vi.fn(), pulses: vi.fn(), reposts: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/message-writes', () => ({ writeMessage: vi.fn() }));
vi.mock('@/lib/db', () => ({ dbPrisma: { conversation: { findUnique: m.conversation }, message: { findMany: m.messages }, user: { findMany: m.users }, messagePulse: { findMany: m.pulses }, messageRepost: { findMany: m.reposts } } }));
import { GET } from './route';
const base = { id: 'thread', title: 'Public', userId: 'owner', participants: [], type: 'PUBLIC_THREAD', visibility: 'PUBLIC', replyPermission: 'EVERYONE', allowedRoles: [], customViewers: [], visibleToUserIds: [], isLocked: false, deletionRequestedAt: null, deletionVisibility: 'PRIVATE', isAnonymized: false, User: null, createdAt: new Date() };
const get = () => GET(new Request('http://localhost:3000/api/messages?conversationId=thread'));
beforeEach(() => { vi.resetAllMocks(); m.auth.mockResolvedValue(null); m.conversation.mockResolvedValue(base); m.messages.mockResolvedValue([]); m.users.mockResolvedValue([]); m.pulses.mockResolvedValue([]); m.reposts.mockResolvedValue([]); });
it('returns public messages uncached with a real count', async () => {
  const response = await get(); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store'); expect((await response.json()).conversation.messageCount).toBe(0);
});
it('never reads message bodies for an unauthorized viewer', async () => {
  m.conversation.mockResolvedValue({ ...base, visibility: 'PARTICIPANTS' }); expect((await get()).status).toBe(403); expect(m.messages).not.toHaveBeenCalled();
});
it('removes a private quoted conversation from a public response', async () => {
  m.conversation.mockResolvedValue({ ...base, Conversation: { ...base, id: 'private', visibility: 'PARTICIPANTS', title: 'private title', Message: [{ content: 'private text' }] } });
  const response = await get(); expect(response.status).toBe(200); const body = await response.text(); expect(body).not.toContain('private title'); expect(body).not.toContain('private text'); expect(JSON.parse(body).conversation.Conversation).toBeNull();
});
it('allows a public quote with a minimal response shape', async () => {
  m.conversation.mockResolvedValue({ ...base, Conversation: { ...base, id: 'public', title: 'Public quote', Message: [{ id: 'root', content: 'Public text', createdAt: new Date() }] } });
  const response = await get(); expect(response.status).toBe(200); const quote = (await response.json()).conversation.Conversation;
  expect(quote.title).toBe('Public quote'); expect(quote.Message[0].content).toBe('Public text'); expect(quote).not.toHaveProperty('participants');
});
