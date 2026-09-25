/** @fileOverview Seller payout ownership and demo isolation. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), rate: vi.fn(), update: vi.fn(), wallet: vi.fn(), company: vi.fn(), mail: vi.fn(), token: vi.fn(), payout: vi.fn(), origin: vi.fn(), codeMail: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/data/user', () => ({ getUserById: m.user }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: m.rate }));
vi.mock('@/lib/db', () => ({ dbPrisma: { user: { update: m.update }, company: { findUnique: m.company, update: m.update }, wallet: { findUnique: m.wallet }, paypalVerificationToken: { upsert: m.token, deleteMany: vi.fn().mockResolvedValue({ count: 0 }) } } }));
vi.mock('@/lib/mail', () => ({ sendPaypalVerificationEmail: m.mail, sendTwoFactorTokenEmail: m.codeMail }));
vi.mock('@/lib/payout-wallet', () => ({ changePayoutWallet: m.payout }));
vi.mock('@/lib/wallet-action-origin', () => ({ walletActionOrigin: m.origin }));
vi.mock('@/lib/wallet-link', () => ({ WalletLinkError: class extends Error {} }));
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn() }) }));
import { removePaypalEmail, savePaypalEmail, setDefaultReceivingWallet, removeDefaultReceivingWallet } from './seller-payment';
import { WalletLinkError } from '@/lib/wallet-link';
const walletId = 'c' + 'a'.repeat(24), companyId = 'c' + 'b'.repeat(24);
beforeEach(() => {
  vi.clearAllMocks(); m.payout.mockReset(); m.origin.mockReset(); m.rate.mockReset(); m.codeMail.mockReset();
  m.auth.mockResolvedValue({ id: 'qa-user' }); m.user.mockResolvedValue({ id: 'qa-user' });
  m.rate.mockResolvedValue({ success: true }); m.update.mockResolvedValue({}); m.token.mockResolvedValue({}); m.mail.mockResolvedValue(undefined);
  m.origin.mockResolvedValue('http://localhost:3000'); m.payout.mockResolvedValue({ ok: true }); m.codeMail.mockResolvedValue(undefined);
});
it('denies demo mutations before database or email side effects', async () => {
  m.auth.mockResolvedValue({ id: 'demo_fixture' });
  expect(await savePaypalEmail({ target: 'user', paypalEmail: 'qa@example.com' })).toHaveProperty('error');
  expect(await removePaypalEmail({ target: 'user' })).toHaveProperty('error');
  expect(await setDefaultReceivingWallet({ target: 'user', walletId })).toHaveProperty('error');
  expect(m.update).not.toHaveBeenCalled(); expect(m.mail).not.toHaveBeenCalled(); expect(m.user).not.toHaveBeenCalled();
});
it('saves a normalized address as unverified and sends verification', async () => {
  expect(await savePaypalEmail({ target: 'user', paypalEmail: 'QA@Example.com' })).toHaveProperty('success');
  expect(m.update).toHaveBeenCalledWith({ where: { id: 'qa-user' }, data: { paypalEmail: 'qa@example.com', paypalEmailVerifiedAt: null } });
  expect(m.mail).toHaveBeenCalledWith('qa@example.com', expect.stringMatching(/^[0-9a-f]{64}$/), 'user', 'qa-user');
});
it('rejects company edits by a non-owner', async () => {
  m.company.mockResolvedValue({ ownerId: 'somebody-else' });
  expect(await savePaypalEmail({ target: 'company', companyId, paypalEmail: 'qa@example.com' })).toHaveProperty('error');
  expect(m.update).not.toHaveBeenCalled(); expect(m.mail).not.toHaveBeenCalled();
});
it('delegates only authenticated identity and validated choices to the transactional service', async () => {
  expect(await setDefaultReceivingWallet({ target: 'user', walletId })).toHaveProperty('success');
  expect(m.payout).toHaveBeenCalledWith({ userId: 'qa-user', origin: 'http://localhost:3000', target: 'user', walletId, action: 'set' });
  expect(m.update).not.toHaveBeenCalled();
  expect(await removeDefaultReceivingWallet({ target: 'company', companyId, expectedWalletId: walletId, code: '654321' })).toHaveProperty('success');
  expect(m.payout).toHaveBeenLastCalledWith({ userId: 'qa-user', origin: 'http://localhost:3000', target: 'company', companyId, expectedWalletId: walletId, code: '654321', action: 'clear' });
});
it.each([null, { id: 'demo_fixture' }])('rejects anonymous/demo wallet changes', async user => {
  m.auth.mockResolvedValue(user);
  expect(await setDefaultReceivingWallet({ target: 'user', walletId })).toHaveProperty('error');
  expect(await removeDefaultReceivingWallet({ target: 'user', expectedWalletId: walletId })).toHaveProperty('error');
  expect(m.payout).not.toHaveBeenCalled(); expect(m.codeMail).not.toHaveBeenCalled();
});
it('requires a reviewed pointer to clear and an exact ASCII code', async () => {
  // @ts-expect-error Exercise untrusted input without the required expected pointer.
  expect(await removeDefaultReceivingWallet({ target: 'user' })).toHaveProperty('error');
  for (const code of ['1234560', 'abc123', '１２３４５６']) expect(await setDefaultReceivingWallet({ target: 'user', walletId, code })).toHaveProperty('error');
  expect(m.payout).not.toHaveBeenCalled();
});
it('rejects a foreign origin and shared wallet rate limit before writes', async () => {
  m.origin.mockRejectedValueOnce(new WalletLinkError('Wrong host', 403));
  expect(await setDefaultReceivingWallet({ target: 'user', walletId })).toEqual({ error: 'Wrong host' });
  m.rate.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false });
  expect(await setDefaultReceivingWallet({ target: 'user', walletId })).toHaveProperty('error');
  expect(m.rate).toHaveBeenCalledWith('wallet-user:qa-user', 'wallet');
  expect(m.payout).not.toHaveBeenCalled();
});
it('returns no code or recipient to the browser', async () => {
  m.payout.mockResolvedValue({ twoFactor: true, email: 'qa@example.test', code: '654321' });
  expect(await setDefaultReceivingWallet({ target: 'user', walletId })).toEqual({ twoFactor: true });
  expect(m.codeMail).toHaveBeenCalledWith('qa@example.test', '654321');
});
it('reports mail failure without claiming the choice changed or leaking provider details', async () => {
  m.payout.mockResolvedValue({ twoFactor: true, email: 'qa@example.test', code: '654321' });
  m.codeMail.mockRejectedValue(new Error('SECRET_PROVIDER_DETAIL'));
  expect(await setDefaultReceivingWallet({ target: 'user', walletId })).toEqual({ error: 'Unable to confirm this change. Refresh payment settings before trying again.' });
});
it('returns an ownership error without direct writes from the action', async () => {
  m.payout.mockRejectedValue(new WalletLinkError('Only the current company owner can change its receiving wallet.', 403));
  expect(await setDefaultReceivingWallet({ target: 'company', companyId, walletId })).toHaveProperty('error');
  expect(m.update).not.toHaveBeenCalled(); expect(m.codeMail).not.toHaveBeenCalled();
});
