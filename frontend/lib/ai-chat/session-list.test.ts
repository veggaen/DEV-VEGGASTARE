/** @fileOverview Conversation list bounds, privacy and mutation guards. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({ auth: vi.fn(), rate: vi.fn(), many: vi.fn(), first: vi.fn(), unique: vi.fn(), update: vi.fn(), messages: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: mock.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { aiConversation: { findMany: mock.many, findFirst: mock.first, findUnique: mock.unique, update: mock.update }, aiConvMessage: { findMany: mock.messages } } }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mock.rate, getClientIdentifier: () => 'qa', rateLimitedResponse: () => new Response(null, { status: 429 }) }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: vi.fn() }));
import { GET } from '@/app/api/ai-chat/sessions/route';
import { GET as detail, PATCH, DELETE } from '@/app/api/ai-chat/sessions/[sessionId]/route';
import { GET as messages } from '@/app/api/ai-chat/sessions/[sessionId]/messages/route';
import { SessionRailResponse } from './session-list';
const req = (query = '', method = 'GET', origin: string | null = 'http://localhost:3000') => new NextRequest(`http://localhost:3000/api/ai-chat/sessions${query}`, { method, ...(method === 'PATCH' ? { body: JSON.stringify({ title: 'Renamed' }), headers: { 'Content-Type': 'application/json', ...(origin ? { origin } : {}) } } : { headers: origin ? { origin } : {} }) });
const row = (id = 'qa1') => ({ id, title: 'Saved chat', updatedAt: new Date('2026-09-24T00:00:00Z'), messages: [] });
beforeEach(() => { vi.clearAllMocks(); mock.auth.mockResolvedValue({ id: 'owner' }); mock.rate.mockResolvedValue({ success: true }); mock.many.mockResolvedValue([row()]); mock.first.mockResolvedValue({ id: 'qa1' }); mock.unique.mockResolvedValue({ creatorId: 'owner', isDeleted: false, participants: [] }); mock.update.mockResolvedValue({ id: 'qa1', title: 'Renamed' }); });
describe('conversation navigation API', () => {
  it('rejects anonymous and throttled reads without querying messages', async () => { mock.auth.mockResolvedValueOnce(null); expect((await GET(req())).status).toBe(401); mock.rate.mockResolvedValueOnce({ success: false }); expect((await GET(req())).status).toBe(429); expect(mock.many).not.toHaveBeenCalled(); });
  it.each(['?limit=-1','?limit=0','?limit=101','?limit=1.2','?limit=abc','?limit=1&limit=2','?cursor=../private','?q='+'a'.repeat(201),'?user=other','?view=all'])('rejects invalid bounds %s', async query => { expect((await GET(req(query))).status).toBe(400); expect(mock.many).not.toHaveBeenCalled(); });
  it('minimizes the rail response and scopes search and deterministic paging', async () => {
    mock.many.mockResolvedValue([{ id: 'q1', title: 'Search match', updatedAt: row().updatedAt }, { id: 'q2', title: 'Extra', updatedAt: row().updatedAt }]);
    const response = await GET(req('?view=rail&limit=1&q=match')); const body = await response.json();
    expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(SessionRailResponse.safeParse(body).success).toBe(true); expect(body.nextCursor).toBe('q1'); expect(body.sessions).toHaveLength(1);
    expect(mock.many).toHaveBeenCalledWith({ where: { creatorId: 'owner', isDeleted: false, title: { contains: 'match', mode: 'insensitive' } }, take: 2, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], select: { id: true, title: true, updatedAt: true } });
  });
  it('validates cursor inside the same owner/search scope', async () => { mock.first.mockResolvedValue(null); expect((await GET(req('?view=rail&cursor=foreign&q=match'))).status).toBe(400); expect(mock.first).toHaveBeenCalledWith({ where: { creatorId: 'owner', isDeleted: false, id: 'foreign', title: { contains: 'match', mode: 'insensitive' } }, select: { id: true } }); expect(mock.many).not.toHaveBeenCalled(); });
  it('does not invent another page when exactly limit rows remain', async () => { const body = await (await GET(req('?limit=1'))).json(); expect(body.nextCursor).toBeNull(); expect(body.sessions[0].lastMessage).toBeNull(); });
  it('returns a safe retryable failure rather than an empty list', async () => { mock.many.mockRejectedValue(new Error('private database detail')); const response = await GET(req()); expect(response.status).toBe(503); expect(await response.text()).not.toContain('private database'); });
  it('never returns a soft-deleted conversation', async () => { mock.unique.mockResolvedValue({ ...row(), creatorId: 'owner', isDeleted: true, participants: [] }); expect((await detail(req(), { params: Promise.resolve({ sessionId: 'qa1' }) })).status).toBe(404); });
  it('never returns messages from a deleted conversation', async () => { mock.unique.mockResolvedValue({ creatorId: 'owner', isDeleted: true, participants: [] }); expect((await messages(req(), { params: Promise.resolve({ sessionId: 'qa1' }) })).status).toBe(404); expect(mock.messages).not.toHaveBeenCalled(); });
  it('requires active membership for a private non-owned transcript', async () => { mock.unique.mockResolvedValue({ creatorId: 'other', isPublic: false, isDeleted: false, participants: [] }); expect((await messages(req(), { params: Promise.resolve({ sessionId: 'qa1' }) })).status).toBe(403); expect(mock.unique).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ participants: { where: { isActive: true }, select: { userId: true } } }) })); expect(mock.messages).not.toHaveBeenCalled(); });
});
describe.each([['PATCH', PATCH], ['DELETE', DELETE]] as const)('%s defense in depth', (method, action) => {
  const invoke = (origin: string | null = 'http://localhost:3000') => action(req('', method, origin), { params: Promise.resolve({ sessionId: 'qa1' }) });
  it.each([null, 'https://other.example'])('rejects absent/cross-site origin %s', async origin => { expect((await invoke(origin)).status).toBe(403); expect(mock.update).not.toHaveBeenCalled(); });
  it.each([{ id: 'demo_qa' }, { id: 'flagged', isDemo: true }])('keeps demo mutation read-only %j', async user => { mock.auth.mockResolvedValue(user); expect((await invoke()).status).toBe(403); expect(mock.update).not.toHaveBeenCalled(); });
  it('retains owner-only mutation and write limits', async () => { mock.unique.mockResolvedValueOnce({ creatorId: 'other' }); expect((await invoke()).status).toBe(403); mock.rate.mockResolvedValueOnce({ success: false }); expect((await invoke()).status).toBe(429); expect(mock.update).not.toHaveBeenCalled(); });
  it('permits an authenticated same-origin owner action', async () => { expect((await invoke()).status).toBe(200); expect(mock.update).toHaveBeenCalledOnce(); });
});
