import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE_NAME } from './auth-cookies';
const m = vi.hoisted(() => ({ auth: vi.fn(), allow: vi.fn(), read: vi.fn(), lock: vi.fn(), audit: vi.fn(), encode: vi.fn(), grant: vi.fn(), consume: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: m.allow }));
vi.mock('next-auth/jwt', () => ({ encode: m.encode }));
vi.mock('@/lib/db', () => ({ dbPrisma: { $transaction: async (run: (tx: unknown) => unknown) => run({ $queryRaw: m.lock, user: { findUnique: m.read }, adminAuditLog: { create: m.audit }, accountPreviewSession: { create: m.grant, updateMany: m.consume } }) } }));
import { POST as start } from '@/app/api/admin/impersonate/route';
import { POST as end } from '@/app/api/admin/impersonate/end/route';
const owner = { id: 'qa-owner', role: 'OWNER', tokenVersion: 3, name: 'Owner', updatedAt: new Date('2026-01-01') };
const target = { ...owner, id: 'qa-member', role: 'USER', tokenVersion: 7 };
const input = { targetUserId: target.id, expectedUpdatedAt: target.updatedAt.toISOString(), reason: 'Support investigation' };
const preview = () => ({ id: target.id, role: 'USER', sessionVersion: 7, isImpersonating: true, impersonatingFromId: owner.id,
  impersonationSessionId: '0ad8f0cc-ffb6-4171-8cd3-26c442ea9a78',
  impersonationOwnerVersion: 3, impersonationStartedAt: Math.floor(Date.now()/1000)-1, impersonationExpiresAt: Math.floor(Date.now()/1000)+3599 });
