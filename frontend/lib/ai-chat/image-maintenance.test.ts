import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ find: vi.fn(), count: vi.fn(), claim: vi.fn(), remove: vi.fn(), remote: vi.fn(), hide: vi.fn(), deleteChat: vi.fn(), lock: vi.fn() }));
vi.mock('@/lib/db', () => ({ dbPrisma: {
  $transaction: (fn: (tx: unknown) => unknown) => fn({ $executeRaw: m.lock, aiChatImage: { findMany: m.find, count: m.count, updateMany: m.claim }, aiConversation: { update: m.hide, delete: m.deleteChat } }),
  aiChatImage: { deleteMany: m.remove },
} }));
vi.mock('./image-storage', () => ({ deleteChatImage: m.remote }));
vi.mock('./images', () => ({ unusedImageCutoff: () => new Date(Date.now() - 86400_000) }));
import { chatImageMaintenance } from './image-maintenance';
import { permanentlyDeleteAiConversation } from './delete-conversation';
beforeEach(() => { vi.resetAllMocks(); m.find.mockResolvedValue([]); m.count.mockResolvedValue(0); });
it('claims a bounded batch with a ten-minute lease before remote I/O', async () => {
  m.find.mockResolvedValue([{ id: 'one', storageKey: 'private-one' }, { id: 'two', storageKey: null }]);
  expect(await chatImageMaintenance()).toEqual({ removed: 2, deferred: 0 });
  expect(m.find).toHaveBeenCalledWith(expect.objectContaining({ take: 5, where: { OR: [
    { purgingAt: { lt: expect.any(Date) } },
    { purgingAt: null, messageId: null, createdAt: { lt: expect.any(Date) } },
    { purgingAt: null, conversation: { isDeleted: true, deletedAt: { lt: expect.any(Date) } } },
  ] } }));
  const cutoff = m.find.mock.calls[0][0].where.OR[0].purgingAt.lt.getTime();
  expect(Date.now() - cutoff).toBeGreaterThanOrEqual(600_000);
  expect(m.claim.mock.invocationCallOrder[0]).toBeLessThan(m.remote.mock.invocationCallOrder[0]);
  expect(m.remote.mock.invocationCallOrder[0]).toBeLessThan(m.remove.mock.invocationCallOrder[0]);
  expect(m.remote).toHaveBeenCalledTimes(1);
});
it('retains the storage locator after a remote failure so cleanup can retry', async () => {
  m.find.mockResolvedValue([{ id: 'one', storageKey: 'private-one' }]); m.remote.mockRejectedValue(new Error('Unavailable'));
  expect(await chatImageMaintenance()).toEqual({ removed: 0, deferred: 1 }); expect(m.remove).not.toHaveBeenCalled();
});
it('hides chats with files but never cascades away their cleanup records', async () => {
  m.count.mockResolvedValue(2);
  expect(await permanentlyDeleteAiConversation('chat', 'owner')).toEqual({ pending: true });
  expect(m.hide).toHaveBeenCalledWith({ where: { id: 'chat' }, data: { isDeleted: true, deletedAt: expect.any(Date), deletedBy: 'owner' } });
  expect(m.claim).toHaveBeenCalledWith({ where: { conversationId: 'chat', purgingAt: null }, data: { purgingAt: new Date(0) } });
  expect(m.deleteChat).not.toHaveBeenCalled(); expect(m.remote).not.toHaveBeenCalled();
});
it('allows permanent deletion only after all image records have been cleaned', async () => {
  expect(await permanentlyDeleteAiConversation('chat', 'owner')).toEqual({ pending: false });
  expect(m.deleteChat).toHaveBeenCalledWith({ where: { id: 'chat' } }); expect(m.claim).not.toHaveBeenCalled();
});
