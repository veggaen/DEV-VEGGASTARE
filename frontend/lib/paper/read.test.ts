/** @fileOverview Paper-account read, pagination and unavailable-price regressions. @stability active */
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), portfolio: vi.fn(), cursor: vi.fn(), trades: vi.fn(), prices: vi.fn() }));
vi.mock('@/lib/user-auth', () => ({ MyLibUserAuth: m.auth }));
vi.mock('@/lib/db', () => ({ dbPrisma: { user: { findUnique: m.user }, paperPortfolio: { findUnique: m.portfolio }, paperTrade: { findFirst: m.cursor, findMany: m.trades } } }));
vi.mock('@/lib/paper/price-feed', () => ({ getTokenPrices: m.prices }));
import { readPaperPortfolio, readPaperHistory } from './read';

beforeEach(() => {
  vi.resetAllMocks(); m.auth.mockResolvedValue({ id: 'reader', sessionVersion: 3 }); m.user.mockResolvedValue({ tokenVersion: 3 });
  m.portfolio.mockResolvedValue({ id: 'portfolio-reader', cashBalance: 90, startingBalance: 100, resetCount: 0, Positions: [] });
  m.prices.mockResolvedValue(new Map()); m.trades.mockResolvedValue([]); m.cursor.mockResolvedValue(null);
});
it('distinguishes missing portfolios from unavailable data, without diagnostics leaking', async () => {
  m.portfolio.mockResolvedValueOnce(null);
  expect(await readPaperPortfolio()).toMatchObject({ success: false, code: 'NOT_FOUND' });
  m.portfolio.mockRejectedValueOnce(new Error('private database connection'));
  const result = await readPaperPortfolio(); expect(result).toMatchObject({ success: false, code: 'UNAVAILABLE' });
  expect(JSON.stringify(result)).not.toContain('private database');
});
it.each([undefined, { id: 'reader' }, { id: 'reader', sessionVersion: 2 }, { id: 'reader', sessionVersion: 3, impersonatingFromId: 'owner' }])('rejects absent, stale and impersonated sessions', async user => {
  m.auth.mockResolvedValue(user);
  expect(await readPaperPortfolio()).toMatchObject({ success: false, code: 'UNAUTHORIZED' });
  expect(m.portfolio).not.toHaveBeenCalled();
});
it('never substitutes zero for an unavailable, stale or invalid price', async () => {
  m.portfolio.mockResolvedValue({ id: 'portfolio-reader', cashBalance: 90, startingBalance: 100, resetCount: 0, Positions: [
    { tokenSymbol: 'ETH', tokenAddress: '0x0', chainId: 1, amount: '100', displayAmount: '2', avgEntryPrice: 5, totalCostBasis: 10 },
  ] });
  for (const quote of [undefined, { usd: 0 }, { usd: NaN }, { usd: 3, staleMs: 90_000 }]) {
    m.prices.mockResolvedValue(new Map([['ETH', quote]]));
    expect(await readPaperPortfolio()).toMatchObject({ success: true, data: { totalValueUsd: null, totalPnlUsd: null, positions: [{ valueUsd: null, pnlUsd: null }] } });
  }
  m.prices.mockResolvedValue(new Map([['ETH', { usd: 8, source: 'coingecko' }]]));
  expect(await readPaperPortfolio()).toMatchObject({ success: true, data: { totalValueUsd: 106, totalPnlUsd: 6, positions: [{ valueUsd: 16, pnlUsd: 6 }] } });
});
it('keeps saved holdings available if the price provider throws', async () => {
  m.prices.mockRejectedValueOnce(new Error('provider down'));
  expect(await readPaperPortfolio()).toMatchObject({ success: true, data: { portfolio: { cashBalance: 90 } } });
});
it.each([{ limit: 0 }, { limit: -1 }, { limit: 201 }, { limit: 1.5 }, { cursor: 'x'.repeat(129) }, { type: 'HACK' }])('bounds history input before queries: %o', async input => {
  expect(await readPaperHistory(input as never)).toMatchObject({ success: false, code: 'INVALID' }); expect(m.trades).not.toHaveBeenCalled();
});
it('returns an owned keyset cursor and a deterministic page with no metadata', async () => {
  const time = new Date('2025-01-01'); m.cursor.mockResolvedValue({ id: 'owned', executedAt: time });
  m.trades.mockResolvedValue([{ id: 'b' }, { id: 'a' }, { id: 'older' }]);
  expect(await readPaperHistory({ limit: 2, cursor: 'owned', type: 'BUY' })).toEqual({ success: true, data: { trades: [{ id: 'b' }, { id: 'a' }], nextCursor: 'a' } });
  expect(m.cursor).toHaveBeenCalledWith({ where: { id: 'owned', portfolioId: 'portfolio-reader', type: 'BUY' }, select: { id: true, executedAt: true } });
  const q = m.trades.mock.calls[0][0]; expect(q.where).toMatchObject({ portfolioId: 'portfolio-reader', type: 'BUY', OR: [{ executedAt: { lt: time } }, { executedAt: time, id: { lt: 'owned' } }] });
  expect(q.orderBy).toEqual([{ executedAt: 'desc' }, { id: 'desc' }]); expect(q.take).toBe(3); expect(q.select.metadata).toBeUndefined();
});
it('does not accept another account’s cursor or query its history', async () => {
  expect(await readPaperHistory({ cursor: 'foreign' })).toMatchObject({ success: false, code: 'INVALID' }); expect(m.trades).not.toHaveBeenCalled();
});
it('distinguishes an empty last page from history failure', async () => {
  expect(await readPaperHistory()).toEqual({ success: true, data: { trades: [], nextCursor: null } });
  m.trades.mockRejectedValueOnce(new Error('private diagnostic'));
  expect(await readPaperHistory()).toMatchObject({ success: false, code: 'UNAVAILABLE' });
});
