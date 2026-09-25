/** @fileOverview Evidence, cache and API regression tests without mail or provider calls. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const m = vi.hoisted(() => ({ user: vi.fn(), accounts: vi.fn(), pending: vi.fn(), wallets: vi.fn(), capture: vi.fn(),
  update: vi.fn(), transaction: vi.fn(), auth: vi.fn(), limit: vi.fn() }));
vi.mock('@/lib/db', () => ({ dbPrisma: { $transaction: m.transaction } }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowAuthAttempt: m.limit }));
import { readVerificationEvidence } from '@/lib/verification-evidence';
import { recalculateVerificationTier } from '@/lib/verification-recalc';
import { GET, POST } from '@/app/api/users/verification/route';
const tx = { user: { findUnique: m.user, update: m.update }, account: { findMany: m.accounts },
  pendingOAuthLink: { findMany: m.pending }, wallet: { findMany: m.wallets }, $queryRaw: m.capture };
const user = () => ({ emailVerified: new Date(), phoneVerified: null, phoneNumber: null, isTwoFactorEnabled: false,
  hasGoogleAuth: true, hasGithubAuth: false, hasDiscordAuth: false, web3ModeEnabled: false,
  bankidVerified: null, vippsVerified: null, emailRisk: 'verified', reachLifetime: 0,
  hasVerifiedWallet: true, hasWeb2Payment: true, hasWeb3Payment: true, verificationTier: 'FULLY_VERIFIED', verificationScore: 100 });
beforeEach(() => {
  vi.resetAllMocks(); m.transaction.mockImplementation(fn => fn(tx)); m.user.mockResolvedValue(user());
  m.accounts.mockResolvedValue([{ provider: 'google' }, { provider: 'github' }]);
  m.pending.mockResolvedValue([{ provider: 'github' }]); m.wallets.mockResolvedValue([]); m.capture.mockResolvedValue([]);
  m.auth.mockResolvedValue({ id: 'qa-owner' }); m.limit.mockResolvedValue(true);
});
describe('canonical verification evidence', () => {
  it('ignores stale cached tier/payment/wallet flags and unconfirmed OAuth', async () => {
    const data = (await readVerificationEvidence('qa-owner'))!;
    expect(data).toMatchObject({ tier: 'SOCIAL_VERIFIED', score: 30, multiplier: .7,
      flags: { hasGoogleAuth: true, hasGithubAuth: false, hasVerifiedWallet: false, hasWeb2Payment: false, hasWeb3Payment: false } });
    expect(data.reach.trust.payment).toBe(0); expect(data.reach.trust.walletProvenance).toBe(0);
    expect(m.update).not.toHaveBeenCalled(); expect(m.transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'RepeatableRead' });
  });
  it('revokes disconnected provider evidence even if its flag remains true', async () => {
    m.accounts.mockResolvedValue([]); expect((await readVerificationEvidence('qa-owner'))!.score).toBe(10);
  });
  it('a Web3 mode preference alone cannot earn wallet trust', async () => {
    m.user.mockResolvedValue({ ...user(), emailVerified: null, web3ModeEnabled: true }); m.accounts.mockResolvedValue([]);
    expect(await readVerificationEvidence('qa-owner')).toMatchObject({ tier: 'ANONYMOUS', score: 0, flags: { hasVerifiedWallet: false } });
  });
  it('counts a currently verified personal wallet without donation or brand bonuses', async () => {
    m.wallets.mockResolvedValue([{ id: 'signed', donationTotalUsd: 10_000_000, riskTier: 'kyc' }]);
    const data = (await readVerificationEvidence('qa-owner'))!;
    expect(data).toMatchObject({ tier: 'WEB3_VERIFIED', score: 45, flags: { hasVerifiedWallet: true } });
    expect(data.reach.trust.walletProvenance).toBe(10);
    expect(m.wallets.mock.calls[0][0].where).toEqual({ ownerUserId: 'qa-owner', ownerCompanyId: null, family: { in: ['EVM','SOLANA'] }, verifiedAt: { not: null } });
  });
  it('requires a positive unadjusted completed Live capture owned by the same user', async () => {
    m.capture.mockResolvedValue([{ orderId: 'verified-live' }]);
    expect((await readVerificationEvidence('qa-owner'))!).toMatchObject({ tier: 'WEB2_PAYMENT', score: 45, flags: { hasWeb2Payment: true } });
    expect(m.capture.mock.calls[0][0].values).toEqual(['qa-owner']);
    expect(m.capture.mock.calls[0][0].text).toContain('"refundedMinor"');
    expect((await readVerificationEvidence('demo_qa'))!.flags.hasWeb2Payment).toBe(false);
  });
  it('persists exactly the same calculated evidence under a serializable user lock', async () => {
    const snapshot = (await readVerificationEvidence('qa-owner'))!;
    expect(await recalculateVerificationTier('qa-owner')).toEqual({ tier: snapshot.tier, score: snapshot.score });
    expect(m.capture.mock.calls.some(call => call[0].text?.includes('FOR UPDATE') || String(call[0]).includes('FOR UPDATE'))).toBe(true);
    expect(m.update.mock.calls[0][0].data).toMatchObject({ verificationScore: snapshot.score, verificationTier: snapshot.tier,
      hasVerifiedWallet: false, hasWeb2Payment: false, hasWeb3Payment: false, trueReach: snapshot.reach.trueReach });
    expect(m.transaction.mock.calls[1][1]).toEqual({ isolationLevel: 'Serializable' });
  });
  it.each([{ code: 'P2034' }, { code: 'P2010', meta: { code: '40001' } },
    { code: 'P2010', meta: { driverAdapterError: { cause: { originalCode: '40001' } } } }])('retries a serialization conflict from a fresh snapshot (%j)', async error => {
    m.transaction.mockRejectedValueOnce(error);
    expect(await recalculateVerificationTier('qa-owner')).toEqual({ tier: 'SOCIAL_VERIFIED', score: 30 });
    expect(m.transaction).toHaveBeenCalledTimes(2);
  });
  it('fails closed on evidence-read errors rather than falling back to stale trust', async () => {
    m.wallets.mockRejectedValue(new Error('private database details'));
    const response = await GET(); expect(response.status).toBe(503); expect(await response.text()).not.toContain('private database');
    expect(m.update).not.toHaveBeenCalled();
  });
  it('GET is no-store, owner-scoped and excludes sensitive/internal evidence', async () => {
    const response = await GET(); const data = await response.json();
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(data.score).toBe(30); expect(data).not.toHaveProperty('user'); expect(data).not.toHaveProperty('reach');
    expect(m.user.mock.calls[0][0].where).toEqual({ id: 'qa-owner' }); expect(m.update).not.toHaveBeenCalled();
  });
  it.each(['cross-origin', 'anonymous', 'demo', 'limited'])('denies %s manual recalculation', async reason => {
    if (reason === 'anonymous') m.auth.mockResolvedValue(null);
    if (reason === 'demo') m.auth.mockResolvedValue({ id: 'demo_qa' });
    if (reason === 'limited') m.limit.mockResolvedValue(false);
    const response = await POST(new NextRequest('http://localhost:3000/api/users/verification', { method: 'POST', headers: { origin: reason === 'cross-origin' ? 'https://other.test' : 'http://localhost:3000' } }));
    expect(response.status).toBe(reason === 'anonymous' ? 401 : reason === 'limited' ? 429 : 403);
    expect(m.update).not.toHaveBeenCalled();
  });
});
