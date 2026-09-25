/** @fileOverview Manual wallet creation must never grant proof or change defaults. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const m = vi.hoisted(() => ({ auth: vi.fn(), lock: vi.fn(), create: vi.fn(), company: vi.fn(), updateMany: vi.fn(), raw: vi.fn() }));
vi.mock('@/lib/wallet-link-request', () => ({
  walletLinkRequest: m.auth,
  walletLinkResponse: (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } }),
  walletLinkFailure: () => Response.json({ error: 'Unavailable' }, { status: 503 }),
}));
vi.mock('@/lib/wallet-link', () => ({ lockedWalletUser: m.lock, WalletLinkError: class extends Error {} }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: vi.fn() }));
vi.mock('@/lib/db', () => {
  const tx = { wallet: { create: m.create, updateMany: m.updateMany }, company: { findUnique: m.company }, $queryRaw: m.raw };
  return { dbPrisma: { ...tx, $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx) } };
});
import { POST } from '@/app/api/wallets/route';
const body = { label: 'Savings', family: 'EVM', address: '0x' + '1'.repeat(40), chainId: 1 };
const request = (data: unknown) => new NextRequest('http://localhost:3000/api/wallets', { method: 'POST', body: JSON.stringify(data), headers: { origin: 'http://localhost:3000', 'Content-Type': 'application/json' } });
beforeEach(() => {
  vi.resetAllMocks(); m.auth.mockResolvedValue({ userId: 'qa-owner', origin: 'http://localhost:3000' });
  m.create.mockImplementation(async ({ data }) => ({ ...data, id: 'qa-wallet', createdAt: new Date(), updatedAt: new Date() }));
});
it.each([{ isDefault: true }, { verifiedAt: new Date().toISOString() }, { ownerUserId: 'other' }, { address: 'invalid' }])('rejects unauthorized/default/proof data %j', async override => {
  expect((await POST(request({ ...body, ...override }))).status).toBe(400); expect(m.create).not.toHaveBeenCalled(); expect(m.updateMany).not.toHaveBeenCalled();
});
it('creates only an unverified non-default address and never clears existing defaults', async () => {
  const response = await POST(request(body)); expect(response.status).toBe(201); expect(response.headers.get('cache-control')).toContain('no-store');
  expect(await response.json()).toMatchObject({ ownerUserId: 'qa-owner', ownerCompanyId: null, isDefault: false, verifiedAt: null });
  expect(m.lock).toHaveBeenCalled(); expect(m.updateMany).not.toHaveBeenCalled();
});
it('requires the current company owner, not merely its former creator', async () => {
  m.company.mockResolvedValue({ ownerId: 'new-owner', creatorId: 'qa-owner' });
  expect((await POST(request({ ...body, ownerCompanyId: 'qa-company' }))).status).not.toBe(201);
  expect(m.create).not.toHaveBeenCalled();
});
it('creates company-owned records only after owner validation', async () => {
  m.company.mockResolvedValue({ ownerId: 'qa-owner' });
  expect((await POST(request({ ...body, ownerCompanyId: 'qa-company' }))).status).toBe(201);
  expect(m.create).toHaveBeenCalledWith({ data: expect.objectContaining({ ownerUserId: null, ownerCompanyId: 'qa-company', isDefault: false, verifiedAt: null }) });
});
it('returns guard denials without database work', async () => {
  m.auth.mockResolvedValue(Response.json({ error: 'Forbidden' }, { status: 403 }));
  expect((await POST(request(body))).status).toBe(403); expect(m.lock).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
});
