import { describe, expect, it } from 'vitest';
import { appendSnapshot, combineSeries, toCandles } from './portfolio-snapshots';

const H = 3_600_000;

describe('appendSnapshot', () => {
  it('replaces a point younger than the gap, appends otherwise, and caps the length', () => {
    let list = appendSnapshot([], { t: 0, usd: 100 });
    list = appendSnapshot(list, { t: 10 * 60_000, usd: 110 });
    expect(list).toEqual([{ t: 10 * 60_000, usd: 110 }]);
    list = appendSnapshot(list, { t: H, usd: 120 });
    expect(list).toHaveLength(2);
    const capped = appendSnapshot(Array.from({ length: 5 }, (_, i) => ({ t: i * H, usd: i })), { t: 9 * H, usd: 9 }, 0, 3);
    expect(capped.map((p) => p.usd)).toEqual([3, 4, 9]);
  });
});

describe('combineSeries', () => {
  it('sums accounts on a shared grid, carrying the last value forward', () => {
    const a = [{ t: 0, usd: 100 }, { t: 2 * H, usd: 120 }];
    const b = [{ t: H, usd: 50 }];
    expect(combineSeries([a, b], H)).toEqual([{ t: 0, usd: 100 }, { t: H, usd: 150 }, { t: 2 * H, usd: 170 }]);
  });
});

describe('toCandles', () => {
  it('buckets points into open/high/low/close bars', () => {
    const c = toCandles([{ t: 5, usd: 10 }, { t: 10, usd: 12 }, { t: H + 1, usd: 8 }], H);
    expect(c).toEqual([{ t: 0, o: 10, h: 12, l: 10, c: 12, v: 0 }, { t: H, o: 12, h: 12, l: 8, c: 8, v: 0 }]);
  });
});
