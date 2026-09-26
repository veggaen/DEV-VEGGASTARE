import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ find: vi.fn(), read: vi.fn() }));
vi.mock('@/lib/db', () => ({ dbPrisma: { aiChatImage: { findMany: m.find } } }));
vi.mock('@/lib/ai-chat/image-storage', () => ({ readChatImage: m.read }));
vi.mock('@/lib/ai-credit-ledger', () => ({ AiCreditError: class extends Error { constructor(public code: string, public status: number) { super(code); } } }));
import { loadChatImages, visibleImageWhere } from './images';
beforeEach(() => { vi.clearAllMocks(); m.find.mockResolvedValue([]); m.read.mockResolvedValue(new Uint8Array([255, 216, 255])); });
it('requires authentication and a conversation before storage access', async () => {
  await expect(loadChatImages([{ role: 'user', content: 'Hi', imageIds: ['one'] }])).rejects.toMatchObject({ code: 'IMAGE_PRIVATE_CHAT_REQUIRED' });
  expect(m.read).not.toHaveBeenCalled(); expect(m.find).not.toHaveBeenCalled();
});
it('does not treat a public link as permission and scopes stored files to the chat', async () => {
  await expect(loadChatImages([{ role: 'user', content: 'Hi', imageIds: ['other'] }], 'alice', 'chat-a')).rejects.toMatchObject({ code: 'IMAGE_UNAVAILABLE' });
  expect(m.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ conversationId: 'chat-a', purgingAt: null, conversation: { isDeleted: false, isSuspended: false, OR: [{ creatorId: 'alice' }, { participants: { some: { userId: 'alice', isActive: true } } }] } }) }));
  expect(m.read).not.toHaveBeenCalled();
  expect(JSON.stringify(visibleImageWhere('alice'))).not.toContain('isPublic');
});
it('rejects duplicate ids, assistant attachments and excessive context before reads', async () => {
  for (const messages of [[{ role: 'user' as const, content: 'Hi', imageIds: ['x', 'x'] }], [{ role: 'assistant' as const, content: 'Hi', imageIds: ['x'] }], [{ role: 'user' as const, content: 'Hi', imageIds: ['1', '2', '3', '4', '5'] }]]) await expect(loadChatImages(messages, 'alice', 'chat-a')).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  expect(m.find).not.toHaveBeenCalled();
});
it('sends normalized data, not storage keys or cookies, to the model', async () => {
  m.find.mockResolvedValue([{ id: 'one', ownerId: 'alice', storageKey: 'private-key' }]);
  const messages = await loadChatImages([{ role: 'user', content: 'Hi', imageIds: ['one'] }], 'alice', 'chat-a');
  expect(messages).toEqual([{ role: 'user', content: 'Hi', images: ['data:image/jpeg;base64,/9j/'] }]);
  expect(JSON.stringify(messages)).not.toContain('private-key');
});
