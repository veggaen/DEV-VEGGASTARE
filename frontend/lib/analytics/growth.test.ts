/** @fileOverview Growth normalization and inclusive UTC date-range regressions. @stability stable */
import { describe, expect, it } from 'vitest';
import { displayDay, parseGrowth, sampleGrowth, selectGrowth, validDay } from './growth';

const payload = (points: { date: string; users: number }[]) => ({ data: [{ label: 'Products', data: points }], firstProductDate: '2026-01-01', lastProductDate: '2026-03-31', today: '2026-03-31' });

describe('growth reports', () => {
  it('rejects normalized impossible dates and accepts leap days', () => {
    for (const date of ['', '2026-02-29', '2026-02-30', '2026-13-01', '26-01-01']) expect(validDay(date)).toBe(false);
    expect(validDay('2024-02-29')).toBe(true);
  });
  it('parses and sorts the legacy product count without inventing values', () => {
    expect(parseGrowth('products', payload([{ date: '2026-03-31T00:00:00Z', users: 8 }, { date: '2026-01-01', users: 2 }]))).toEqual([{ date: '2026-01-01', value: 2 }, { date: '2026-03-31', value: 8 }]);
  });
  it('rejects malformed, duplicate and impossible samples', () => {
    for (const points of [[{ date: '2026-02-30', users: 1 }], [{ date: '2026-01-01', users: -1 }], [{ date: '2026-01-01', users: 1 }, { date: '2026-01-01', users: 2 }]]) expect(() => parseGrowth('products', payload(points))).toThrow();
    expect(() => parseGrowth('products', { data: [{ data: [{ users: 2 }] }] })).toThrow();
  });
  it('supports the API empty shape without an invalid today date', () => {
    expect(parseGrowth('companies', { data: [], error: 'No companies found' })).toEqual([]);
    expect(selectGrowth([], '30', '', '').points).toEqual([]);
  });
  it('uses a deterministic preview per metric and the latest days, not earliest month', () => {
    for (const metric of ['products', 'users', 'companies'] as const) {
      const points = sampleGrowth(metric);
      expect(points).toEqual(sampleGrowth(metric));
      expect(points).toHaveLength(90);
      expect(selectGrowth(points, '7', '', '').points.map(p => p.date)).toEqual(points.slice(-7).map(p => p.date));
      expect(selectGrowth(points, '30', '', '').points).toHaveLength(30);
      expect(selectGrowth(points, 'all', '', '').points).toHaveLength(90);
    }
  });
  it('includes both custom endpoints and never falls back to all dates on invalid input', () => {
    const points = sampleGrowth('users');
    expect(selectGrowth(points, 'custom', '2026-03-29', '2026-03-31').points).toHaveLength(3);
    expect(selectGrowth(points, 'custom', '2026-03-31', '2026-03-31').points).toHaveLength(1);
    for (const [from, to] of [['', ''], ['2026-03-31', '2026-01-01']]) {
      const selected = selectGrowth(points, 'custom', from, to);
      expect(selected.error).toBeTruthy();
      expect(selected.points).toEqual([]);
    }
  });
  it('formats dates in UTC and exposes truly empty custom ranges', () => {
    expect(displayDay('2026-03-29')).toBe('29 Mar 2026');
    expect(selectGrowth(sampleGrowth('companies'), 'custom', '2027-01-01', '2027-02-01')).toEqual({ points: [], error: null });
  });
});
