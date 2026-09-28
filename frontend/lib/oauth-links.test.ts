/** @fileOverview OAuth link ownership, email and token-consumption boundaries. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const m = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), mail: vi.fn(), recalc: vi.fn(), lock: vi.fn(),
  user: vi.fn(), update: vi.fn(), account: vi.fn(), removeAccount: vi.fn(), pending: vi.fn(), removePending: vi.fn(), upsert: vi.fn(), transaction: vi.fn() }));
vi.mock('@/auth', () => ({ auth: m.auth }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: m.limit }));
vi.mock('@/lib/mail', () => ({ sendOauthLinkConfirmationEmail: m.mail }));
vi.mock('@/lib/verification-recalc', () => ({ recalculateVerificationTier: m.recalc }));
vi.mock('@/lib/db', () => ({ dbPrisma: { $transaction: m.transaction, pendingOAuthLink: { deleteMany: m.removePending } } }));
import { confirmOauthLink, resendOauthConfirmation, unlinkOauthProvider } from '@/actions/oauth-links';
import { GET } from '@/app/api/auth/confirm-oauth-link/route';
import { POST } from '@/app/api/auth/unlink-oauth/route';
const token = 'cdisposableunitconfirmation01';
const tx = { $queryRaw: m.lock, user: { findUnique: m.user, update: m.update }, account: { findFirst: m.account, deleteMany: m.removeAccount },
  pendingOAuthLink: { findUnique: m.pending, deleteMany: m.removePending, upsert: m.upsert } };
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: 'qa-owner' } }); m.limit.mockResolvedValue(true);
  m.transaction.mockImplementation(fn => fn(tx));
  m.user.mockResolvedValue({ email: 'qa@example.test', name: 'QA', password: 'hash', emailVerified: new Date(), hasGithubAuth: false });
  m.account.mockResolvedValue({ id: 'qa-account' });
  m.pending.mockResolvedValue({ id: 'qa-pending', token, userId: 'qa-owner', provider: 'github', expires: new Date(Date.now() + 60_000) });
  m.removePending.mockResolvedValue({ count: 1 }); m.mail.mockResolvedValue(undefined);
});

describe('OAuth link mutations', () => {
  it.each([null, { user: { id: 'demo_qa' } }])('denies absent/demo actor without sending or updating', async session => {
    m.auth.mockResolvedValue(session);
    expect((await resendOauthConfirmation('github')).ok).toBe(false);
    expect((await confirmOauthLink({ token, deny: false })).ok).toBe(false);
    expect((await unlinkOauthProvider('github')).ok).toBe(false);
    expect(m.transaction).not.toHaveBeenCalled(); expect(m.mail).not.toHaveBeenCalled();
  });
  it('fails closed when durable throttle denies attempts', async () => {
    m.limit.mockResolvedValue(false);
    expect((await resendOauthConfirmation('github')).ok).toBe(false); expect(m.transaction).not.toHaveBeenCalled();
  });
  it.each(['__proto__', 'constructor', { provider: 'github', email: 'attacker@example.test' }])('rejects invalid provider payload', async value => {
    expect((await resendOauthConfirmation(value)).ok).toBe(false); expect((await unlinkOauthProvider(value)).ok).toBe(false);
    expect(m.auth).not.toHaveBeenCalled();
  });
  it('sends only to the account email, rotates token, never returns it', async () => {
    const result = await resendOauthConfirmation('github');
    expect(result).toEqual({ ok: true, provider: 'github' });
    expect(m.mail).toHaveBeenCalledWith('qa@example.test', expect.objectContaining({ provider: 'github', userName: 'QA' }));
    const saved = m.upsert.mock.calls[0][0];
    expect(saved.create.token).toBe(saved.update.token); expect(saved.create.token).toMatch(/^[a-f0-9-]{36}$/);
    expect(JSON.stringify(result)).not.toContain(saved.create.token);
  });
  it('does not send to missing/disconnected or already verified accounts', async () => {
    m.account.mockResolvedValue(null); expect((await resendOauthConfirmation('github')).ok).toBe(false);
    m.account.mockResolvedValue({ id: 'qa' }); m.user.mockResolvedValue({ email: 'qa@example.test', hasGithubAuth: true });
    expect(await resendOauthConfirmation('github')).toEqual({ ok: true, provider: 'github', verified: true }); expect(m.mail).not.toHaveBeenCalled();
  });
  it('reports provider failure safely and cleans up only its own token', async () => {
    m.mail.mockRejectedValue(new Error('secret provider diagnostic'));
    const result = await resendOauthConfirmation('github');
    expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain('secret');
    expect(m.removePending).toHaveBeenCalledWith({ where: { userId: 'qa-owner', provider: 'github', token: m.upsert.mock.calls[0][0].create.token } });
  });
  it.each(['other-owner', 'expired', 'unknown-provider', 'missing-account', 'consumed'])('rejects %s without trusting a link', async reason => {
    if (reason === 'other-owner') m.pending.mockResolvedValue({ userId: 'other' });
    if (reason === 'expired') m.pending.mockResolvedValue({ userId: 'qa-owner', expires: new Date(0) });
    if (reason === 'unknown-provider') m.pending.mockResolvedValue({ userId: 'qa-owner', expires: new Date(Date.now()+10000), provider: '__proto__' });
    if (reason === 'missing-account') m.account.mockResolvedValue(null);
    if (reason === 'consumed') m.removePending.mockResolvedValue({ count: 0 });
    expect((await confirmOauthLink({ token, deny: false })).ok).toBe(false);
    expect(m.update).not.toHaveBeenCalled(); expect(m.recalc).not.toHaveBeenCalled();
  });
  it('consumes and verifies within a locked transaction', async () => {
    expect(await confirmOauthLink({ token, deny: false })).toEqual({ ok: true, provider: 'github', verified: true });
    expect(m.lock).toHaveBeenCalled(); expect(m.removePending).toHaveBeenCalledWith({ where: { id: 'qa-pending', token, userId: 'qa-owner' } });
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'qa-owner' }, data: { hasGithubAuth: true }, select: { id: true } });
    expect(m.recalc).toHaveBeenCalledWith('qa-owner');
  });
  it('denial removes only the pending owner/provider and clears its flag', async () => {
    expect((await confirmOauthLink({ token, deny: true })).ok).toBe(true);
    expect(m.removeAccount).toHaveBeenCalledWith({ where: { userId: 'qa-owner', provider: 'github' } });
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'qa-owner' }, data: { hasGithubAuth: false }, select: { id: true } });
  });
  it('keeps the last sign-in method for unlink and denial', async () => {
    m.user.mockResolvedValue({ password: null, emailVerified: new Date() });
    m.account.mockImplementation(({ where }) => Promise.resolve(typeof where.provider === 'string' ? { id: 'qa' } : null));
    expect(await unlinkOauthProvider('github')).toMatchObject({ ok: false, error: expect.stringContaining('at least one sign-in') });
    expect((await confirmOauthLink({ token, deny: true })).ok).toBe(false);
    expect(m.removeAccount).not.toHaveBeenCalled(); expect(m.removePending).not.toHaveBeenCalled();
  });
  it('unlinks with a remaining password method atomically', async () => {
    expect(await unlinkOauthProvider('github')).toEqual({ ok: true, provider: 'github' });
    expect(m.lock).toHaveBeenCalled(); expect(m.removeAccount).toHaveBeenCalledOnce(); expect(m.update).toHaveBeenCalledOnce();
  });
});

describe('OAuth link HTTP boundaries', () => {
  it.each(['', '&deny=1'])('GET is read-only even with a valid token %s', async intent => {
    const res = await GET(new NextRequest(`http://localhost:3000/api/auth/confirm-oauth-link?token=${token}${intent}`));
    expect(res.status).toBe(303); expect(res.headers.get('location')).toContain('/settings?section=verification&oauthToken=');
    expect(res.headers.get('cache-control')).toBe('no-store'); expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(m.transaction).not.toHaveBeenCalled(); expect(m.auth).not.toHaveBeenCalled();
  });
  it('does not propagate malformed tokens', async () => {
    const res = await GET(new NextRequest('http://localhost:3000/api/auth/confirm-oauth-link?token=bad'));
    expect(res.headers.get('location')).toContain('oauthConfirm=invalid'); expect(res.headers.get('location')).not.toContain('bad');
  });
  it.each([null, 'https://attacker.invalid'])('rejects cross-origin or missing Origin %s', async origin => {
    const res = await POST(new NextRequest('http://localhost:3000/api/auth/unlink-oauth', { method: 'POST', headers: origin ? { origin } : {}, body: JSON.stringify({ provider: 'github' }) }));
    expect(res.status).toBe(403); expect(m.auth).not.toHaveBeenCalled();
  });
});
