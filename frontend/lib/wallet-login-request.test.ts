/** @fileOverview Public wallet login rejects forged hosts, cookies and malformed proofs. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ issue: vi.fn(), prepare: vi.fn(), limit: vi.fn(), mail: vi.fn() }));
vi.mock('@/lib/db', () => ({ dbPrisma: {} }));
vi.mock('@/lib/wallet-login', () => ({ createWalletLoginChallenge: m.issue, prepareWalletLogin: m.prepare, WALLET_LOGIN_TTL: 600000 }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: m.limit, AUTH_RETRY_MESSAGE: 'Try later' }));
vi.mock('@/lib/mail', () => ({ sendTwoFactorTokenEmail: m.mail }));
import { POST as nonce } from '@/app/api/auth/wallet/nonce/route';
import { POST as prepare } from '@/app/api/auth/wallet/prepare/route';
import { walletLoginContext, walletLoginCookieName } from '@/lib/wallet-login-request';
const address = '0x' + '1'.repeat(40), browser = 'b'.repeat(64), origin = 'http://localhost:3000';
const body = { challengeId: 'qa-proof', signature: '0x' + '1'.repeat(130) };
const request = (data: unknown, options: { origin?: string | null; site?: string; cookie?: string | null } = {}) => {
  const site = options.site || origin;
  return new Request(`${site}/api/auth/wallet/nonce`, { method: 'POST', headers: {
    'content-type': 'application/json', ...(options.origin === null ? {} : { origin: options.origin ?? site }),
    ...(options.cookie === null ? {} : { cookie: options.cookie ?? `${walletLoginCookieName(site)}=${browser}` }),
  }, body: JSON.stringify(data) });
};
beforeEach(() => { vi.resetAllMocks(); m.limit.mockResolvedValue(true); m.issue.mockResolvedValue({ challengeId: 'qa', message: 'message', expires: 'expiry' }); });
it.each([null, 'null', 'http://localhost:3100', 'https://attacker.test'])('rejects Origin %s before touching identity or sending mail', async value => {
  for (const route of [nonce, prepare]) {
    const result = await route(request(body, { origin: value }));
    expect(result.status).toBe(403); expect(result.headers.get('cache-control')).toBe('private, no-store');
  }
  expect(m.issue).not.toHaveBeenCalled(); expect(m.prepare).not.toHaveBeenCalled(); expect(m.mail).not.toHaveBeenCalled();
});
it.each(['http://localhost:3000', 'https://preview.example.test', 'https://www.veggat.com'])('issues an HttpOnly host-bound cookie on %s', async site => {
  const result = await nonce(request({ address, chainId: 8453 }, { site, cookie: null }));
  expect(result.status).toBe(201); const cookie = result.headers.get('set-cookie')!;
  expect(cookie).toContain(walletLoginCookieName(site)); expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('SameSite=lax'); expect(cookie).toContain('Path=/');
  expect(cookie.includes('Secure')).toBe(site.startsWith('https:'));
  expect(m.issue).toHaveBeenCalledWith(expect.objectContaining({ origin: site, address, chainId: 8453, browser: expect.stringMatching(/^[a-f0-9]{64}$/) }));
});
it.each([null, 'veggat.wallet-login=short', `veggat.wallet-login=${browser}; veggat.wallet-login=${browser}`])('refuses absent, short or duplicate browser cookies', async cookie => {
  expect((await prepare(request(body, { cookie }))).status).toBe(401); expect(m.prepare).not.toHaveBeenCalled();
});
it.each([{ address }, { address, chainId: -1 }, { address, chainId: 1, userId: 'other' }, { address: 'fake', chainId: 1 }])('rejects invalid nonce input %j', async data => {
  expect((await nonce(request(data))).status).toBe(400); expect(m.issue).not.toHaveBeenCalled();
});
it('enforces durable rate limits on both routes', async () => {
  m.limit.mockResolvedValue(false);
  expect((await nonce(request({ address, chainId: 1 }))).status).toBe(429);
  expect((await prepare(request(body))).status).toBe(429);
  expect(m.prepare).not.toHaveBeenCalled(); expect(m.issue).not.toHaveBeenCalled();
});
it('does not return the private email or one-time code', async () => {
  m.prepare.mockResolvedValue({ twoFactor: true, email: 'qa@example.test', code: '123456' });
  expect(await (await prepare(request(body))).json()).toEqual({ twoFactor: true });
  expect(m.mail).toHaveBeenCalledWith('qa@example.test', '123456');
});
it('rejects malformed signatures and supplied user ids', async () => {
  for (const data of [{ ...body, signature: '0x123' }, { ...body, userId: 'other' }, { ...body, code: '123456' }]) expect((await prepare(request(data))).status).toBe(400);
  expect(m.prepare).not.toHaveBeenCalled();
});
it('sanitizes mail failure and never treats it as ready', async () => {
  m.prepare.mockResolvedValue({ email: 'qa@example.test', code: '123456' }); m.mail.mockRejectedValue(new Error('SECRET provider payload'));
  const result = await prepare(request(body)); expect(result.status).toBe(503);
  expect(JSON.stringify(await result.json())).not.toMatch(/SECRET|123456|qa@example/);
});
it('binds callbacks to the same browser even when a proof id is known', () => {
  expect(walletLoginContext(request(body))).toEqual({ origin, browser });
  expect(() => walletLoginContext(request(body, { cookie: null }))).toThrow();
});
