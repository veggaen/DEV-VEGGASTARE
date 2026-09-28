/** @fileOverview Reading wallets cannot mutate payout configuration. @stability stable */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), list: vi.fn(), update: vi.fn(), updateMany: vi.fn(), userUpdate: vi.fn(), transaction: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/data/user', () => ({ getUserById: m.user }));
vi.mock('@/lib/db', () => ({ dbPrisma: { wallet: { findMany: m.list, update: m.update, updateMany: m.updateMany }, user: { update: m.userUpdate }, $transaction: m.transaction } }));
import { GET } from '@/app/api/wallets/evm/route';
import { POST } from '@/app/api/wallets/evm/backfill-meta/route';

const wallet = (id: string, isDefault = false, verifiedAt: Date | null = new Date('2026-09-01')) => ({
  id, label: 'My wallet', family: 'EVM', address: '0x' + '1'.repeat(40), chainId: 1,
  isDefault, verifiedAt, Donation: [], connectorType: null, authProvider: null, socialEmail: null,
  createdAt: new Date('2026-09-01'),
});
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ id: 'owner' });
  m.user.mockResolvedValue({ id: 'owner', web3ModeEnabled: true });
  m.list.mockResolvedValue([wallet('first'), wallet('second')]);
});
afterEach(() => {
  expect(m.update).not.toHaveBeenCalled(); expect(m.updateMany).not.toHaveBeenCalled();
  expect(m.userUpdate).not.toHaveBeenCalled(); expect(m.transaction).not.toHaveBeenCalled();
});
it('does not pick a primary or payout wallet even when all verified wallets lack a default', async () => {
  for (let n = 0; n < 2; n++) {
    const response = await GET(); expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect((await response.json()).wallets.map((w: { isDefault: boolean }) => w.isDefault)).toEqual([false, false]);
  }
  expect(m.list.mock.calls[0][0].where).toEqual({ ownerUserId: 'owner', ownerCompanyId: null, family: 'EVM' });
  expect(m.list.mock.calls[0][0].select.Donation.where).toEqual({ status: 'CONFIRMED' });
});
it.each([true, false])('keeps saved default %s and unverified state unchanged', async primary => {
  m.list.mockResolvedValue([wallet('saved', primary, null)]);
  expect((await (await GET()).json()).wallets[0]).toMatchObject({ id: 'saved', isDefault: primary, verifiedAt: null });
});
it.each(['no-session', 'missing-user', 'disabled-web3'])('rejects %s without listing or writing wallets', async reason => {
  if (reason === 'no-session') m.auth.mockResolvedValue(null);
  if (reason === 'missing-user') m.user.mockResolvedValue(null);
  if (reason === 'disabled-web3') m.user.mockResolvedValue({ id: 'owner', web3ModeEnabled: false });
  const response = await GET();
  expect(response.status).toBe(reason === 'disabled-web3' ? 403 : 401);
  expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(m.list).not.toHaveBeenCalled();
});
it('retired metadata endpoint has no auth, database or mutation side effects', async () => {
  const response = await POST(); expect(response.status).toBe(410);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(m.auth).not.toHaveBeenCalled(); expect(m.user).not.toHaveBeenCalled(); expect(m.list).not.toHaveBeenCalled();
});
