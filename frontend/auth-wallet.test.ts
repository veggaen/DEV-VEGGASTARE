/** @fileOverview Wallet credentials enforce request binding before identity lookup. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
import type { CredentialsConfig } from 'next-auth/providers/credentials';
const m = vi.hoisted(() => ({ login: vi.fn(), limit: vi.fn() }));
vi.mock('@/lib/db', () => ({ dbPrisma: {} }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: m.limit }));
vi.mock('@/lib/wallet-login', () => ({ authenticateWalletLogin: m.login }));
vi.mock('./data/user', () => ({ getUserByEmail: vi.fn() }));
vi.mock('./lib/tokens', () => ({ getEmailLoginTokenByToken: vi.fn() }));
import config from './auth.config';
// Auth.js merges provider.options during normalization; exercise that supplied callback.
const provider = config.providers.map(p => p as unknown as { options?: Partial<CredentialsConfig> }).find(p => p.options?.id === 'wallet')!;
const authorize = provider.options!.authorize!;
const origin = 'http://localhost:3000', browser = 'a'.repeat(64);
const credentials = { challengeId: 'qa', signature: '0x' + '1'.repeat(130) };
const request = (cookie = `veggat.wallet-login=${browser}`, site = origin) => new Request(`${origin}/api/auth/callback/wallet`, { method: 'POST', headers: { origin: site, cookie } });
beforeEach(() => { vi.resetAllMocks(); m.limit.mockResolvedValue(true); m.login.mockResolvedValue({ id: 'qa-user' }); });
it('uses the verified proof and server request, not a claimed address or user id', async () => {
  expect(await authorize({ ...credentials, userId: 'attacker', address: 'fake' }, request())).toEqual({ id: 'qa-user' });
  expect(m.login).toHaveBeenCalledWith({ ...credentials, origin, browser, code: undefined });
});
it.each(['', 'veggat.wallet-login=short'])('refuses a missing or malformed cookie', async cookie => {
  expect(await authorize(credentials, request(cookie))).toBeNull(); expect(m.login).not.toHaveBeenCalled();
});
it('refuses a cross-host callback', async () => {
  expect(await authorize(credentials, request(`veggat.wallet-login=${browser}`, 'https://attacker.test'))).toBeNull(); expect(m.login).not.toHaveBeenCalled();
});
it.each(['1234560', '１２３４５６', 123456, null])('refuses a malformed code %s', async code => {
  expect(await authorize({ ...credentials, code }, request())).toBeNull(); expect(m.login).not.toHaveBeenCalled();
});
it('passes an exact code, fails closed on throttling and on transactional failure', async () => {
  await authorize({ ...credentials, code: '123456' }, request()); expect(m.login).toHaveBeenLastCalledWith(expect.objectContaining({ code: '123456' }));
  m.limit.mockResolvedValue(false); expect(await authorize(credentials, request())).toBeNull(); expect(m.login).toHaveBeenCalledTimes(1);
  m.limit.mockResolvedValue(true); m.login.mockRejectedValue(new Error('private database payload'));
  expect(await authorize(credentials, request())).toBeNull();
});
