/** @fileOverview Wallet mutation boundary regressions, with no mail or database writes. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
const m = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), create: vi.fn(), verify: vi.fn(), mail: vi.fn(), linked: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: m.limit, getClientIdentifier: () => 'qa-ip', rateLimitedResponse: () => NextResponse.json({}, { status: 429 }) }));
vi.mock('@/lib/wallet-link', () => ({ createWalletLinkChallenge: m.create, verifyWalletLink: m.verify, WalletLinkError: class extends Error {} }));
vi.mock('@/lib/mail', () => ({ sendTwoFactorTokenEmail: m.mail, sendWalletLinkedEmail: m.linked }));
vi.mock('@/lib/verification-recalc', () => ({ recalculateVerificationTier: vi.fn() }));
import { POST as challenge } from '@/app/api/wallets/evm/challenge/route';
import { POST as verify } from '@/app/api/wallets/evm/verify/route';
const body = { address: '0x' + '1'.repeat(40), chainId: 1 };
function request(payload: unknown, origin: string | null = 'http://localhost:3000') {
  return new NextRequest('http://localhost:3000/api/wallets/evm/challenge', { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(payload) });
}
beforeEach(() => { vi.resetAllMocks(); m.auth.mockResolvedValue({ id: 'qa-owner' }); m.limit.mockResolvedValue({ success: true }); });
it.each([null, 'null', 'https://attacker.example', 'http://localhost:3100'])('rejects origin %s before authentication or writes', async origin => {
  for (const route of [challenge, verify]) {
    const response = await route(request(body, origin)); expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  }
  expect(m.auth).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled(); expect(m.verify).not.toHaveBeenCalled();
});
it.each([null, { id: 'demo_2026-09-25_qa' }])('refuses anonymous/demo identity', async user => {
  m.auth.mockResolvedValue(user);
  for (const route of [challenge, verify]) expect((await route(request(body))).status).toBe(user ? 403 : 401);
  expect(m.create).not.toHaveBeenCalled(); expect(m.verify).not.toHaveBeenCalled();
});
it('refuses direct/client-created messages even with a signature', async () => {
  const response = await verify(request({ ...body, message: 'client-generated proof', signature: '0x' + '1'.repeat(130) }));
  expect(response.status).toBe(400); expect(m.verify).not.toHaveBeenCalled();
});
it.each(['1234560', '１２３４５６', '123', 'abcdef'])('rejects malformed code %s without sending mail', async code => {
  expect((await challenge(request({ ...body, code }))).status).toBe(400); expect(m.mail).not.toHaveBeenCalled();
});
it('rate limits both the IP and user before database writes', async () => {
  m.limit.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false });
  const response = await challenge(request(body)); expect(response.status).toBe(429);
  expect(response.headers.get('cache-control')).toContain('no-store'); expect(m.create).not.toHaveBeenCalled();
});
it('never returns the email code or recipient to the browser', async () => {
  m.create.mockResolvedValue({ twoFactor: true, email: 'qa@example.test', code: '123456' });
  expect(await (await challenge(request(body))).json()).toEqual({ twoFactor: true });
  expect(m.mail).toHaveBeenCalledWith('qa@example.test', '123456');
});
