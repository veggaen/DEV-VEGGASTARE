/**
 * @fileOverview  Technical indicators for the terminal chart: pure functions
 *                over candle arrays that return series aligned to the input
 *                (NaN where the indicator is not yet defined), plus the
 *                catalogue the Indicators menu lists and the per-user
 *                persistence of what is switched on.
 * @stability     experimental
 */

import type { Candle } from "@/lib/market/symbols";

export type IndicatorType = "sma" | "ema" | "bb" | "vwap" | "supertrend" | "rsi" | "macd" | "stoch" | "atr" | "ao" | "obv";
export type IndicatorConfig = { id: string; type: IndicatorType; params: Record<string, number> };

export type IndicatorMeta = {
  type: IndicatorType;
  label: string;
  /** Overlay = drawn on the price plot; pane = its own strip below. */
  placement: "overlay" | "pane";
  params: Array<{ key: string; label: string; default: number; min: number; max: number }>;
  /** Fixed scale for panes (RSI, Stochastic); undefined = fit to data. */
  range?: [number, number];
  /** Horizontal guide levels for panes. */
  levels?: number[];
};

export const INDICATOR_CATALOGUE: IndicatorMeta[] = [
  { type: "sma", label: "Moving average (SMA)", placement: "overlay", params: [{ key: "period", label: "Length", default: 20, min: 2, max: 500 }] },
  { type: "ema", label: "Exponential MA (EMA)", placement: "overlay", params: [{ key: "period", label: "Length", default: 50, min: 2, max: 500 }] },
  { type: "bb", label: "Bollinger Bands", placement: "overlay", params: [{ key: "period", label: "Length", default: 20, min: 2, max: 200 }, { key: "mult", label: "StdDev", default: 2, min: 0.5, max: 5 }] },
  { type: "vwap", label: "VWAP", placement: "overlay", params: [] },
  { type: "supertrend", label: "Supertrend", placement: "overlay", params: [{ key: "period", label: "ATR length", default: 10, min: 2, max: 100 }, { key: "mult", label: "Factor", default: 3, min: 0.5, max: 10 }] },
  { type: "rsi", label: "RSI", placement: "pane", params: [{ key: "period", label: "Length", default: 14, min: 2, max: 100 }], range: [0, 100], levels: [30, 70] },
  { type: "macd", label: "MACD", placement: "pane", params: [{ key: "fast", label: "Fast", default: 12, min: 2, max: 100 }, { key: "slow", label: "Slow", default: 26, min: 3, max: 200 }, { key: "signal", label: "Signal", default: 9, min: 2, max: 50 }], levels: [0] },
  { type: "stoch", label: "Stochastic", placement: "pane", params: [{ key: "k", label: "%K", default: 14, min: 2, max: 100 }, { key: "d", label: "%D", default: 3, min: 1, max: 50 }], range: [0, 100], levels: [20, 80] },
  { type: "atr", label: "ATR", placement: "pane", params: [{ key: "period", label: "Length", default: 14, min: 2, max: 100 }] },
  { type: "ao", label: "Awesome Oscillator", placement: "pane", params: [], levels: [0] },
  { type: "obv", label: "On-balance volume", placement: "pane", params: [] },
];

export const indicatorMeta = (type: IndicatorType): IndicatorMeta => INDICATOR_CATALOGUE.find((m) => m.type === type)!;

