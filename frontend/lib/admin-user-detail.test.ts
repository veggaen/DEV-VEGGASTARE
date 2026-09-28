import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), allow: vi.fn(), readAllow: vi.fn(), read: vi.fn(), update: vi.fn(), audit: vi.fn(), lock: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: m.allow, allowAdminDetailRead: m.readAllow }));
vi.mock('@/lib/db', () => ({ dbPrisma: { $transaction: async (run: (tx: unknown) => unknown) => run({ $queryRaw: m.lock, user: { findUnique: m.read, update: m.update }, adminAuditLog: { create: m.audit } }) } }));
import { GET, PATCH, DELETE } from '@/app/api/admin/users/[userId]/route';
import { adminUserPatchSchema, adminUserPermissions } from './admin-user-detail-policy';
const actor = { id: 'qa-owner', role: 'OWNER', tokenVersion: 3 };
const target = { id: 'qa-member', role: 'USER', name: 'QA Member', bio: null, image: null, banner: null, updatedAt: new Date('2026-01-01') };
const payload = { name: 'Revised', expectedUpdatedAt: target.updatedAt.toISOString(), reason: 'Support correction' };
const context = (id = target.id) => ({ params: Promise.resolve({ userId: id }) });
const req = (method = 'PATCH', data: unknown = payload, headers: Record<string, string> = {}) => new Request('http://localhost:3000/api/admin/users/' + target.id, {
  method, headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', ...headers }, ...(method === 'GET' ? {} : { body: JSON.stringify(data) }),
});
beforeEach(() => {
  vi.resetAllMocks(); m.auth.mockResolvedValue({ ...actor, sessionVersion: 3 }); m.allow.mockResolvedValue(true); m.readAllow.mockResolvedValue(true);
  m.read.mockImplementation(({ where }: { where: { id: string } }) => where.id === actor.id ? { ...actor } : { ...target });
  m.update.mockImplementation(({ data }) => ({ ...target, ...data })); m.audit.mockResolvedValue({ id: 'audit' });
});
describe('admin account detail authorization and mutation boundary', () => {
  it.each([null, { id: 'normal', role: 'USER' }, { id: 'demo_owner', role: 'OWNER' }, { ...actor, isImpersonating: true }])('rejects unauthorized actor %j', async session => {
    m.auth.mockResolvedValue(session);
    for (const [handler, method] of [[GET, 'GET'], [PATCH, 'PATCH'], [DELETE, 'DELETE']] as const) {
      const response = await handler(req(method), context()); expect(response.status).toBe(session ? 403 : 401);
      expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(response.headers.get('vary')).toBe('Cookie');
    }
    expect(m.read).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
  });
  it.each(['', 'null', 'https://attacker.example', 'http://localhost:3000/extra'])('denies unsafe origin %s', async origin => {
    expect((await PATCH(req('PATCH', payload, { origin }), context())).status).toBe(403); expect(m.read).not.toHaveBeenCalled();
  });
  it.each([{ email: 'replace@example.test' }, { verificationTier: 'FULLY_VERIFIED' }, { verificationScore: 100 }, { role: 'OWNER' }, { tokenVersion: 0 }, { password: 'never-save' }, { expectedUpdatedAt: undefined }, { reason: ' ' }, { name: '' }, { image: 'javascript:alert(1)' }, { image: 'not a url' }, { image: 'https://user:pass@example.test/a.jpg' }, { image: 'http://example.test/a.jpg' }, { bio: 'x'.repeat(2001) }])('rejects invalid or sensitive fields %j', async patch => {
    expect((await PATCH(req('PATCH', { ...payload, ...patch }), context())).status).toBe(400); expect(m.update).not.toHaveBeenCalled();
  });
  it('bounds input and handles malformed JSON without leaking internals', async () => {
    expect((await PATCH(req('PATCH', { text: 'x'.repeat(17000) }), context())).status).toBe(413);
    expect((await PATCH(new Request('http://localhost:3000/api/admin/users/x', { method: 'PATCH', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: '{' }), context())).status).toBe(400);
    expect((await PATCH(req('PATCH', payload, { 'content-type': 'text/plain' }), context())).status).toBe(400);
  });
  it.each(['GET', 'PATCH'] as const)('denies durable throttle failure for %s', async method => {
    m.allow.mockResolvedValue(false); m.readAllow.mockResolvedValue(false);
    const response = await (method === 'GET' ? GET : PATCH)(req(method), context()); expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('300'); expect(m.read).not.toHaveBeenCalled();
  });
  it.each([{ ...actor, tokenVersion: 4 }, { ...actor, role: 'USER' }, null])('rechecks current actor %j under lock', async current => {
    m.read.mockImplementation(({ where }) => where.id === actor.id ? current : target);
    expect([401, 403]).toContain((await PATCH(req(), context())).status); expect(m.update).not.toHaveBeenCalled();
  });
  it('requires the signed session version', async () => {
    m.auth.mockResolvedValue(actor); expect((await GET(req('GET'), context())).status).toBe(401);
  });
  it.each(['OWNER', 'ADMIN', 'USER'])('enforces ADMIN target hierarchy %s', async role => {
    m.auth.mockResolvedValue({ ...actor, role: 'ADMIN', sessionVersion: 3 });
    m.read.mockImplementation(({ where }) => where.id === actor.id ? { ...actor, role: 'ADMIN' } : { ...target, role });
    expect((await PATCH(req(), context())).status).toBe(role === 'USER' ? 200 : 403);
  });
  it.each(['qa-owner', 'demo_fixture'])('rejects writes to self or demo %s', async id => {
    m.read.mockImplementation(({ where }) => where.id === actor.id ? { ...actor } : { ...target, id });
    expect((await PATCH(req(), context(id))).status).toBe(403);
  });
  it('rejects stale reviewed data and duplicate submission', async () => {
    expect((await PATCH(req('PATCH', { ...payload, expectedUpdatedAt: '2025-01-01T00:00:00.000Z' }), context())).status).toBe(409); expect(m.update).not.toHaveBeenCalled();
  });
  it('saves only changed allowed fields and audit data, without identity fields', async () => {
    const response = await PATCH(req(), context()); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(m.update.mock.calls[0][0].data).toEqual({ name: 'Revised', updatedAt: expect.any(Date) });
    expect(m.audit.mock.calls[0][0].data).toEqual({ adminId: actor.id, targetId: target.id, targetType: 'USER', action: 'EDIT', reason: 'Support correction', previousData: { name: 'QA Member' }, newData: { name: 'Revised' } });
  });
  it('revokes target sessions on owner role change', async () => {
    expect((await PATCH(req('PATCH', { ...payload, role: 'ADMIN' }), context())).status).toBe(200);
    expect(m.update.mock.calls[0][0].data).toMatchObject({ role: 'ADMIN', tokenVersion: { increment: 1 } }); expect(m.audit.mock.calls[0][0].data.action).toBe('ROLE_CHANGE');
  });
  it('does not let an ADMIN submit even an unchanged role field', async () => {
    m.read.mockImplementation(({ where }) => where.id === actor.id ? { ...actor, role: 'ADMIN' } : target);
    expect((await PATCH(req('PATCH', { ...payload, role: 'USER' }), context())).status).toBe(403);
  });
  it('accepts nullable image removal and rejects no-op writes', async () => {
    expect(adminUserPatchSchema.safeParse({ ...payload, image: null, banner: 'https://example.test/image.png' }).success).toBe(true);
    expect((await PATCH(req('PATCH', { ...payload, name: target.name }), context())).status).toBe(400); expect(m.audit).not.toHaveBeenCalled();
  });
  it('uses a bounded minimal detail projection and required view audit', async () => {
    const response = await GET(req('GET'), context()); expect(response.status).toBe(200);
    expect((await response.json()).permissions).toEqual({ edit: true, changeRole: true, preview: true });
    const select = m.read.mock.calls[1][0].select; expect(select.password).toBeUndefined(); expect(select.accounts).toBeUndefined(); expect(select.phoneNumber).toBeUndefined();
    expect(select.Employee).toMatchObject({ take: 5, orderBy: { id: 'asc' } }); expect(m.audit.mock.calls[0][0].data.action).toBe('VIEW');
  });
  it.each(['auth', 'read', 'update', 'audit'] as const)('fails closed without exposing %s errors', async key => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {}); m[key].mockRejectedValue(new Error('sensitive-marker'));
    try { const response = await PATCH(req(), context()); expect(response.status).toBe(503); expect(await response.text()).not.toContain('sensitive-marker'); expect(spy).not.toHaveBeenCalled(); } finally { spy.mockRestore(); }
  });
  it('never runs a cascading deletion, even with missing or invalid payload', async () => {
    for (const value of [{ reason: 'Customer requested' }, {}, null]) expect((await DELETE(req('DELETE', value), context())).status).toBe(409);
    expect(m.read).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled(); expect(m.audit).not.toHaveBeenCalled();
  });
  it('never offers ownership transfer through the ordinary editor', () => {
    expect(adminUserPermissions(actor, { ...target, role: 'OWNER' })).toEqual({ edit: false, changeRole: false, preview: false });
  });
});
