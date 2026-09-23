/** @fileOverview Buyer ledger scope, read-only behavior and honest balance tests. @stability stable */
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ transaction: vi.fn(), account: vi.fn(), entries: vi.fn(), pending: vi.fn(), environment: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ dbPrisma: { $transaction: m.transaction } }));
vi.mock('@/lib/ai-credit-ledger', () => ({ aiCreditEnvironment: m.environment, DEMO_AI_CREDITS: 5 }));
import { readBuyerCreditHistory, creditEntryLabels } from './ai-credit-history';

beforeEach(() => {
  vi.resetAllMocks();
  m.environment.mockReturnValue('SANDBOX');
  m.transaction.mockImplementation(fn => fn({ aiCreditAccount: { findUnique: m.account }, aiCreditEntry: { findMany: m.entries }, aiGenerationReservation: { aggregate: m.pending } }));
  m.account.mockResolvedValue({ balance: 30, refundAdjustment: 7 });
  m.entries.mockResolvedValue([{ id: 'entry', delta: -2, kind: 'RESERVE', createdAt: new Date('2026-09-23T12:00:00Z') }]);
  m.pending.mockResolvedValue({ _sum: { credits: 2 }, _count: { _all: 1 } });
});
describe('buyer history', () => {
  it.each(['LIVE', 'SANDBOX', 'DEMO'])('scopes every query to the signed-in buyer in %s', async environment => {
    m.environment.mockReturnValue(environment);
    await readBuyerCreditHistory('buyer');
    expect(m.environment).toHaveBeenCalledWith('buyer');
    expect(m.account).toHaveBeenCalledWith({ where: { userId_environment: { userId: 'buyer', environment } }, select: { balance: true, refundAdjustment: true } });
    expect(m.entries).toHaveBeenCalledWith(expect.objectContaining({ where: { accountId: `${environment}:buyer` }, take: 50 }));
    expect(m.pending).toHaveBeenCalledWith(expect.objectContaining({ where: { accountId: `${environment}:buyer`, state: 'RESERVED' } }));
  });
  it('does not subtract reservations twice or hide a refund adjustment', async () => {
    const result = await readBuyerCreditHistory('buyer');
    expect(result).toMatchObject({ available: 30, reserved: 2, refundAdjustment: 7, pendingRequests: 1 });
    expect(m.transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'RepeatableRead' }));
  });
  it('selects no payment references, prompts, keys or provider billing data', async () => {
    const result = await readBuyerCreditHistory('buyer');
    expect(m.entries.mock.calls[0][0].select).toEqual({ id: true, kind: true, delta: true, createdAt: true });
    expect(result.entries[0]).toEqual({ id: 'entry', delta: -2, kind: 'RESERVE', createdAt: '2026-09-23T12:00:00.000Z' });
  });
  it('shows an unclaimed demo allowance separately without issuing a grant', async () => {
    m.environment.mockReturnValue('DEMO'); m.account.mockResolvedValue(null); m.entries.mockResolvedValue([]);
    m.pending.mockResolvedValue({ _sum: { credits: null }, _count: { _all: 0 } });
    expect(await readBuyerCreditHistory('demo')).toMatchObject({ available: 5, recordedBalance: 0, unclaimedDemoAllowance: 5, reserved: 0, entries: [] });
  });
  it('does not promise a demo grant again after the balance has been spent', async () => {
    m.environment.mockReturnValue('DEMO'); m.account.mockResolvedValue({ balance: 0, refundAdjustment: 0 });
    expect((await readBuyerCreditHistory('demo')).unclaimedDemoAllowance).toBe(0);
  });
  it('never invents money for an empty paid account', async () => {
    m.account.mockResolvedValue(null);
    expect(await readBuyerCreditHistory('buyer')).toMatchObject({ available: 0, unclaimedDemoAllowance: 0 });
  });
  it('labels reservation and reversal entries without claiming they are new charges', () => {
    expect(creditEntryLabels.RESERVE).toBe('Message reservation');
    expect(creditEntryLabels.PAYMENT_REVERSAL).toBe('Purchase refunded or reversed');
  });
});
