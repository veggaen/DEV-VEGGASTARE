/** @fileOverview Unverified donation claims cannot purchase verification. @stability stable */
import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const m = vi.hoisted(() => ({ auth: vi.fn(), wallet: vi.fn(), prior: vi.fn(), create: vi.fn(), update: vi.fn(), recalc: vi.fn(), limit: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { wallet: { findFirst: m.wallet, update: m.update }, donation: { findFirst: m.prior, create: m.create } } }));
vi.mock('@/lib/verification-recalc', () => ({ recalculateVerificationTier: m.recalc }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: m.limit, getClientIdentifier: () => 'qa', rateLimitedResponse: () => new Response(null, { status: 429 }) }));
import { POST } from '@/app/api/wallets/donate/route';
const request = (origin = 'http://localhost:3000') => new NextRequest('http://localhost:3000/api/wallets/donate', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ walletId: 'qa-wallet', txHash: 'unverified-claim', nativeAmount: '1', amountUsd: 10_000_000, chainFamily: 'EVM', chainId: 1, tokenSymbol: 'ETH' }) });
beforeEach(() => {
  vi.resetAllMocks(); m.auth.mockResolvedValue({ id: 'qa', web3ModeEnabled: true }); m.limit.mockResolvedValue({ success: true });
  m.wallet.mockResolvedValue({ id: 'qa-wallet', address: '0xqa', verifiedAt: new Date(), donationTotalUsd: 0 }); m.prior.mockResolvedValue(null); m.create.mockResolvedValue({ id: 'claim' });
});
it('a ten-million-dollar client claim stays pending without increasing totals or trust', async () => {
  const response = await POST(request()); expect(response.status).toBe(202);
  expect(await response.json()).toMatchObject({ status: 'PENDING_CONFIRMATION' });
  expect(m.create.mock.calls[0][0].data.status).toBe('PENDING_CONFIRMATION'); expect(m.update).not.toHaveBeenCalled(); expect(m.recalc).not.toHaveBeenCalled();
});
it.each(['cross-origin','demo','unsigned-wallet','missing-wallet','throttled','duplicate','racing-replay'])('rejects %s', async reason => {
  if (reason === 'demo') m.auth.mockResolvedValue({ id: 'demo_qa' });
  if (reason === 'unsigned-wallet') m.wallet.mockResolvedValue({ id: 'qa-wallet', verifiedAt: null });
  if (reason === 'missing-wallet') m.wallet.mockResolvedValue(null);
  if (reason === 'throttled') m.limit.mockResolvedValue({ success: false });
  if (reason === 'duplicate') m.prior.mockResolvedValue({ id: 'existing' });
  if (reason === 'racing-replay') m.create.mockRejectedValue({ code: 'P2002' });
  const response = await POST(request(reason === 'cross-origin' ? 'https://other.test' : undefined));
  expect(response.status).toBeGreaterThanOrEqual(400); expect(m.update).not.toHaveBeenCalled(); expect(m.recalc).not.toHaveBeenCalled();
});