const req = (body: unknown = input, headers: Record<string,string> = {}) => new Request('http://localhost:3000/api/admin/impersonate', {
  method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('AUTH_SECRET', 'unit-only-preview-key');
  m.auth.mockResolvedValue({ id: owner.id, role: 'OWNER', sessionVersion: 3 }); m.allow.mockResolvedValue(true);
  m.read.mockImplementation(({ where }: { where: { id: string } }) => where.id === owner.id ? owner : target);
  m.audit.mockResolvedValue({ id: 'audit' }); m.encode.mockResolvedValue('unit-only-encrypted-cookie');
  m.grant.mockResolvedValue({ id: 'grant' }); m.consume.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.unstubAllEnvs());
describe('audited account preview issuance and restoration', () => {
  it.each([null, { id: 'qa-admin', role: 'ADMIN' }, { id: 'demo_owner', role: 'OWNER' }, { id: owner.id, role: 'OWNER', isImpersonating: true }])('rejects unauthorized or nested actor %j', async actor => {
    m.auth.mockResolvedValue(actor); const response = await start(req()); expect([401,403]).toContain(response.status); expect(m.read).not.toHaveBeenCalled(); expect(response.headers.has('set-cookie')).toBe(false);
  });
  it.each(['', 'null', 'https://other.example', 'http://localhost:3000/path'])('rejects origin %s', async origin => {
    expect((await start(req(input,{ origin }))).status).toBe(403); expect(m.auth).not.toHaveBeenCalled();
  });
  it.each([{ ...input, targetUserId: owner.id }, { ...input, targetUserId: 'demo_member' }, { ...input, expectedUpdatedAt: undefined },
    { ...input, reason: '' }, { ...input, role: 'OWNER' }, { ...input, reason: 'a'.repeat(501) }])('rejects invalid request %j', async body => {
    expect((await start(req(body))).status).toBe(400); expect(m.read).not.toHaveBeenCalled();
  });
  it('bounds streamed input and malformed JSON', async () => {
    expect((await start(req({ value: 'x'.repeat(4200) }))).status).toBe(413);
    expect((await start(new Request('http://localhost:3000/api/admin/impersonate', { method:'POST', headers: { origin:'http://localhost:3000', 'content-type':'application/json' }, body:'{' }))).status).toBe(400);
    expect(m.encode).not.toHaveBeenCalled();
  });
  it('fails closed on throttling and missing signing configuration', async () => {
    m.allow.mockResolvedValue(false); expect((await start(req())).status).toBe(429); expect(m.read).not.toHaveBeenCalled();
    m.allow.mockResolvedValue(true); vi.stubEnv('AUTH_SECRET',''); vi.stubEnv('NEXTAUTH_SECRET',''); expect((await start(req())).status).toBe(503); expect(m.encode).not.toHaveBeenCalled();
  });
  it.each([null, { ...owner, role:'ADMIN' }, { ...owner, tokenVersion:4 }])('rechecks the owner under lock %j', async current => {
    m.read.mockImplementation(({ where }: { where:{id:string} }) => where.id === owner.id ? current : target);
    expect([401,403]).toContain((await start(req())).status); expect(m.encode).not.toHaveBeenCalled();
  });
  it.each([null, { ...target, role:'OWNER' }, { ...target, role:'ADMIN' }, { ...target, updatedAt: new Date('2026-02-01') }])('rejects missing, privileged or stale target %j', async current => {
    m.read.mockImplementation(({ where }: { where:{id:string} }) => where.id === owner.id ? owner : current);
    expect([403,409]).toContain((await start(req())).status); expect(m.encode).not.toHaveBeenCalled();
  });
  it('issues minimal one-hour claims after an audit succeeds and clears old chunks', async () => {
    const response = await start(req(input,{cookie:`${SESSION_COOKIE_NAME}.0=old; ${SESSION_COOKIE_NAME}.1=old; unrelated=keep`}));
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(m.encode.mock.calls[0][0]).toMatchObject({ maxAge:3600, salt:SESSION_COOKIE_NAME, token: { sub:target.id, tokenVersion:7, impersonationOwnerVersion:3, isImpersonating:true } });
    const claims = m.encode.mock.calls[0][0].token; expect(claims.impersonationExpiresAt-claims.impersonationStartedAt).toBe(3600); expect(claims).not.toHaveProperty('email');
    expect(claims.impersonationSessionId).toMatch(/^[a-f0-9-]{36}$/);
    expect(m.grant.mock.calls[0][0].data).toMatchObject({ id: claims.impersonationSessionId, ownerId: owner.id, targetId: target.id, ownerVersion: 3, targetVersion: 7 });
    expect(m.audit.mock.calls[0][0].data).toMatchObject({ adminId:owner.id, targetId:target.id, newData:{phase:'start',readOnly:true} });
    expect(response.headers.getSetCookie().some(cookie => cookie.startsWith(`${SESSION_COOKIE_NAME}.0=`) && cookie.includes('Max-Age=0'))).toBe(true);
    expect(response.headers.getSetCookie().some(cookie => cookie.startsWith(`${SESSION_COOKIE_NAME}=`) && cookie.includes('HttpOnly') && cookie.includes('Max-Age=3600'))).toBe(true);
  });
  it.each(['auth','read','audit','encode','grant'] as const)('does not issue any cookie or leak a %s failure', async source => {
    m[source].mockRejectedValue(new Error('private-error-marker')); const response = await start(req());
    expect(response.status).toBe(503); expect(response.headers.has('set-cookie')).toBe(false); expect(await response.text()).not.toContain('private-error-marker');
  });
  it('restores only the signed authorizing owner after both versions pass', async () => {
    m.auth.mockResolvedValue(preview()); const response = await end(req()); expect(response.status).toBe(200);
    expect(m.encode.mock.calls[0][0].token).toEqual({sub:owner.id,tokenVersion:3,isImpersonating:false});
    expect(m.audit.mock.calls[0][0].data.newData.phase).toBe('end');
    expect(m.consume.mock.calls[0][0].where).toMatchObject({ id: preview().impersonationSessionId, ownerId:owner.id, targetId:target.id, endedAt:null, ownerVersion:3, targetVersion:7 });
    expect(m.grant).not.toHaveBeenCalled();
  });
  it.each([{ impersonationOwnerVersion:2 }, { sessionVersion:6 }, { impersonationExpiresAt:0 }, { impersonationStartedAt:undefined }, { impersonationSessionId:undefined }, { impersonationSessionId:'invalid' }])('refuses revoked restoration %j', async changed => {
    m.auth.mockResolvedValue({...preview(),...changed}); expect((await end(req())).status).toBe(401); expect(m.encode).not.toHaveBeenCalled();
  });
  it('refuses a missing, mismatched or already-consumed server grant without restoring owner access', async () => {
    m.auth.mockResolvedValue(preview()); m.consume.mockResolvedValue({count:0});
    const response=await end(req()); expect(response.status).toBe(401); expect(response.headers.has('set-cookie')).toBe(false); expect(m.encode).not.toHaveBeenCalled(); expect(m.audit).not.toHaveBeenCalled();
  });
  it('does not confirm End Preview on a revocation-store failure', async () => {
    m.auth.mockResolvedValue(preview()); m.consume.mockRejectedValue(new Error('private-store-error'));
    const response=await end(req()); expect(response.status).toBe(503); expect(response.headers.has('set-cookie')).toBe(false); expect(await response.text()).not.toContain('private-store-error');
  });
  it('cannot restore from untrusted legacy metadata cookies', async () => {
    m.auth.mockResolvedValue({id:target.id,role:'USER'}); expect((await end(req(input,{cookie:'x-impersonate-owner-id=qa-owner'}))).status).toBe(403); expect(m.encode).not.toHaveBeenCalled();
  });
});
