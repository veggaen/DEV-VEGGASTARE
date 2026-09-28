/**
 * @fileOverview  Portfolio value over time, per account, kept in this
 *                browser: the hub records a point whenever it has a fresh
 *                total (live wallet on a chain, or the paper account), and
 *                the Portfolio panel charts them. Pure helpers here; storage
 *                is localStorage behind small guards.
 * @stability     experimental
 */
import type { Candle } from '@/lib/market/symbols';

export type SnapshotKind = 'live' | 'paper';
export type Snapshot = { t: number; usd: number };

const PREFIX = 'veggat:portfolio:';
export const SNAPSHOT_EVENT = 'veggat:portfolioSnapshot';
const MIN_GAP_MS = 30 * 60_000;
const MAX_POINTS = 5000;

export const snapshotKey = (kind: SnapshotKind, id: string): string => `${PREFIX}${kind}:${id.toLowerCase()}`;

export function readSnapshots(kind: SnapshotKind, id: string): Snapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(snapshotKey(kind, id));
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((p): p is Snapshot => Boolean(p) && typeof p === 'object' && Number.isFinite((p as Snapshot).t) && Number.isFinite((p as Snapshot).usd)) : [];
  } catch { return []; }
}

/** Pure: append a point, replacing the last one when it is younger than the minimum gap. */
export function appendSnapshot(list: Snapshot[], point: Snapshot, minGapMs = MIN_GAP_MS, maxPoints = MAX_POINTS): Snapshot[] {
  const last = list[list.length - 1];
  const next = last && point.t - last.t < minGapMs ? [...list.slice(0, -1), point] : [...list, point];
  return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
}

export function recordSnapshot(kind: SnapshotKind, id: string, usd: number, now = Date.now()): void {
  if (typeof window === 'undefined' || !Number.isFinite(usd) || usd < 0) return;
  const next = appendSnapshot(readSnapshots(kind, id), { t: now, usd });
  try { localStorage.setItem(snapshotKey(kind, id), JSON.stringify(next)); } catch { /* Storage is optional. */ }
  window.dispatchEvent(new Event(SNAPSHOT_EVENT));
}

/** Every account id with recorded points of this kind. */
export function listSnapshotIds(kind: SnapshotKind): string[] {
  if (typeof window === 'undefined') return [];
  const out: string[] = [];
  const head = `${PREFIX}${kind}:`;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(head)) out.push(k.slice(head.length)); } } catch { /* optional */ }
  return out.sort();
}

/** Sum several series on a shared time grid, carrying each series' last value forward. */
export function combineSeries(series: Snapshot[][], bucketMs: number): Snapshot[] {
  const times = new Set<number>();
  for (const s of series) for (const p of s) times.add(Math.floor(p.t / bucketMs) * bucketMs);
  const grid = Array.from(times).sort((a, b) => a - b);
  const cursors = series.map(() => 0);
  const lastVal = series.map(() => NaN);
  return grid.map((t) => {
    let sum = 0;
    series.forEach((s, i) => {
      while (cursors[i] < s.length && Math.floor(s[cursors[i]].t / bucketMs) * bucketMs <= t) { lastVal[i] = s[cursors[i]].usd; cursors[i]++; }
      if (Number.isFinite(lastVal[i])) sum += lastVal[i];
    });
    return { t, usd: sum };
  });
}

/** Points → candles for the chart (one bar per bucket; open/high/low/close from the points inside it). */
export function toCandles(points: Snapshot[], bucketMs: number): Candle[] {
  const out: Candle[] = [];
  for (const p of points) {
    const t = Math.floor(p.t / bucketMs) * bucketMs;
    const last = out[out.length - 1];
    if (last && last.t === t) { last.h = Math.max(last.h, p.usd); last.l = Math.min(last.l, p.usd); last.c = p.usd; }
    else out.push({ t, o: last ? last.c : p.usd, h: Math.max(p.usd, last ? last.c : p.usd), l: Math.min(p.usd, last ? last.c : p.usd), c: p.usd, v: 0 });
  }
  return out;
}