export function defaultIndicator(type: IndicatorType): IndicatorConfig {
  const meta = indicatorMeta(type);
  return { id: `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, type, params: Object.fromEntries(meta.params.map((p) => [p.key, p.default])) };
}

export function indicatorLabel(c: IndicatorConfig): string {
  const meta = indicatorMeta(c.type);
  const short: Record<IndicatorType, string> = { sma: "SMA", ema: "EMA", bb: "BB", vwap: "VWAP", supertrend: "ST", rsi: "RSI", macd: "MACD", stoch: "Stoch", atr: "ATR", ao: "AO", obv: "OBV" };
  const args = meta.params.map((p) => c.params[p.key] ?? p.default).join(" ");
  return args ? `${short[c.type]} ${args}` : short[c.type];
}

// ── Series maths ────────────────────────────────────────────────────────────

const nanArray = (n: number) => new Array<number>(n).fill(NaN);

export function sma(values: number[], period: number): number[] {
  const out = nanArray(values.length);
  if (period < 1) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out = nanArray(values.length);
  if (period < 1 || !values.length) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { seed += values[i]; continue; }
    if (i === period - 1) { seed += values[i]; out[i] = seed / period; continue; }
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

export function stddev(values: number[], period: number): number[] {
  const out = nanArray(values.length);
  const mean = sma(values, period);
  for (let i = period - 1; i < values.length; i++) {
    let acc = 0;
    for (let j = i - period + 1; j <= i; j++) acc += (values[j] - mean[i]) ** 2;
    out[i] = Math.sqrt(acc / period);
  }
  return out;
}

export function bollinger(closes: number[], period = 20, mult = 2): { middle: number[]; upper: number[]; lower: number[] } {
  const middle = sma(closes, period);
  const sd = stddev(closes, period);
  return { middle, upper: middle.map((m, i) => m + mult * sd[i]), lower: middle.map((m, i) => m - mult * sd[i]) };
}

/** Wilder's RSI. */
export function rsi(closes: number[], period = 14): number[] {
  const out = nanArray(closes.length);
  if (closes.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) { const d = closes[i] - closes[i - 1]; if (d >= 0) gain += d; else loss -= d; }
  let avgGain = gain / period, avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9): { macd: number[]; signal: number[]; histogram: number[] } {
  const f = ema(closes, fast), s = ema(closes, slow);
  const line = closes.map((_, i) => f[i] - s[i]);
  // The signal EMA starts where the MACD line is first defined.
  const start = line.findIndex((v) => Number.isFinite(v));
  const signal = nanArray(closes.length);
  if (start >= 0) { const tail = ema(line.slice(start), signalPeriod); for (let i = 0; i < tail.length; i++) signal[start + i] = tail[i]; }
  return { macd: line, signal, histogram: line.map((v, i) => v - signal[i]) };
}

export function stochastic(candles: Candle[], kPeriod = 14, dPeriod = 3): { k: number[]; d: number[] } {
  const k = nanArray(candles.length);
  for (let i = kPeriod - 1; i < candles.length; i++) {
    let hi = -Infinity, lo = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) { hi = Math.max(hi, candles[j].h); lo = Math.min(lo, candles[j].l); }
    k[i] = hi === lo ? 50 : ((candles[i].c - lo) / (hi - lo)) * 100;
  }
  const start = k.findIndex((v) => Number.isFinite(v));
  const d = nanArray(candles.length);
  if (start >= 0) { const tail = sma(k.slice(start), dPeriod); for (let i = 0; i < tail.length; i++) d[start + i] = tail[i]; }
  return { k, d };
}

export function trueRange(candles: Candle[]): number[] {
  return candles.map((c, i) => (i === 0 ? c.h - c.l : Math.max(c.h - c.l, Math.abs(c.h - candles[i - 1].c), Math.abs(c.l - candles[i - 1].c))));
}

/** Wilder's ATR. */
export function atr(candles: Candle[], period = 14): number[] {
  const tr = trueRange(candles);
  const out = nanArray(candles.length);
  if (candles.length < period) return out;
  let acc = 0;
  for (let i = 0; i < period; i++) acc += tr[i];
  out[period - 1] = acc / period;
  for (let i = period; i < candles.length; i++) out[i] = (out[i - 1] * (period - 1) + tr[i]) / period;
  return out;
}

/** Cumulative VWAP over the loaded bars (typical price weighted by volume). */
export function vwap(candles: Candle[]): number[] {
  const out = nanArray(candles.length);
  let pv = 0, vol = 0;
  for (let i = 0; i < candles.length; i++) {
    const tp = (candles[i].h + candles[i].l + candles[i].c) / 3;
    pv += tp * candles[i].v; vol += candles[i].v;
    out[i] = vol > 0 ? pv / vol : tp;
  }
  return out;
}

export function awesomeOscillator(candles: Candle[]): number[] {
  const mid = candles.map((c) => (c.h + c.l) / 2);
  const a = sma(mid, 5), b = sma(mid, 34);
  return mid.map((_, i) => a[i] - b[i]);
}

export function obv(candles: Candle[]): number[] {
  const out = nanArray(candles.length);
  let acc = 0;
  for (let i = 0; i < candles.length; i++) {
    if (i > 0) acc += candles[i].c > candles[i - 1].c ? candles[i].v : candles[i].c < candles[i - 1].c ? -candles[i].v : 0;
    out[i] = acc;
  }
  return out;
}

/** Supertrend: the trailing stop line and its direction (+1 up trend, -1 down trend). */
export function supertrend(candles: Candle[], period = 10, mult = 3): { line: number[]; direction: number[] } {
  const a = atr(candles, period);
  const line = nanArray(candles.length), direction = nanArray(candles.length);
  let upper = NaN, lower = NaN, dir = 1;
  for (let i = 0; i < candles.length; i++) {
    if (!Number.isFinite(a[i])) continue;
    const mid = (candles[i].h + candles[i].l) / 2;
    let up = mid + mult * a[i], lo = mid - mult * a[i];
    const prevClose = candles[i - 1]?.c ?? candles[i].c;
    if (Number.isFinite(lower) && !(lo > lower || prevClose < lower)) lo = lower;
    if (Number.isFinite(upper) && !(up < upper || prevClose > upper)) up = upper;
    if (Number.isFinite(upper) || Number.isFinite(lower)) {
      if (dir === 1 && candles[i].c < lower) dir = -1;
      else if (dir === -1 && candles[i].c > upper) dir = 1;
    }
    upper = up; lower = lo;
    direction[i] = dir;
    line[i] = dir === 1 ? lower : upper;
  }
  return { line, direction };
}

// ── Evaluation for the chart ────────────────────────────────────────────────

export type IndicatorSeries = { key: string; label: string; values: number[]; style: "line" | "histogram" | "band"; tone: "a" | "b" | "c" | "up" | "down" };
export type IndicatorOutput = { config: IndicatorConfig; meta: IndicatorMeta; series: IndicatorSeries[] };

export function evaluateIndicator(config: IndicatorConfig, candles: Candle[]): IndicatorOutput {
  const meta = indicatorMeta(config.type);
  const p = (key: string) => config.params[key] ?? meta.params.find((x) => x.key === key)?.default ?? 0;
  const closes = candles.map((c) => c.c);
  const label = indicatorLabel(config);
  let series: IndicatorSeries[] = [];
  switch (config.type) {
    case "sma": series = [{ key: "sma", label, values: sma(closes, p("period")), style: "line", tone: "a" }]; break;
    case "ema": series = [{ key: "ema", label, values: ema(closes, p("period")), style: "line", tone: "b" }]; break;
    case "vwap": series = [{ key: "vwap", label, values: vwap(candles), style: "line", tone: "c" }]; break;
    case "bb": { const b = bollinger(closes, p("period"), p("mult")); series = [{ key: "upper", label: `${label} upper`, values: b.upper, style: "band", tone: "a" }, { key: "middle", label, values: b.middle, style: "line", tone: "a" }, { key: "lower", label: `${label} lower`, values: b.lower, style: "band", tone: "a" }]; break; }
    case "supertrend": { const s = supertrend(candles, p("period"), p("mult")); series = [{ key: "up", label, values: s.line.map((v, i) => (s.direction[i] === 1 ? v : NaN)), style: "line", tone: "up" }, { key: "down", label, values: s.line.map((v, i) => (s.direction[i] === -1 ? v : NaN)), style: "line", tone: "down" }]; break; }
    case "rsi": series = [{ key: "rsi", label, values: rsi(closes, p("period")), style: "line", tone: "a" }]; break;
    case "macd": { const m = macd(closes, p("fast"), p("slow"), p("signal")); series = [{ key: "hist", label: "Histogram", values: m.histogram, style: "histogram", tone: "up" }, { key: "macd", label, values: m.macd, style: "line", tone: "a" }, { key: "signal", label: "Signal", values: m.signal, style: "line", tone: "b" }]; break; }
    case "stoch": { const s = stochastic(candles, p("k"), p("d")); series = [{ key: "k", label, values: s.k, style: "line", tone: "a" }, { key: "d", label: "%D", values: s.d, style: "line", tone: "b" }]; break; }
    case "atr": series = [{ key: "atr", label, values: atr(candles, p("period")), style: "line", tone: "a" }]; break;
    case "ao": series = [{ key: "ao", label, values: awesomeOscillator(candles), style: "histogram", tone: "up" }]; break;
    case "obv": series = [{ key: "obv", label, values: obv(candles), style: "line", tone: "a" }]; break;
  }
  return { config, meta, series };
}

// ── Persistence ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "veggat:chart-indicators";
const VALID = new Set<string>(INDICATOR_CATALOGUE.map((m) => m.type));

export function loadIndicators(): IndicatorConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is IndicatorConfig => Boolean(c) && typeof c === "object" && typeof (c as IndicatorConfig).id === "string" && VALID.has((c as IndicatorConfig).type) && typeof (c as IndicatorConfig).params === "object");
  } catch { return []; }
}

export function saveIndicators(list: IndicatorConfig[]): void {
  try { if (list.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); else localStorage.removeItem(STORAGE_KEY); } catch { /* Storage is optional. */ }
}
