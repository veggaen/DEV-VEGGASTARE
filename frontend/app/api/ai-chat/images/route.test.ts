import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ auth: vi.fn(), guard: vi.fn(), conversation: vi.fn(), recheck: vi.fn(), position: vi.fn(), key: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), store: vi.fn(), remove: vi.fn(), normalize: vi.fn(), read: vi.fn(), lock: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/demo-policy', () => ({ isDemoUserId: (id: string) => id === 'demo' }));
vi.mock('@/lib/ai-credit-ledger', () => ({ AiCreditError: class extends Error { constructor(public code: string, public status: number) { super(code); } }, aiCreditLedger: { position: m.position } }));
vi.mock('@/lib/ai-chat/generation', () => ({ aiErrorResponse: (error: { code?: string; status?: number }) => Response.json({ error: error.code ?? 'UNAVAILABLE' }, { status: error.status ?? 503 }) }));
vi.mock('@/lib/ai-chat/request', () => ({ guardAiRequest: m.guard, readAiBytes: m.read }));
vi.mock('@/lib/ai-chat/normalize-image', () => ({ normalizeChatImage: m.normalize }));
vi.mock('@/lib/ai-chat/image-storage', () => ({ storeChatImage: m.store, deleteChatImage: m.remove }));
vi.mock('@/lib/db', () => ({ dbPrisma: { aiConversation: { findFirst: m.conversation }, userAiApiKey: { findFirst: m.key }, aiChatImage: { update: m.update },
  $transaction: (fn: (tx: unknown) => unknown) => fn({ $executeRaw: m.lock, aiConversation: { findFirst: m.recheck }, aiChatImage: { count: m.count, create: m.create } }),
} }));
import { POST } from './route';
const chat = 'cqaimage000000000000000001';
const request = (id = chat) => new NextRequest(`http://localhost:3000/api/ai-chat/images?sessionId=${id}`, { method: 'POST', body: 'image', headers: { origin: 'http://localhost:3000' } });
beforeEach(() => {
  vi.resetAllMocks(); m.auth.mockResolvedValue({ id: 'owner' }); m.conversation.mockResolvedValue({ id: chat }); m.recheck.mockResolvedValue({ id: chat });
  m.position.mockResolvedValue({ balance: 3 }); m.count.mockResolvedValue(0); m.read.mockResolvedValue(new Uint8Array([1]).buffer);
  m.normalize.mockResolvedValue({ bytes: new Uint8Array([255, 216, 255]), width: 100, height: 100 });
  m.create.mockResolvedValue({ id: 'image', width: 100, height: 100 }); m.store.mockResolvedValue('private-storage-key'); m.remove.mockResolvedValue(undefined);
});
it.each([null, { id: 'demo' }])('denies non-personal upload before reading bytes (%j)', async user => {
  m.auth.mockResolvedValue(user); expect((await POST(request())).status).toBe(403); expect(m.read).not.toHaveBeenCalled(); expect(m.store).not.toHaveBeenCalled();
});
it('validates the chat id and same-origin/rate guard before storage', async () => {
  expect((await POST(request('bad'))).status).toBe(400); expect(m.conversation).not.toHaveBeenCalled();
  m.guard.mockRejectedValue({ code: 'INVALID_ORIGIN', status: 403 }); expect((await POST(request())).status).toBe(403); expect(m.read).not.toHaveBeenCalled();
});
it('requires an owned, private active chat both before and under the reservation lock', async () => {
  m.recheck.mockResolvedValue(null); expect((await POST(request())).status).toBe(403);
  expect(m.recheck).toHaveBeenCalledWith({ where: { id: chat, creatorId: 'owner', isDeleted: false, isSuspended: false, isPublic: false }, select: { id: true } });
  expect(m.create).not.toHaveBeenCalled(); expect(m.store).not.toHaveBeenCalled();
});
it('blocks zero balance without BYOK before decoding or storage', async () => {
  m.position.mockResolvedValue({ balance: 0 }); expect((await POST(request())).status).toBe(402); expect(m.normalize).not.toHaveBeenCalled(); expect(m.store).not.toHaveBeenCalled();
});
it.each([[5000, 0, 0, 0], [0, 200, 0, 0], [0, 0, 100, 0], [0, 0, 0, 20]])('enforces independent atomic storage quotas: %j', async (a, b, c, d) => {
  for (const count of [a, b, c, d]) m.count.mockResolvedValueOnce(count);
  expect((await POST(request())).status).toBe(429); expect(m.create).not.toHaveBeenCalled(); expect(m.store).not.toHaveBeenCalled();
});
it('rejects invalid image bytes before metadata reservation', async () => {
  m.normalize.mockRejectedValue(new Error('bad data')); expect((await POST(request())).status).toBe(400); expect(m.create).not.toHaveBeenCalled();
});
it('reserves metadata before upload and exposes only safe dimensions/id', async () => {
  const response = await POST(request()); expect(response.status).toBe(200); expect(await response.json()).toEqual({ id: 'image', width: 100, height: 100 });
  expect(m.create.mock.invocationCallOrder[0]).toBeLessThan(m.store.mock.invocationCallOrder[0]);
  expect(m.update).toHaveBeenCalledWith({ where: { id: 'image' }, data: { storageKey: 'private-storage-key' } });
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it('attempts remote cleanup when the metadata update fails', async () => {
  m.update.mockRejectedValue(new Error('database unavailable')); expect((await POST(request())).status).toBe(503); expect(m.remove).toHaveBeenCalledWith('private-storage-key');
});
