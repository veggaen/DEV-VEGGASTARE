/** @fileOverview Invalid JWTs must produce Auth.js null sessions, not authenticated empty shells. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextAuthConfig } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import { encode } from 'next-auth/jwt';
import { Auth } from '@auth/core';

const fixture = vi.hoisted(() => ({ config: null as NextAuthConfig | null, user: vi.fn(), account: vi.fn() }));
vi.mock('next-auth', () => ({ default: (config: NextAuthConfig) => {
  fixture.config = config;
  return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
} }));
vi.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: () => ({}) }));
vi.mock('@/lib/db', () => ({ dbPrisma: {} }));
vi.mock('@/auth.config', () => ({ default: { providers: [] } }));
vi.mock('@/data/user', () => ({ getUserById: fixture.user }));
vi.mock('@/lib/account', () => ({ getAccountByUserId: fixture.account }));
vi.mock('@/lib/verification-recalc', () => ({ recalculateVerificationTier: vi.fn() }));
vi.mock('@/lib/mail', () => ({ sendOauthLinkConfirmationEmail: vi.fn() }));
import './auth';

const refresh = (token: JWT) => fixture.config!.callbacks!.jwt!({ token, user: { id: token.sub }, account: null });
const user = { id: 'qa-existing-user', name: 'QA user', email: 'qa@example.test', role: 'USER',
  tokenVersion: 3, createdAt: new Date(), isTwoFactorEnabled: false, web3ModeEnabled: false };
beforeEach(() => { fixture.user.mockReset(); fixture.account.mockReset(); fixture.account.mockResolvedValue(null); });

describe('Invalid sessions are fully revoked', () => {
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
});
