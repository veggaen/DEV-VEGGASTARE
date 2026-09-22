/** @fileOverview Recovery token replay, revocation, and second-factor regression tests. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  token: vi.fn(), user: vi.fn(), hash: vi.fn(), allow: vi.fn(),
  resetConsume: vi.fn(), verifyConsume: vi.fn(), update: vi.fn(), magicDelete: vi.fn(), magicCreate: vi.fn(), otpDelete: vi.fn(),
}));
vi.mock('bcryptjs', () => ({ default: { hash: m.hash } }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: m.allow, AUTH_RETRY_MESSAGE: 'Try later' }));
vi.mock('@/data/user', () => ({ getUserByEmail: m.user }));
vi.mock('@/data/password-reset-token', () => ({ getPasswordResetTokenByToken: m.token }));
vi.mock('@/data/verificiation-token', () => ({ getVerificationTokenByToken: m.token }));
vi.mock('@/lib/db', () => ({ dbPrisma: { $transaction: async (callback: (tx: unknown) => unknown) => callback({
  passwordResetToken: { deleteMany: m.resetConsume }, verificationToken: { deleteMany: m.verifyConsume },
  user: { update: m.update }, emailLoginToken: { deleteMany: m.magicDelete, create: m.magicCreate }, twoFactorToken: { deleteMany: m.otpDelete },
}) } }));
import { MyNewPasswordAction } from './new-password';
import { MyNewVerificationAction } from './new-verification';
const token = '643194bd-c63a-4714-afd1-b17621134a9c';

describe('account recovery', () => {
  beforeEach(() => {
    vi.resetAllMocks(); m.allow.mockResolvedValue(true); m.hash.mockResolvedValue('hashed');
    m.token.mockResolvedValue({ id: 'issued-token', email: 'qa@example.test', expires: new Date(Date.now() + 60_000) });
    m.user.mockResolvedValue({ id: 'qa' }); m.update.mockResolvedValue({ id: 'qa', isTwoFactorEnabled: false });
    m.resetConsume.mockResolvedValue({ count: 1 }); m.verifyConsume.mockResolvedValue({ count: 1 });
    m.magicCreate.mockResolvedValue({ token: 'one-time-magic' });
  });
  it('revokes sessions and outstanding sign-in codes when resetting a password', async () => {
    expect(await MyNewPasswordAction({ password: 'Unit-test-password' }, token)).toHaveProperty('success');
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'qa' }, data: { password: 'hashed', tokenVersion: { increment: 1 } } });
    expect(m.magicDelete).toHaveBeenCalled(); expect(m.otpDelete).toHaveBeenCalled();
  });
  it('does not change a password when a concurrent request consumed the token', async () => {
    m.resetConsume.mockResolvedValue({ count: 0 });
    expect(await MyNewPasswordAction({ password: 'Unit-test-password' }, token)).toHaveProperty('error');
    expect(m.update).not.toHaveBeenCalled();
  });
  it('does not verify or grant login on a replay', async () => {
    m.verifyConsume.mockResolvedValue({ count: 0 });
    expect(await MyNewVerificationAction(token)).toHaveProperty('error');
    expect(m.update).not.toHaveBeenCalled(); expect(m.magicCreate).not.toHaveBeenCalled();
  });
  it('does not bypass two-factor authentication after verification', async () => {
    m.update.mockResolvedValue({ isTwoFactorEnabled: true });
    const result = await MyNewVerificationAction(token);
    expect(result).toHaveProperty('success'); expect(result).not.toHaveProperty('loginToken');
    expect(m.magicCreate).not.toHaveBeenCalled();
  });
  it('fails closed when the durable limiter is unavailable', async () => {
    m.allow.mockResolvedValue(false);
    expect(await MyNewPasswordAction({ password: 'Unit-test-password' }, token)).toHaveProperty('error');
    expect(m.token).not.toHaveBeenCalled();
  });
});
