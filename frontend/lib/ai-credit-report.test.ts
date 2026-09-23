/** @fileOverview Report authorization, privacy, isolation and accounting regressions. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ session: vi.fn(), owner: vi.fn(), rate: vi.fn(), transaction: vi.fn(), accounts: vi.fn(), recent: vi.fn(), generations: vi.fn(), captures: vi.fn(), budget: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.session }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: m.rate }));
vi.mock('@/lib/db', () => ({ dbPrisma: { user: { findUnique: m.owner }, $transaction: m.transaction } }));
vi.mock('@/lib/ai-credit-ledger', () => ({ platformDailyMicroUsd: () => 5_000_000, AI_PLATFORM_DAILY_REQUEST_LIMIT: 500 }));
import { readAiCreditReport } from './ai-credit-report';
import { GET } from '@/app/api/admin/ai-credits/route';

beforeEach(() => {
  vi.resetAllMocks();
  m.session.mockResolvedValue({ id: 'owner', role: 'OWNER' }); m.owner.mockResolvedValue({ role: 'OWNER' });
  m.rate.mockResolvedValue({ success: true, resetIn: 60 });
  m.transaction.mockImplementation(fn => fn({ aiCreditAccount: { aggregate: m.accounts, findMany: m.recent }, aiGenerationReservation: { groupBy: m.generations }, checkoutAttempt: { aggregate: m.captures }, aiPlatformSpendDay: { findUnique: m.budget } }));
  m.accounts.mockResolvedValue({ _count: { _all: 1 }, _sum: { balance: 30, refundAdjustment: 7 } });
  m.recent.mockResolvedValue([{ userId: 'buyer', balance: 30, refundAdjustment: 0, updatedAt: new Date('2026-09-23T12:00:00Z'), User: { name: 'QA Buyer' } }]);
  m.generations.mockResolvedValue([
    { state: 'COMPLETED', _count: { _all: 3 }, _sum: { credits: 70, reservedMicroUsd: 695000 } },
    { state: 'RESERVED', _count: { _all: 1 }, _sum: { credits: 2, reservedMicroUsd: 15000 } },
    { state: 'REFUNDED', _count: { _all: 1 }, _sum: { credits: 8, reservedMicroUsd: 80000 } },
  ]);
  m.captures.mockResolvedValue({ _count: { _all: 2 }, _sum: { totalOre: 6800, refundedOre: 2900 } });
  m.budget.mockResolvedValue({ reservedMicroUsd: 850000, requests: 6 });
});
const request = (environment = 'SANDBOX') => new Request('https://test.example/api/admin/ai-credits?environment=' + environment);

describe('owner credit report access', () => {
  it.each([undefined, { id: 'buyer', role: 'USER' }, { id: 'admin', role: 'ADMIN' }])('denies non-owner sessions before report queries', async session => {
    m.session.mockResolvedValue(session); expect((await GET(request())).status).toBe(403); expect(m.transaction).not.toHaveBeenCalled();
  });
  it('rejects an owner role revoked after JWT issuance', async () => {
    m.owner.mockResolvedValue({ role: 'USER' }); expect((await GET(request())).status).toBe(403); expect(m.transaction).not.toHaveBeenCalled();
  });
  it('rejects invalid environment filters', async () => {
    expect((await GET(request('ALL'))).status).toBe(400); expect(m.transaction).not.toHaveBeenCalled();
  });
  it('limits expensive refreshes before aggregation', async () => {
    m.rate.mockResolvedValue({ success: false, resetIn: 42 }); const response = await GET(request());
    expect(response.status).toBe(429); expect(response.headers.get('Retry-After')).toBe('42'); expect(m.transaction).not.toHaveBeenCalled();
  });
  it('does not cache or expose raw database failures', async () => {
    m.transaction.mockRejectedValue(new Error('secret connection token and payer data'));
    const response = await GET(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it('returns current ledger figures without legacy product env flags', async () => {
    const response = await GET(request()); expect(response.status).toBe(200);
    expect((await response.json()).accounts.available).toBe(30);
  });
});

describe('honest ledger totals', () => {
  it('separates held credits, available credits, refunds, cash and provider ceilings', async () => {
    const result = await readAiCreditReport('SANDBOX', new Date('2026-09-23T23:15:00Z'));
    expect(result.accounts.available).toBe(30); expect(result.usage.reservedCredits).toBe(2);
    expect(result.usage.chargedCredits).toBe(70); expect(result.usage.costCeilingMicroUsd).toBe(790000);
    expect(result.payments).toEqual({ captures: 2, grossOre: 6800, refundedOre: 2900 });
    expect(result.platformToday).toEqual({ day: '2026-09-23', reservedMicroUsd: 850000, limitMicroUsd: 5000000, requests: 6, requestLimit: 500 });
    expect(result).not.toHaveProperty('profit'); expect(result).not.toHaveProperty('actualProviderSpend');
    expect(m.transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'RepeatableRead' }));
  });
  it.each(['LIVE', 'SANDBOX', 'DEMO'] as const)('isolates %s queries and bounds accounts without emails or keys', async environment => {
    await readAiCreditReport(environment);
    expect(m.accounts).toHaveBeenCalledWith(expect.objectContaining({ where: { environment } }));
    expect(m.generations).toHaveBeenCalledWith(expect.objectContaining({ where: { Account: { is: { environment } } } }));
    expect(m.captures).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ environment, captureId: { not: null } }) }));
    const select = m.recent.mock.calls[0][0]; expect(select.take).toBe(50); expect(select.select.User).toEqual({ select: { name: true } });
  });
  it('returns an explicit zero empty state', async () => {
    m.accounts.mockResolvedValue({ _count: { _all: 0 }, _sum: { balance: null, refundAdjustment: null } }); m.recent.mockResolvedValue([]); m.generations.mockResolvedValue([]);
    m.captures.mockResolvedValue({ _count: { _all: 0 }, _sum: { totalOre: null, refundedOre: null } }); m.budget.mockResolvedValue(null);
    const result = await readAiCreditReport('DEMO'); expect(result.accounts.total).toBe(0); expect(result.usage.costCeilingMicroUsd).toBe(0); expect(result.payments.grossOre).toBe(0);
  });
});
