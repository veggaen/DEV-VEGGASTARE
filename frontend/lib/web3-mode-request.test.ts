/** @fileOverview Web3 request boundaries; no mail or persistent account writes. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), change: vi.fn(), mail: vi.fn(), read: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { user: { findUnique: m.read } } }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: m.limit, AUTH_RETRY_MESSAGE: 'Please retry later.' }));
vi.mock('@/lib/web3-mode', () => ({ changeWeb3Mode: m.change }));
vi.mock('@/lib/mail', () => ({ sendTwoFactorTokenEmail: m.mail }));
import { GET, PATCH } from '@/app/api/settings/web3-mode/route';
import { MyConfirmSecurityAction, MyRequestWeb3ModeSecurityAction } from '@/actions/security-action';
const request = (body: unknown = { enabled: false, expectedEnabled: true }, origin: string | null = 'http://localhost:3000') => new Request('http://localhost:3000/api/settings/web3-mode', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body),
});
beforeEach(() => { vi.resetAllMocks(); m.auth.mockResolvedValue({ id: 'qa-owner' }); m.limit.mockResolvedValue(true); m.read.mockResolvedValue({ web3ModeEnabled: true }); });
it.each([null, 'null', 'http://localhost:3100', 'https://attacker.example'])('denies origin %s before reading identity', async origin => {
  expect((await PATCH(request(undefined, origin))).status).toBe(403); expect(m.auth).not.toHaveBeenCalled(); expect(m.change).not.toHaveBeenCalled();
});
it.each([null, { id: 'demo_fixture' }])('rejects anonymous or demo writes', async user => {
  m.auth.mockResolvedValue(user); expect((await PATCH(request())).status).toBe(user ? 403 : 401); expect(m.change).not.toHaveBeenCalled();
});
it.each([{}, null, [], { enabled: true }, { enabled: true, expectedEnabled: false, userId: 'other' }, { enabled: true, expectedEnabled: false, code: '1234560' }, { enabled: true, expectedEnabled: false, code: '１２３４５６' }])('rejects malformed %j', async body => {
  expect((await PATCH(request(body))).status).toBe(400); expect(m.change).not.toHaveBeenCalled();
});
it('fails closed on durable rate limit refusal', async () => {
  m.limit.mockResolvedValue(false); expect((await PATCH(request())).status).toBe(429); expect(m.change).not.toHaveBeenCalled();
});
it('returns only a code prompt, never the recipient or code', async () => {
  m.change.mockResolvedValue({ twoFactor: true, email: 'qa@example.test', code: '123456' });
  const response = await PATCH(request()); expect(await response.json()).toEqual({ twoFactor: true });
  expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(m.mail).toHaveBeenCalledWith('qa@example.test', '123456');
});
it('forwards current state, action and host to the transaction', async () => {
  m.change.mockResolvedValue({ success: true, web3ModeEnabled: false });
  expect(await (await PATCH(request({ enabled: false, expectedEnabled: true, code: '654321' }))).json()).toEqual({ success: true, web3ModeEnabled: false });
  expect(m.change).toHaveBeenCalledWith({ userId: 'qa-owner', origin: 'http://localhost:3000', enabled: false, expectedEnabled: true, code: '654321' });
});
it('GET returns authoritative private state without changing anything', async () => {
  const response = await GET(); expect(await response.json()).toEqual({ web3ModeEnabled: true });
  expect(response.headers.get('cache-control')).toContain('no-store'); expect(m.change).not.toHaveBeenCalled(); expect(m.mail).not.toHaveBeenCalled();
  m.read.mockResolvedValue(null); expect((await GET()).status).toBe(401);
});
it('legacy actions never read tokens, send mail or mutate accounts', async () => {
  expect(await MyConfirmSecurityAction()).toHaveProperty('error'); expect(await MyRequestWeb3ModeSecurityAction()).toHaveProperty('error');
  expect(m.change).not.toHaveBeenCalled(); expect(m.auth).not.toHaveBeenCalled(); expect(m.mail).not.toHaveBeenCalled();
});
