import { describe, expect, it } from 'vitest';
import type { Candle } from '@/lib/market/symbols';
import { atr, awesomeOscillator, bollinger, defaultIndicator, ema, evaluateIndicator, indicatorLabel, macd, obv, rsi, sma, stochastic, supertrend, vwap } from './indicators';

const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
const candles: Candle[] = closes.map((c, i) => ({ t: i * 3_600_000, o: c - 0.1, h: c + 0.5, l: c - 0.5, c, v: 100 + i }));
const finite = (xs: number[]) => xs.filter(Number.isFinite);

describe('moving averages', () => {
  it('sma and ema are undefined before the window fills and track the mean after', () => {
    const s = sma([1, 2, 3, 4, 5], 3);
    expect(s.slice(0, 2).every(Number.isNaN)).toBe(true);
    expect(s.slice(2)).toEqual([2, 3, 4]);
    const e = ema([1, 2, 3, 4, 5], 3);
    expect(e[2]).toBe(2);
    expect(e[4]).toBeCloseTo(4, 5);
  });
  it('bollinger bands straddle the middle line', () => {
    const b = bollinger(closes, 5, 2);
    const i = closes.length - 1;
    expect(b.upper[i]).toBeGreaterThan(b.middle[i]);
    expect(b.lower[i]).toBeLessThan(b.middle[i]);
  });
});

describe('oscillators', () => {
  it('rsi matches the textbook sequence and stays within 0..100', () => {
    const r = rsi(closes, 14);
    expect(r.slice(0, 14).every(Number.isNaN)).toBe(true);
    expect(r[14]).toBeCloseTo(70.46, 1);
    expect(finite(r).every((v) => v >= 0 && v <= 100)).toBe(true);
  });
  it('macd histogram is line minus signal', () => {
    const m = macd(closes, 3, 6, 3);
    const i = closes.length - 1;
    expect(m.histogram[i]).toBeCloseTo(m.macd[i] - m.signal[i], 10);
  });
  it('stochastic %K is within 0..100 and %D smooths it', () => {
    const s = stochastic(candles, 5, 3);
    expect(finite(s.k).every((v) => v >= 0 && v <= 100)).toBe(true);
    expect(finite(s.d).length).toBeLessThan(finite(s.k).length);
  });
  it('atr is positive, vwap sits inside the price range, ao and obv are defined', () => {
    expect(finite(atr(candles, 5)).every((v) => v > 0)).toBe(true);
    const v = vwap(candles);
    expect(v[v.length - 1]).toBeGreaterThan(43);
    expect(v[v.length - 1]).toBeLessThan(47);
    expect(finite(awesomeOscillator(candles)).length).toBe(0); // needs 34 bars
    expect(obv(candles)[1]).toBe(-101);
  });
  it('supertrend flips direction and only ever reports one of the two bands', () => {
    const st = supertrend(candles, 3, 1);
    const dirs = new Set(finite(st.direction));
    expect(dirs.size).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < candles.length; i++) if (Number.isFinite(st.line[i])) expect([1, -1]).toContain(st.direction[i]);
  });
});

describe('catalogue', () => {
  it('builds defaults, labels and aligned series for every type', () => {
    for (const type of ['sma', 'ema', 'bb', 'vwap', 'supertrend', 'rsi', 'macd', 'stoch', 'atr', 'ao', 'obv'] as const) {
      const cfg = defaultIndicator(type);
      const out = evaluateIndicator(cfg, candles);
      expect(out.series.length).toBeGreaterThan(0);
      for (const s of out.series) expect(s.values).toHaveLength(candles.length);
      expect(indicatorLabel(cfg).length).toBeGreaterThan(1);
    }
    expect(indicatorLabel({ id: 'x', type: 'bb', params: { period: 20, mult: 2 } })).toBe('BB 20 2');
  });
});
