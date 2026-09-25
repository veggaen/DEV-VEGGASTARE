/** @fileOverview Invalid JWTs must produce Auth.js null sessions, not authenticated empty shells. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextAuthConfig } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import { encode } from 'next-auth/jwt';
import { Auth } from '@auth/core';

const fixture = vi.hoisted(() => ({ config: null as NextAuthConfig | null, user: vi.fn(), account: vi.fn(), preview: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next-auth', () => ({ default: (config: NextAuthConfig) => {
  fixture.config = config;
  return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
} }));
vi.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: () => ({}) }));
vi.mock('@/lib/db', () => ({ dbPrisma: { accountPreviewSession: { findUnique: fixture.preview } } }));
vi.mock('@/auth.config', () => ({ default: { providers: [] } }));
vi.mock('@/data/user', () => ({ getUserById: fixture.user }));
vi.mock('@/lib/account', () => ({ getAccountByUserId: fixture.account }));
vi.mock('@/lib/verification-recalc', () => ({ recalculateVerificationTier: vi.fn() }));
vi.mock('@/lib/mail', () => ({ sendOauthLinkConfirmationEmail: vi.fn() }));
import './auth';

const refresh = (token: JWT) => fixture.config!.callbacks!.jwt!({ token, user: { id: token.sub }, account: null });
const user = { id: 'qa-existing-user', name: 'QA user', email: 'qa@example.test', role: 'USER',
  tokenVersion: 3, createdAt: new Date(), isTwoFactorEnabled: false, web3ModeEnabled: false };
beforeEach(() => { fixture.user.mockReset(); fixture.account.mockReset(); fixture.account.mockResolvedValue(null); fixture.preview.mockReset(); });

describe('Invalid sessions are fully revoked', () => {
  const owner = { ...user, id: 'qa-owner', role: 'OWNER', tokenVersion: 8 };
  const preview = () => ({ sub: user.id, isImpersonating: true, impersonatingFromId: owner.id, tokenVersion:3,
    impersonationSessionId:'0ad8f0cc-ffb6-4171-8cd3-26c442ea9a78',
    impersonationOwnerVersion:8, impersonationStartedAt: Math.floor(Date.now()/1000)-1, impersonationExpiresAt:Math.floor(Date.now()/1000)+3599 });
  const grant = (token = preview()) => ({ id: token.impersonationSessionId, ownerId:owner.id, targetId:user.id,
    ownerVersion:8, targetVersion:3, startedAt:new Date(token.impersonationStartedAt*1000), expiresAt:new Date(token.impersonationExpiresAt*1000), endedAt:null });
  it.each([{tokenVersion:2}, {impersonationOwnerVersion:7}, {impersonationOwnerVersion:undefined},
    {impersonationExpiresAt:0}, {impersonationStartedAt:0}, {impersonatingFromId:undefined}])('revokes invalid preview %j instead of treating it as a normal member', async changed => {
    fixture.user.mockImplementation(id => id === owner.id ? owner : user);
    expect(await refresh({...preview(), ...changed})).toBeNull();
  });
  it.each([null, {...owner,role:'ADMIN'}, {...owner,tokenVersion:9}])('revokes preview when the owner changes %j', async current => {
    fixture.user.mockImplementation(id => id === owner.id ? current : user); expect(await refresh(preview())).toBeNull();
  });
  it.each([null,{...user,role:'ADMIN'},{...user,tokenVersion:4}])('revokes preview when the target changes %j', async current => {
    fixture.user.mockImplementation(id => id === owner.id ? owner : current); expect(await refresh(preview())).toBeNull();
  });
  it('keeps a valid preview read-only without renewing its absolute deadline', async () => {
    fixture.user.mockImplementation(id => id === owner.id ? owner : user); const token = preview();
    fixture.preview.mockResolvedValue(grant(token));
    expect(await refresh(token)).toMatchObject({isImpersonating:true,tokenVersion:3,impersonationOwnerVersion:8,impersonationExpiresAt:token.impersonationExpiresAt});
  });
  it('does not fall back to a member session on a preview lookup exception', async () => {
    fixture.user.mockRejectedValue(new Error('lookup unavailable')); await expect(refresh(preview())).rejects.toThrow('lookup unavailable');
  });
  it('ends a token without a subject without querying users', async () => {
    expect(await refresh({ name: 'stale identity' })).toBeNull();
    expect(fixture.user).not.toHaveBeenCalled();
  });
  it('ends a deleted or unknown user session', async () => {
    fixture.user.mockResolvedValue(null);
    expect(await refresh({ sub: 'qa-missing-user', email: 'stale@example.test' })).toBeNull();
  });
  it('ends an explicitly revoked token version', async () => {
    fixture.user.mockResolvedValue(user);
    expect(await refresh({ sub: user.id, tokenVersion: 2 })).toBeNull();
  });
  it('ends an expired demo session', async () => {
    fixture.user.mockResolvedValue({ ...user, id: 'demo_expired', createdAt: new Date(Date.now() - 86_400_001) });
    expect(await refresh({ sub: 'demo_expired', tokenVersion: 3 })).toBeNull();
  });
  it('ends impersonation when its authorizing owner no longer exists', async () => {
    fixture.user.mockResolvedValue(null);
    expect(await refresh({ sub: 'qa-target', isImpersonating: true, impersonatingFromId: 'qa-owner' })).toBeNull();
  });
  it('preserves a valid user and current version', async () => {
    fixture.user.mockResolvedValue(user);
    expect(await refresh({ sub: user.id, tokenVersion: 3 })).toMatchObject({ sub: user.id, tokenVersion: 3, role: 'USER' });
    expect(fixture.preview).not.toHaveBeenCalled();
  });
  it('preserves a fresh demo', async () => {
    fixture.user.mockResolvedValue({ ...user, id: 'demo_fresh' });
    expect(await refresh({ sub: 'demo_fresh', tokenVersion: 3 })).toMatchObject({ sub: 'demo_fresh' });
  });
  it('returns JSON null and deletes the cookie through the real Auth.js session handler', async () => {
    fixture.user.mockResolvedValue(null);
    const secret = 'disposable-session-handler-test-secret';
    const name = 'authjs.session-token';
    const token = await encode({ token: { sub: 'qa-missing-user' }, secret, salt: name });
    const response = await Auth(new Request('http://localhost:3000/api/auth/session', {
      headers: { Cookie: `${name}=${token}` },
    }), { ...fixture.config!, adapter: undefined, secret, trustHost: true, basePath: '/api/auth' });
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
    expect(response.headers.getSetCookie().some(cookie => cookie.startsWith(`${name}=`) && /Max-Age=0/i.test(cookie))).toBe(true);
  });
  it.each(['owner-version', 'target-version', 'deadline', 'ended', 'missing', 'legacy'] as const)('clears revoked preview cookies through Auth.js: %s', async cause => {
    fixture.user.mockImplementation(id => id === owner.id
      ? { ...owner, tokenVersion: cause === 'owner-version' ? 9 : 8 }
      : { ...user, tokenVersion: cause === 'target-version' ? 4 : 3 });
    const secret = 'disposable-preview-handler-test-secret', name = 'authjs.session-token';
    const claims = { ...preview(), ...(cause === 'deadline' ? { impersonationExpiresAt: 0 } : {}), ...(cause === 'legacy' ? { impersonationSessionId: undefined } : {}) };
    fixture.preview.mockResolvedValue(cause==='missing'?null:{...grant(),...(cause==='ended'?{endedAt:new Date()}: {})});
    const token = await encode({ token: claims, secret, salt: name });
    const response = await Auth(new Request('http://localhost:3000/api/auth/session', {
      headers: { Cookie: `${name}=${token}` },
    }), { ...fixture.config!, adapter: undefined, secret, trustHost: true, basePath: '/api/auth' });
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
    expect(response.headers.getSetCookie().some(cookie => cookie.startsWith(`${name}=`) && /Max-Age=0/i.test(cookie))).toBe(true);
  });
  it.each([{ownerId:'another-owner'}, {targetId:'another-user'}, {ownerVersion:9}, {targetVersion:4},
    {startedAt:new Date(0)}, {expiresAt:new Date(0)}, {endedAt:new Date()}])('rejects a changed server grant %j',async changed=>{
    fixture.user.mockImplementation(id=>id===owner.id?owner:user);const token=preview();fixture.preview.mockResolvedValue({...grant(token),...changed});
    expect(await refresh(token)).toBeNull();
  });
  it('checks the grant on every renewal so a previously valid copy stops after End',async()=>{
    fixture.user.mockImplementation(id=>id===owner.id?owner:user);const token=preview();
    fixture.preview.mockResolvedValueOnce(grant(token)).mockResolvedValueOnce({...grant(token),endedAt:new Date()});
    expect(await refresh({...token})).not.toBeNull(); expect(await refresh({...token})).toBeNull(); expect(fixture.preview).toHaveBeenCalledTimes(2);
  });
  it('fails closed when the revocation store is unavailable',async()=>{
    fixture.user.mockImplementation(id=>id===owner.id?owner:user);fixture.preview.mockRejectedValue(new Error('preview store unavailable'));
    await expect(refresh(preview())).rejects.toThrow('preview store unavailable');
  });
});
