import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), headers: vi.fn(), allow: vi.fn(), read: vi.fn(), lockedRead: vi.fn(), update: vi.fn(), lock: vi.fn(),
  compare: vi.fn(), hash: vi.fn(), send: vi.fn(), create: vi.fn(), token: vi.fn(), remove: vi.fn(), reset: vi.fn(), magic: vi.fn(), confirmation: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: m.headers }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: m.allow, AUTH_RETRY_MESSAGE: 'Try later' }));
vi.mock('bcryptjs', () => ({ default: { compare: m.compare, hash: m.hash } }));
vi.mock('@/lib/mail', () => ({ sendAccountSecurityCode: m.send }));
vi.mock('@/lib/db', () => ({ dbPrisma: { user: { findUnique: m.read }, twoFactorToken: { deleteMany: m.remove },
  $transaction: async (run: (tx: unknown) => unknown) => run({ $queryRaw: m.lock, user: { findUnique: m.lockedRead, update: m.update },
    twoFactorToken: { create: m.create, findFirst: m.token, deleteMany: m.remove }, passwordResetToken: { deleteMany: m.reset },
    emailLoginToken: { deleteMany: m.magic }, twoFactorConfirmation: { deleteMany: m.confirmation } }),
} }));
import { settings } from '@/actions/settings';
const user = { id: 'qa-settings', email: 'qa@example.test', emailVerified: new Date('2026-01-01'), password: 'stored-hash', role: 'USER',
  tokenVersion: 3, isTwoFactorEnabled: false, updatedAt: new Date('2026-09-01') };
const passwordChange = { password: 'current-test-password', newPassword: 'new-test-password' };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('AUTH_SECRET', 'unit-test-key-not-a-secret');
  m.auth.mockResolvedValue({ id: user.id, role: 'USER' });
  m.headers.mockResolvedValue(new Headers({ origin: 'http://localhost:3000', host: 'localhost:3000' }));
  m.allow.mockResolvedValue(true); m.read.mockResolvedValue(user); m.lockedRead.mockResolvedValue(user);
  m.compare.mockResolvedValue(true); m.hash.mockResolvedValue('new-hash'); m.remove.mockResolvedValue({ count: 1 }); m.create.mockResolvedValue({ id: 'issued-code' });
});
afterEach(() => vi.unstubAllEnvs());

