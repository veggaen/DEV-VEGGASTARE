/** @fileOverview Price-range, normalization and calendar aggregation regressions. @stability stable */
import { describe, expect, it } from 'vitest';
import { aggregatePriceHistory, filterPriceHistory, formatHistoryPrice, historyQuerySchema, normalizeProviderPrices, selectPriceHistory } from './crypto-history';

describe('price history', () => {
  it('allowlists assets/currencies and rejects query injection, invalid dates and excessive history', () => {
    for (const query of [{ crypto: '../../secret' }, { crypto: 'random-coin' }, { vs_currency: 'usd&x=1' }, { days: 366 }, { fromDate: '2026-02-30' }, { fromDate: '2026-03-02', toDate: '2026-03-01' }, { secret: 'unexpected' }]) expect(historyQuerySchema.safeParse(query).success).toBe(false);
    expect(historyQuerySchema.parse({ vs_currency: 'nok', days: 'max' }).days).toBe(365);
  });
  it('sorts UTC days and keeps the latest observation when provider timestamps share a day', () => {
    expect(normalizeProviderPrices({ prices: [[Date.parse('2026-03-02T00:00:00Z'), 2], [Date.parse('2026-03-01T23:59:00Z'), 3], [Date.parse('2026-03-01T00:00:00Z'), 1]] })).toEqual([{ date: '2026-03-01', price: 3 }, { date: '2026-03-02', price: 2 }]);
  });
  it('accepts empty history without inventing a price, but rejects malformed provider data', () => {
    expect(normalizeProviderPrices({ prices: [] })).toEqual([]);
    for (const input of [{}, { prices: [[1, -1]] }, { prices: [[Infinity, 1]] }, { prices: [[1, NaN]] }, { prices: [['2026-01-01', 1]] }]) expect(() => normalizeProviderPrices(input)).toThrow();
  });
  it('bounds both raw provider observations and normalized daily history', () => {
    expect(() => normalizeProviderPrices({ prices: Array.from({ length: 1001 }, () => [1, 1]) })).toThrow();
    expect(() => normalizeProviderPrices({ prices: Array.from({ length: 368 }, (_, i) => [Date.UTC(2025, 0, 1) + i * 86400000, 1]) })).toThrow();
  });
  it('uses inclusive endpoints and a seven-day range means seven days across DST', () => {
    const points = Array.from({ length: 10 }, (_, i) => ({ date: new Date(Date.UTC(2026, 2, 24) + i * 86400000).toISOString().slice(0, 10), price: i }));
    expect(filterPriceHistory(points, 7)).toHaveLength(7);
    expect(selectPriceHistory(points, 'custom', '2026-03-29', '2026-03-29', 'daily').points).toEqual([{ date: '2026-03-29', price: 5 }]);
    expect(selectPriceHistory(points, 'custom', '', '', 'daily').error).toBeTruthy();
    expect(selectPriceHistory(points, 'custom', '2026-04-03', '2026-03-24', 'daily').points).toEqual([]);
  });
  it('groups by calendar Monday, not seven days after a filtered start date', () => {
    const points = [{ date: '2026-03-29', price: 100 }, { date: '2026-03-30', price: 200 }, { date: '2026-03-31', price: 300 }];
    expect(aggregatePriceHistory(points, 'weekly')).toEqual([{ date: '2026-03-23', price: 100 }, { date: '2026-03-30', price: 250 }]);
  });
  it('uses true month boundaries, leap days and only available selected observations', () => {
    const points = [{ date: '2024-02-28', price: 10 }, { date: '2024-02-29', price: 30 }, { date: '2024-03-01', price: 80 }];
    expect(aggregatePriceHistory(points, 'monthly')).toEqual([{ date: '2024-02-01', price: 20 }, { date: '2024-03-01', price: 80 }]);
    expect(selectPriceHistory(points, 'custom', '2024-02-29', '2024-03-01', 'monthly').points[0].price).toBe(30);
  });
  it('handles empty/single/zero values and very large finite means without overflow', () => {
    expect(aggregatePriceHistory([], 'weekly')).toEqual([]);
    expect(aggregatePriceHistory([{ date: '2026-01-01', price: 0 }], 'monthly')).toEqual([{ date: '2026-01-01', price: 0 }]);
    expect(aggregatePriceHistory([{ date: '2026-01-01', price: 1e308 }, { date: '2026-01-02', price: 1e308 }], 'monthly')[0].price).toBe(1e308);
    expect(formatHistoryPrice(0.00000123, 'nok')).toContain('0.00000123');
    expect(formatHistoryPrice(0, 'usd')).toContain('0.00');
  });
});
