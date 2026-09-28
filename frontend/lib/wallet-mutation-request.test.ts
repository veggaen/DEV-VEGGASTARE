/** @fileOverview Wallet change boundary checks without mail or database writes. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
const m = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), change: vi.fn(), mail: vi.fn(), linked: vi.fn(), recalc: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: {} }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: m.limit, getClientIdentifier: () => 'qa-ip', rateLimitedResponse: () => NextResponse.json({}, { status: 429 }) }));
vi.mock('@/lib/wallet-mutation', () => ({ mutateWallet: m.change }));
vi.mock('@/lib/mail', () => ({ sendTwoFactorTokenEmail: m.mail, sendWalletLinkedEmail: m.linked }));
vi.mock('@/lib/verification-recalc', () => ({ recalculateVerificationTier: m.recalc }));
import { PATCH, DELETE } from '@/app/api/wallets/evm/[walletId]/route';
const ctx = { params: Promise.resolve({ walletId: 'qa-wallet' }) };
const request = (body: unknown, method = 'PATCH', origin: string | null = 'http://localhost:3000') => new NextRequest('http://localhost:3000/api/wallets/evm/qa-wallet', {
  method, headers: { 'Content-Type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body),
});
beforeEach(() => { vi.resetAllMocks(); m.auth.mockResolvedValue({ id: 'qa-owner' }); m.limit.mockResolvedValue({ success: true }); });
it.each([null, 'null', 'https://attacker.example', 'http://localhost:3100'])('refuses cross-origin %s', async origin => {
  for (const [method, route] of [['PATCH', PATCH], ['DELETE', DELETE]] as const) {
    const res = await route(request({}, method, origin), ctx);
    expect(res.status).toBe(403); expect(res.headers.get('cache-control')).toContain('no-store');
  }
  expect(m.auth).not.toHaveBeenCalled(); expect(m.change).not.toHaveBeenCalled();
});
it.each([null, { id: 'demo_2026-09-25_qa' }])('refuses anonymous and demo identities', async user => {
  m.auth.mockResolvedValue(user);
  for (const route of [PATCH, DELETE]) expect((await route(request({}), ctx)).status).toBe(user ? 403 : 401);
  expect(m.change).not.toHaveBeenCalled();
});
it.each([{ action: 'rename', label: '' }, { action: 'rename', label: 'x'.repeat(65) }, { action: 'oops' },
  { label: 'New name' }, { action: 'rename' }, { action: 'setPrimary', ownerUserId: 'other' },
  { code: '1234560' }, { code: '１２３４５６' }, { code: '123' }, null, []])('rejects malformed PATCH %j instead of making it primary', async body => {
  expect((await PATCH(request(body), ctx)).status).toBe(400); expect(m.change).not.toHaveBeenCalled(); expect(m.mail).not.toHaveBeenCalled();
});
it('requires strict DELETE code shape', async () => {
  expect((await DELETE(request({ action: 'rename', label: 'Other' }, 'DELETE'), ctx)).status).toBe(400);
  expect(m.change).not.toHaveBeenCalled();
});
it('preserves explicit rename and exact legacy code-only actions', async () => {
  m.change.mockResolvedValue({ ok: true });
  expect((await PATCH(request({ action: 'rename', label: '  Savings  ' }), ctx)).status).toBe(200);
  expect(m.change).toHaveBeenLastCalledWith({ userId: 'qa-owner', origin: 'http://localhost:3000', walletId: 'qa-wallet', action: 'rename', label: 'Savings' });
  expect((await PATCH(request({ code: '123456' }), ctx)).status).toBe(200);
  expect(m.change).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'setPrimary', code: '123456' }));
});
it('checks both user and IP rate limits', async () => {
  m.limit.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false });
  expect((await PATCH(request({}), ctx)).status).toBe(429); expect(m.change).not.toHaveBeenCalled();
});
it('returns no email code or recipient', async () => {
  m.change.mockResolvedValue({ twoFactor: true, email: 'qa@example.test', code: '123456' });
  expect(await (await PATCH(request({ action: 'setPrimary' }), ctx)).json()).toEqual({ twoFactor: true });
  expect(m.mail).toHaveBeenCalledWith('qa@example.test', '123456');
});
it('post-commit cache failure does not report removal failure', async () => {
  m.change.mockResolvedValue({ ok: true, user: { id: 'qa-owner', email: 'qa@example.test', name: 'QA' }, wallet: { address: 'qa', chainId: 1 } });
  m.recalc.mockRejectedValue(new Error('offline')); m.linked.mockResolvedValue(undefined);
  expect((await DELETE(request({}, 'DELETE'), ctx)).status).toBe(200); expect(m.linked).toHaveBeenCalledTimes(1);
});