describe('personal account settings trust boundary', () => {
  it.each([null, { id: 'demo_person' }, { id: user.id, isImpersonating: true }])('rejects unauthorized actor %j', async actor => {
    m.auth.mockResolvedValue(actor); expect(await settings({ name: 'New name' })).toHaveProperty('error'); expect(m.read).not.toHaveBeenCalled();
  });
  it.each([{}, { origin: 'https://other.example', host: 'localhost:3000' }, { origin: 'null', host: 'localhost:3000' },
    { origin: 'http://localhost:3000/path', host: 'localhost:3000' }])('rejects missing/mismatched origin %j', async headers => {
    m.headers.mockResolvedValue(new Headers(Object.entries(headers).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))); expect(await settings({ name: 'New name' })).toHaveProperty('error'); expect(m.read).not.toHaveBeenCalled();
  });
  it('fails closed on durable rate limit failure', async () => {
    m.allow.mockResolvedValue(false); expect(await settings({ name: 'New name' })).toEqual({ error: 'Try later' }); expect(m.read).not.toHaveBeenCalled();
  });
  it.each([{ tokenVersion: 0 }, { id: 'other' }, { emailVerified: new Date() }, { verificationScore: 100 }, { Account: { deleteMany: {} } },
    { paypalEmail: 'attacker@example.test' }, { name: 'x'.repeat(101) }, { newPassword: 'a'.repeat(73), password: 'old' },
    { newPassword: '💚'.repeat(30), password: 'old' }, { newPassword: 'long-enough' }, { isTwoFactorEnabled: true }, null])('rejects unsafe fields before a database read %j', async raw => {
    expect(await settings(raw)).toHaveProperty('error'); expect(m.read).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
  });
  it.each(['USER','ADMIN','OWNER'])('never changes a %s role through personal settings', async role => {
    m.read.mockResolvedValue({ ...user, role }); expect(await settings({ name: 'QA', role: role === 'OWNER' ? 'USER' : 'OWNER' })).toHaveProperty('error'); expect(m.update).not.toHaveBeenCalled();
  });
  it('accepts unchanged legacy role but writes only explicit profile preferences', async () => {
    const raw = Object.freeze({ name: ' New name ', role: 'USER', email: 'QA@example.test', emailDisplayMode: 'HIDE' });
    expect(await settings(raw)).toEqual({ success: 'Settings saved.' });
    expect(m.update.mock.calls[0][0]).toEqual({ where: { id: user.id }, data: { name: 'New name', emailDisplayMode: 'HIDE', updatedAt: expect.any(Date) }, select: { id: true } });
    expect(m.hash).not.toHaveBeenCalled(); expect(m.send).not.toHaveBeenCalled(); expect(m.reset).not.toHaveBeenCalled();
  });
  it('does not send a registration token or directly replace a login email', async () => {
    expect(await settings({ email: 'different@example.test' })).toMatchObject({ error: expect.stringContaining('email has not changed') });
    expect(m.send).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
  });
  it('cannot write a current password as plaintext', async () => {
    expect(await settings({ password: 'raw-password' })).toHaveProperty('error'); expect(m.update).not.toHaveBeenCalled();
  });
  it('rejects an incorrect current password', async () => {
    m.compare.mockResolvedValue(false); expect(await settings(passwordChange)).toHaveProperty('error'); expect(m.hash).not.toHaveBeenCalled();
  });
  it('hashes a verified password and revokes sessions and unused sign-in proofs atomically', async () => {
    expect(await settings(passwordChange)).toMatchObject({ signInRequired: true }); expect(m.compare).toHaveBeenCalledWith(passwordChange.password, user.password);
    expect(m.hash).toHaveBeenCalledWith(passwordChange.newPassword, 12);
    expect(m.update.mock.calls[0][0].data).toEqual({ password: 'new-hash', tokenVersion: { increment: 1 }, updatedAt: expect.any(Date) });
    expect(m.reset).toHaveBeenCalledWith({ where: { email: user.email } }); expect(m.magic).toHaveBeenCalled(); expect(m.confirmation).toHaveBeenCalledWith({ where: { userId: user.id } });
  });
  it.each([{ role: 'ADMIN' }, { password: 'changed-hash' }, { tokenVersion: 4 }, { email: 'other@example.test' },
    { updatedAt: new Date('2026-09-02') }, { isTwoFactorEnabled: true }])('rejects a concurrent account change %j', async changed => {
    m.lockedRead.mockResolvedValue({ ...user, ...changed }); expect(await settings(passwordChange)).toHaveProperty('error'); expect(m.update).not.toHaveBeenCalled();
  });
  it('does not apply a stale two-factor toggle', async () => {
    expect(await settings({ isTwoFactorEnabled: false, expectedTwoFactorEnabled: true })).toHaveProperty('error'); expect(m.update).not.toHaveBeenCalled();
  });
  it('does not create a password without a current password', async () => {
    m.read.mockResolvedValue({ ...user, password: null }); expect(await settings(passwordChange)).toHaveProperty('error'); expect(m.update).not.toHaveBeenCalled();
  });
  it.each([null, ''])('does not enable email security without a verified email (%s)', async email => {
    m.read.mockResolvedValue({ ...user, email, emailVerified: null });
    expect(await settings({ password: 'current', isTwoFactorEnabled: true, expectedTwoFactorEnabled: false })).toHaveProperty('error'); expect(m.send).not.toHaveBeenCalled();
  });
  it('requires an action-bound code to enable the factor, without writing or returning the code', async () => {
    const result = await settings({ password: 'current', isTwoFactorEnabled: true, expectedTwoFactorEnabled: false });
    expect(result).toEqual({ twoFactor: true }); expect(m.send).toHaveBeenCalledWith(user.email, expect.stringMatching(/^\d{6}$/)); expect(m.update).not.toHaveBeenCalled();
    const token = m.create.mock.calls[0][0].data; expect(token.email).toMatch(/^account-settings:qa-settings:[a-f0-9]{64}$/); expect(token.token).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain(m.send.mock.calls[0][1]); expect(JSON.stringify(token)).not.toContain('current');
  });
  it('requires a code when changing password with existing two-factor authentication', async () => {
    m.read.mockResolvedValue({ ...user, isTwoFactorEnabled: true }); m.lockedRead.mockResolvedValue({ ...user, isTwoFactorEnabled: true });
    expect(await settings(passwordChange)).toEqual({ twoFactor: true }); expect(m.update).not.toHaveBeenCalled();
  });
  it('confirms a code only for the exact saved change', async () => {
    const input = { password: 'current', isTwoFactorEnabled: true, expectedTwoFactorEnabled: false };
    await settings(input); const record = m.create.mock.calls[0][0].data, code = m.send.mock.calls[0][1]; m.token.mockResolvedValue({ ...record, id: 'issued-code' });
    expect(await settings({ ...input, securityCode: code })).toMatchObject({ signInRequired: true });
    expect(m.update.mock.calls[0][0].data.isTwoFactorEnabled).toBe(true);
    expect(m.remove).toHaveBeenCalledWith({ where: { id: 'issued-code', token: record.token, expires: { gt: expect.any(Date) } } });
  });
  it('does not reuse a code for a different password or host', async () => {
    const secured = { ...user, isTwoFactorEnabled: true }; m.read.mockResolvedValue(secured); m.lockedRead.mockResolvedValue(secured);
    await settings(passwordChange); m.token.mockResolvedValue({ ...m.create.mock.calls[0][0].data, id: 'issued-code' }); const code = m.send.mock.calls[0][1];
    expect(await settings({ ...passwordChange, newPassword: 'another-password', securityCode: code })).toHaveProperty('error');
    m.headers.mockResolvedValue(new Headers({ origin: 'https://www.veggat.com', host: 'www.veggat.com' }));
    expect(await settings({ ...passwordChange, securityCode: code })).toHaveProperty('error'); expect(m.update).not.toHaveBeenCalled();
  });
  it('rejects a consumed/expired code', async () => {
    const input = { password: 'current', isTwoFactorEnabled: true, expectedTwoFactorEnabled: false };
    await settings(input); m.token.mockResolvedValue({ ...m.create.mock.calls[0][0].data, id: 'issued-code' }); m.remove.mockResolvedValue({ count: 0 });
    expect(await settings({ ...input, securityCode: m.send.mock.calls[0][1] })).toHaveProperty('error'); expect(m.update).not.toHaveBeenCalled();
  });
  it('removes only its failed email challenge and does not claim an update', async () => {
    m.send.mockRejectedValue(new Error('private-provider-data'));
    expect(await settings({ password: 'current', isTwoFactorEnabled: true, expectedTwoFactorEnabled: false })).toMatchObject({ error: expect.stringContaining('Nothing changed') });
    expect(m.remove).toHaveBeenCalledWith({ where: { id: 'issued-code' } }); expect(m.update).not.toHaveBeenCalled();
  });
  it.each(['auth','read','lockedRead','update','hash'] as const)('does not disclose %s exceptions', async source => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {}); m[source].mockRejectedValue(new Error('private-error-marker'));
    try { const result = await settings(passwordChange); expect(result).toHaveProperty('error'); expect(JSON.stringify(result)).not.toContain('private-error-marker'); expect(spy).not.toHaveBeenCalled(); } finally { spy.mockRestore(); }
  });
});
