/** @fileOverview Seller payout ownership and demo isolation. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), rate: vi.fn(), update: vi.fn(), wallet: vi.fn(), company: vi.fn(), mail: vi.fn(), token: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/data/user', () => ({ getUserById: m.user }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: m.rate }));
vi.mock('@/lib/db', () => ({ dbPrisma: { user: { update: m.update }, company: { findUnique: m.company, update: m.update }, wallet: { findUnique: m.wallet }, paypalVerificationToken: { upsert: m.token, deleteMany: vi.fn().mockResolvedValue({ count: 0 }) } } }));
vi.mock('@/lib/mail', () => ({ sendPaypalVerificationEmail: m.mail }));
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn() }) }));
import { removePaypalEmail, savePaypalEmail, setDefaultReceivingWallet } from './seller-payment';
const walletId = 'c' + 'a'.repeat(24), companyId = 'c' + 'b'.repeat(24);
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ id: 'qa-user' }); m.user.mockResolvedValue({ id: 'qa-user' });
  m.rate.mockResolvedValue({ success: true }); m.update.mockResolvedValue({}); m.token.mockResolvedValue({}); m.mail.mockResolvedValue(undefined);
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
it.each([{ ownerUserId: 'qa-user', verifiedAt: null }, { ownerUserId: 'other-user', verifiedAt: new Date() }])('rejects an unverified or unowned payout wallet', async wallet => {
  m.wallet.mockResolvedValue({ id: walletId, address: '0x1', ...wallet });
  expect(await setDefaultReceivingWallet({ target: 'user', walletId })).toHaveProperty('error');
  expect(m.update).not.toHaveBeenCalled();
});
it('saves only the signed-in user’s verified payout wallet', async () => {
  m.wallet.mockResolvedValue({ id: walletId, address: '0x0000000000000000000000000000000000000001', ownerUserId: 'qa-user', verifiedAt: new Date() });
  expect(await setDefaultReceivingWallet({ target: 'user', walletId })).toHaveProperty('success');
  expect(m.update).toHaveBeenCalledWith({ where: { id: 'qa-user' }, data: { defaultReceivingWalletId: walletId } });
});
