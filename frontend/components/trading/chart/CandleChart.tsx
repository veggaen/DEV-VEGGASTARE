"use client";

/**
 * @fileOverview  CandleChart — a dependency-free canvas chart for the
 *                terminal in the spirit of TradingView's Supercharts:
 *                candles / line / area, volume overlay, crosshair with OHLC
 *                legend, wheel + pinch zoom, drag pan, last-price line,
 *                drawing tools with selection / move / reshape handles,
 *                a price axis you can drag or scroll to stretch (with auto
 *                and log modes), indicator overlays and stacked oscillator
 *                panes, and a compare series on a percent basis.
 *
 *                Everything is drawn from theme tokens read at draw time, so
 *                the chart follows light/dark and the accent preset. Drawings
 *                live in data space (time + price), see ./drawings.ts; the
 *                indicator maths lives in ./indicators.ts.
 * @stability     experimental
 */

import * as React from "react";
import type { Candle, Interval } from "@/lib/market/symbols";
import { INTERVAL_MS } from "@/lib/market/symbols";
import {
  FIB_LEVELS,
  distanceToSegment,
  formatCompact,
  formatPrice,
  newDrawingId,
  pointsNeeded,
  type Anchor,
  type Drawing,
  type DrawingTool,
} from "./drawings";
import { evaluateIndicator, type IndicatorConfig, type IndicatorOutput } from "./indicators";
import { cn } from "@/lib/utils";

export type ChartType = "candles" | "line" | "area";
export type TradeMarker = { t: number; price: number; side: "buy" | "sell" };
export type CompareSeries = { symbol: string; candles: Candle[]; color: string };

export type CandleChartProps = {
  candles: Candle[];
  interval: Interval;
  chartType?: ChartType;
  tool: DrawingTool;
  /** Called after a drawing completes so the toolbar can drop back to the cursor. */
  onToolDone?: () => void;
  drawings: Drawing[];
  onDrawingsChange: (next: Drawing[]) => void;
  markers?: TradeMarker[];
  showVolume?: boolean;
  indicators?: IndicatorConfig[];
  compare?: CompareSeries | null;
  className?: string;
  /** Optional: reset key (symbol) so the viewport re-fits on market change. */
  fitKey?: string;
};

type View = { offset: number; bars: number };
type Scale = { mode: "auto" | "manual"; min: number; max: number };
type Theme = { fg: string; muted: string; border: string; accent: string; up: string; down: string; card: string; font: string; hsl: (v: string, a?: number) => string };

const AXIS_W = 64;
const AXIS_H = 26;
const MIN_BARS = 8;
const MAX_BARS = 1500;
const HIT_PX = 7;
const FAR = 100_000;

function readTheme(el: HTMLElement): Theme {
  const cs = getComputedStyle(el);
  const get = (name: string) => cs.getPropertyValue(name).trim();
  const hsl = (v: string, a = 1) => (v ? `hsl(${v} / ${a})` : `rgba(128,128,128,${a})`);
  const font = getComputedStyle(document.body).fontFamily || "ui-sans-serif, system-ui, sans-serif";
  return { fg: get("--foreground"), muted: get("--muted-foreground"), border: get("--border"), accent: get("--brand-accent"), up: get("--chart-up"), down: get("--chart-down"), card: get("--card"), font, hsl };
}

function niceStep(range: number, target: number): number {
  const rough = range / Math.max(1, target);
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / pow;
  const step = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return step * pow;
}

/** Tick prices for a linear or a log axis. */
function priceTicks(min: number, max: number, log: boolean, target: number): number[] {
  if (!log) {
    const step = niceStep(max - min, target);
    const out: number[] = [];
    for (let p = Math.ceil(min / step) * step; p <= max; p += step) out.push(p);
    return out;
  }
  const lo = Math.max(min, 1e-12), hi = Math.max(max, lo * 1.0001);
  const decades = Math.log10(hi) - Math.log10(lo);
  const mantissas = decades > 4 ? [1] : decades > 2 ? [1, 3] : decades > 0.7 ? [1, 2, 5] : [1, 1.5, 2, 3, 4, 5, 6, 8];
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) for (const m of mantissas) { const p = m * Math.pow(10, e); if (p >= lo && p <= hi) out.push(p); }
  if (out.length > target * 2) { const keep = Math.ceil(out.length / (target * 2)); return out.filter((_, i) => i % keep === 0); }
  if (out.length < 3) { const step = niceStep(hi - lo, target); const lin: number[] = []; for (let p = Math.ceil(lo / step) * step; p <= hi; p += step) lin.push(p); return lin; }
  return out;
}

function timeLabel(t: number, interval: Interval, dayBoundary: boolean): string {
  const d = new Date(t);
  if (interval === "1d" || interval === "1w") return d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(d.getMonth() === 0 && d.getDate() <= 7 ? { year: "2-digit" } : {}) });
  if (dayBoundary) return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function crosshairTime(t: number, interval: Interval): string {
  const d = new Date(t);
  if (interval === "1d" || interval === "1w") return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}

const toneColor = (th: Theme, tone: "a" | "b" | "c" | "up" | "down", a = 1) =>
  tone === "a" ? th.hsl(th.accent, a) : tone === "b" ? th.hsl(th.fg, 0.75 * a) : tone === "c" ? th.hsl(th.muted, a) : tone === "up" ? th.hsl(th.up, a) : th.hsl(th.down, a);

const fmtIndicator = (v: number) => (Math.abs(v) >= 1000 ? formatCompact(v) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toPrecision(3));

export function CandleChart({ candles, interval, chartType = "candles", tool, onToolDone, drawings, onDrawingsChange, markers = [], showVolume = true, indicators = [], compare = null, className, fitKey }: CandleChartProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const viewRef = React.useRef<View>({ offset: 0, bars: 120 });
  const scaleRef = React.useRef<Scale>({ mode: "auto", min: 0, max: 1 });
  const logRef = React.useRef(false);
  const [manual, setManual] = React.useState(false);
  const [log, setLog] = React.useState(false);
  const stickRightRef = React.useRef(true);
  const hoverRef = React.useRef<{ x: number; y: number } | null>(null);
  const draftRef = React.useRef<Anchor[]>([]);
  const dragRef = React.useRef<
    | { kind: "pan"; startX: number; startY: number; startOffset: number; startScale: Scale; moved: boolean }
    | { kind: "move"; id: string; start: { x: number; y: number }; points: Anchor[]; moved: boolean }
    | { kind: "handle"; id: string; index: number }
    | { kind: "draw"; startX: number; startY: number; moved: boolean }
    | { kind: "scale"; startY: number; startScale: Scale }
    | { kind: "timescale"; startX: number; startBars: number; startOffset: number }
    | null
  >(null);
  const pinchRef = React.useRef<{ pointers: Map<number, { x: number; y: number }>; startDist: number; startBars: number } | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const selectedRef = React.useRef<string | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const indicatorCache = React.useRef<{ key: string; candles: Candle[]; outputs: IndicatorOutput[] }>({ key: "", candles: [], outputs: [] });
  const compareCache = React.useRef<{ candles: Candle[] | null; byTime: Map<number, number> }>({ candles: null, byTime: new Map() });

  // Latest props in refs so pointer handlers never go stale (assigned after
  // commit; handlers only run after that).
  const propsRef = React.useRef({ candles, interval, chartType, tool, drawings, onDrawingsChange, onToolDone, markers, showVolume, indicators, compare });
  React.useLayoutEffect(() => {
    propsRef.current = { candles, interval, chartType, tool, drawings, onDrawingsChange, onToolDone, markers, showVolume, indicators, compare };
    selectedRef.current = selected;
    logRef.current = log;
  });

  // ── Indicator outputs (memoised on candles + config) ─────────────────────
  const outputs = React.useCallback((): IndicatorOutput[] => {
    const { candles: c, indicators: list } = propsRef.current;
    const key = JSON.stringify(list);
    const cache = indicatorCache.current;
    if (cache.candles === c && cache.key === key) return cache.outputs;
    const next = list.map((cfg) => evaluateIndicator(cfg, c));
    indicatorCache.current = { key, candles: c, outputs: next };
    return next;
  }, []);
  const compareAt = React.useCallback((t: number): number | undefined => {
    const cmp = propsRef.current.compare;
    if (!cmp) return undefined;
    const cache = compareCache.current;
    if (cache.candles !== cmp.candles) compareCache.current = { candles: cmp.candles, byTime: new Map(cmp.candles.map((k) => [k.t, k.c])) };
    return compareCache.current.byTime.get(t);
  }, []);

  // ── Geometry helpers (all read from refs) ────────────────────────────────
  const geom = React.useCallback(() => {
    const el = canvasRef.current;
    const w = el?.clientWidth ?? 0, h = el?.clientHeight ?? 0;
    const paneCount = propsRef.current.indicators.filter((i) => evaluateIndicator(i, []).meta.placement === "pane").length;
    const paneH = paneCount ? Math.min(96, Math.max(48, ((h - AXIS_H) * 0.5) / paneCount)) : 0;
    const plotW = Math.max(10, w - AXIS_W), plotH = Math.max(10, h - AXIS_H - paneCount * paneH);
    const { offset, bars } = viewRef.current;
    const barW = plotW / bars;
    return { w, h, plotW, plotH, paneH, paneCount, offset, bars, barW };
  }, []);

  const indexToX = React.useCallback((i: number) => { const g = geom(); return (i - g.offset) * g.barW + g.barW / 2; }, [geom]);
  const xToIndex = React.useCallback((x: number) => { const g = geom(); return x / g.barW + g.offset - 0.5; }, [geom]);

  const timeToIndex = React.useCallback((t: number) => {
    const c = propsRef.current.candles; const ms = INTERVAL_MS[propsRef.current.interval];
    if (!c.length) return 0;
    if (t <= c[0].t) return (t - c[0].t) / ms;
    if (t >= c[c.length - 1].t) return c.length - 1 + (t - c[c.length - 1].t) / ms;
    let lo = 0, hi = c.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (c[mid].t <= t) lo = mid; else hi = mid; }
    const span = c[hi].t - c[lo].t || ms;
    return lo + (t - c[lo].t) / span;
  }, []);

  const indexToTime = React.useCallback((i: number) => {
    const c = propsRef.current.candles; const ms = INTERVAL_MS[propsRef.current.interval];
    if (!c.length) return 0;
    if (i <= 0) return c[0].t + i * ms;
    if (i >= c.length - 1) return c[c.length - 1].t + (i - (c.length - 1)) * ms;
    const lo = Math.floor(i), hi = Math.min(c.length - 1, lo + 1);
    return c[lo].t + (i - lo) * ((c[hi].t - c[lo].t) || ms);
  }, []);

  // Scale space: linear prices, or their logs when the log axis is on.
  const S = React.useCallback((p: number) => (logRef.current ? Math.log(Math.max(p, 1e-12)) : p), []);
  const F = React.useCallback((s: number) => (logRef.current ? Math.exp(s) : s), []);

  /** The visible price range: fitted to the visible bars (plus overlays) or the user's manual range. */
  const priceRange = React.useCallback((): { min: number; max: number } => {
    const sc = scaleRef.current;
    if (sc.mode === "manual") return { min: sc.min, max: sc.max };
    const c = propsRef.current.candles; const { offset, bars } = viewRef.current;
    const from = Math.max(0, Math.floor(offset)), to = Math.min(c.length - 1, Math.ceil(offset + bars));
    let min = Infinity, max = -Infinity;
    for (let i = from; i <= to; i++) { const k = c[i]; if (!k) continue; if (k.l < min) min = k.l; if (k.h > max) max = k.h; }
    for (const out of outputs()) if (out.meta.placement === "overlay") for (const s of out.series) for (let i = from; i <= to; i++) { const v = s.values[i]; if (Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; } }
    if (propsRef.current.compare && c[from]) {
      const baseMain = c[from].c, baseCmp = compareAt(c[from].t);
      if (baseCmp) for (let i = from; i <= to; i++) { const v = compareAt(c[i]?.t ?? NaN); if (v) { const p = baseMain * (v / baseCmp); if (p < min) min = p; if (p > max) max = p; } }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) { min = 0; max = 1; }
    if (max === min) { max = min * 1.01 || 1; min = min * 0.99; }
    if (logRef.current) { const lo = S(Math.max(min, 1e-12)), hi = S(max); const pad = (hi - lo) * 0.08; return { min: F(lo - pad), max: F(hi + pad) }; }
    const pad = (max - min) * 0.08;
    return { min: min - pad, max: max + pad };
  }, [outputs, compareAt, S, F]);

  const priceToY = React.useCallback((p: number) => { const g = geom(); const r = priceRange(); const lo = S(r.min), hi = S(r.max); return ((hi - S(p)) / (hi - lo)) * g.plotH; }, [geom, priceRange, S]);
  const yToPrice = React.useCallback((y: number) => { const g = geom(); const r = priceRange(); const lo = S(r.min), hi = S(r.max); return F(hi - (y / g.plotH) * (hi - lo)); }, [geom, priceRange, S, F]);

  const anchorToXY = React.useCallback((a: Anchor) => ({ x: indexToX(timeToIndex(a.t)), y: priceToY(a.p) }), [indexToX, timeToIndex, priceToY]);
  const xyToAnchor = React.useCallback((x: number, y: number, snapBar = true): Anchor => {
    const i = xToIndex(x); const idx = snapBar ? Math.round(i) : i;
    return { t: indexToTime(idx), p: yToPrice(y) };
  }, [xToIndex, indexToTime, yToPrice]);

  const setScale = React.useCallback((next: Scale) => { scaleRef.current = next; setManual(next.mode === "manual"); }, []);
  const resetScale = React.useCallback(() => setScale({ mode: "auto", min: 0, max: 1 }), [setScale]);

  // ── Hit testing ──────────────────────────────────────────────────────────
  const hitTest = React.useCallback((x: number, y: number): { id: string; handle?: number } | null => {
    const g = geom();
    const list = propsRef.current.drawings;
    for (let n = list.length - 1; n >= 0; n--) {
      const d = list[n];
      const pts = d.points.map(anchorToXY);
      for (let i = 0; i < pts.length; i++) if (Math.hypot(pts[i].x - x, pts[i].y - y) <= HIT_PX + 2) return { id: d.id, handle: i };
      if (d.type === "hline") { if (Math.abs(pts[0].y - y) <= HIT_PX) return { id: d.id }; continue; }
      if (d.type === "vline") { if (Math.abs(pts[0].x - x) <= HIT_PX) return { id: d.id }; continue; }
      if (d.type === "crossline") { if (Math.abs(pts[0].x - x) <= HIT_PX || Math.abs(pts[0].y - y) <= HIT_PX) return { id: d.id }; continue; }
      if (pts.length < 2) continue;
      const [a, b] = pts;
      if (d.type === "trend" && distanceToSegment(x, y, a.x, a.y, b.x, b.y) <= HIT_PX) return { id: d.id };
      if (d.type === "ray" || d.type === "extended") {
        const dx = b.x - a.x, dy = b.y - a.y; const far = dx === 0 && dy === 0 ? b : { x: a.x + dx * FAR, y: a.y + dy * FAR };
        const near = d.type === "extended" && !(dx === 0 && dy === 0) ? { x: a.x - dx * FAR, y: a.y - dy * FAR } : a;
        if (distanceToSegment(x, y, near.x, near.y, far.x, far.y) <= HIT_PX) return { id: d.id };
      }
      if (d.type === "rect") {
        const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x), y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
        const onEdge = (Math.abs(x - x1) <= HIT_PX || Math.abs(x - x2) <= HIT_PX) && y >= y1 - HIT_PX && y <= y2 + HIT_PX
          || (Math.abs(y - y1) <= HIT_PX || Math.abs(y - y2) <= HIT_PX) && x >= x1 - HIT_PX && x <= x2 + HIT_PX;
        if (onEdge || (x > x1 && x < x2 && y > y1 && y < y2)) return { id: d.id };
      }
      if (d.type === "fib") {
        const x1 = Math.min(a.x, b.x);
        for (const lv of FIB_LEVELS) { const yy = a.y + (b.y - a.y) * lv; if (Math.abs(y - yy) <= HIT_PX && x >= x1 - HIT_PX && x <= g.plotW) return { id: d.id }; }
      }
    }
    return null;
  }, [geom, anchorToXY]);

  // ── Drawing ──────────────────────────────────────────────────────────────
  const draw = React.useCallback(() => {
    rafRef.current = null;
    const canvas = canvasRef.current, wrap = wrapRef.current; if (!canvas || !wrap) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const th = readTheme(wrap);
    const { candles: c, interval: iv, chartType: type, drawings: list, markers: mk, showVolume: vol, compare: cmp } = propsRef.current;
    const g = geom();
    ctx.font = `11px ${th.font}`;
    ctx.textBaseline = "middle";

    if (!c.length) {
      ctx.fillStyle = th.hsl(th.muted); ctx.textAlign = "center"; ctx.fillText("No price data", g.plotW / 2, g.plotH / 2); return;
    }

    const range = priceRange();
    const lo = S(range.min), hi = S(range.max);
    const y = (p: number) => ((hi - S(p)) / (hi - lo)) * g.plotH;
    const x = (i: number) => (i - g.offset) * g.barW + g.barW / 2;
    const from = Math.max(0, Math.floor(g.offset) - 1), to = Math.min(c.length - 1, Math.ceil(g.offset + g.bars) + 1);
    const outs = outputs();

    // Grid + price axis
    ctx.strokeStyle = th.hsl(th.border, 0.6); ctx.lineWidth = 1;
    ctx.fillStyle = th.hsl(th.muted); ctx.textAlign = "left";
    for (const p of priceTicks(range.min, range.max, logRef.current, Math.max(3, Math.floor(g.plotH / 60)))) {
      const yy = Math.round(y(p)) + 0.5;
      if (yy < 0 || yy > g.plotH) continue;
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(g.plotW, yy); ctx.stroke();
      ctx.fillText(formatPrice(p), g.plotW + 8, yy);
    }
    // Time axis (labels sit below the panes)
    const axisY = g.plotH + g.paneCount * g.paneH;
    const labelEvery = Math.max(1, Math.ceil(80 / g.barW));
    ctx.textAlign = "center";
    let lastDay = -1; let lastRight = -Infinity;
    for (let i = from; i <= to; i++) {
      const k = c[i]; if (!k) continue;
      const day = new Date(k.t).getDate(); const boundary = day !== lastDay && i > from; lastDay = day;
      if (i % labelEvery !== 0 && !(boundary && iv !== "1d" && iv !== "1w" && labelEvery > 1 && i % Math.max(1, Math.floor(labelEvery / 2)) === 0)) continue;
      const xx = Math.round(x(i)) + 0.5;
      ctx.strokeStyle = th.hsl(th.border, 0.5); ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, axisY); ctx.stroke();
      const label = timeLabel(k.t, iv, boundary); const half = ctx.measureText(label).width / 2;
      if (xx - half < 2 || xx + half > g.plotW - 2) continue; // never draw a clipped label
      if (xx - half < lastRight + 8) continue; // never draw a label over another one
      lastRight = xx + half;
      ctx.fillStyle = th.hsl(th.muted, boundary ? 1 : 0.85); ctx.fillText(label, xx, axisY + AXIS_H / 2);
    }

    // Volume overlay (bottom 18% of the plot)
    if (vol) {
      let vmax = 0; for (let i = from; i <= to; i++) if (c[i] && c[i].v > vmax) vmax = c[i].v;
      if (vmax > 0) {
        const vh = g.plotH * 0.18;
        for (let i = from; i <= to; i++) {
          const k = c[i]; if (!k) continue;
          const bw = Math.max(1, g.barW * 0.7); const xx = x(i) - bw / 2; const hh = (k.v / vmax) * vh;
          ctx.fillStyle = th.hsl(k.c >= k.o ? th.up : th.down, 0.22);
          ctx.fillRect(xx, g.plotH - hh, bw, hh);
        }
      }
    }

    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, g.plotW, g.plotH); ctx.clip();

    // Overlay indicator bands first (under the price)
    const polyline = (values: number[], color: string, width = 1.2, dash?: number[]) => {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round"; if (dash) ctx.setLineDash(dash);
      ctx.beginPath(); let open = false;
      for (let i = from; i <= to; i++) { const v = values[i]; if (!Number.isFinite(v)) { open = false; continue; } const px = x(i), py = y(v); if (!open) { ctx.moveTo(px, py); open = true; } else ctx.lineTo(px, py); }
      ctx.stroke(); ctx.restore();
    };
    for (const out of outs) {
      if (out.meta.placement !== "overlay") continue;
      const bands = out.series.filter((s) => s.style === "band");
      if (bands.length === 2) {
        ctx.save(); ctx.fillStyle = toneColor(th, "a", 0.06); ctx.beginPath(); let started = false;
        for (let i = from; i <= to; i++) { const v = bands[0].values[i]; if (!Number.isFinite(v)) continue; const px = x(i), py = y(v); if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py); }
        for (let i = to; i >= from; i--) { const v = bands[1].values[i]; if (!Number.isFinite(v)) continue; ctx.lineTo(x(i), y(v)); }
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }

    // Price series
    if (type === "candles") {
      const bw = Math.max(1, Math.floor(g.barW * 0.7));
      for (let i = from; i <= to; i++) {
        const k = c[i]; if (!k) continue;
        const up = k.c >= k.o; const col = th.hsl(up ? th.up : th.down);
        const xx = Math.round(x(i)) + 0.5;
        ctx.strokeStyle = col; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(xx, y(k.h)); ctx.lineTo(xx, y(k.l)); ctx.stroke();
        const yo = y(k.o), yc = y(k.c); const top = Math.min(yo, yc); const hh = Math.max(1, Math.abs(yc - yo));
        ctx.fillStyle = col;
        if (bw <= 2) { ctx.fillRect(xx - 0.5, top, 1, hh); }
        else { ctx.fillRect(Math.round(x(i) - bw / 2), top, bw, hh); }
      }
    } else {
      ctx.beginPath();
      for (let i = from; i <= to; i++) { const k = c[i]; if (!k) continue; const px = x(i), py = y(k.c); if (i === from) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      if (type === "area") {
        const grad = ctx.createLinearGradient(0, 0, 0, g.plotH); grad.addColorStop(0, th.hsl(th.accent, 0.28)); grad.addColorStop(1, th.hsl(th.accent, 0));
        ctx.save(); ctx.lineTo(x(to), g.plotH); ctx.lineTo(x(from), g.plotH); ctx.closePath(); ctx.fillStyle = grad; ctx.fill(); ctx.restore();
        ctx.beginPath();
        for (let i = from; i <= to; i++) { const k = c[i]; if (!k) continue; const px = x(i), py = y(k.c); if (i === from) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      }
      ctx.strokeStyle = th.hsl(th.accent); ctx.lineWidth = 1.6; ctx.lineJoin = "round"; ctx.stroke();
    }

    // Overlay indicator lines (over the price)
    for (const out of outs) {
      if (out.meta.placement !== "overlay") continue;
      for (const s of out.series) polyline(s.values, toneColor(th, s.tone, s.style === "band" ? 0.55 : 0.95), s.style === "band" ? 1 : 1.4, s.style === "band" ? [3, 3] : undefined);
    }

    // Compare series: percent basis from the first visible bar, drawn in price space
    let comparePct: number | null = null;
    if (cmp && c[Math.max(0, from)]) {
      const base = Math.max(0, Math.floor(g.offset));
      const baseMain = c[base]?.c, baseCmp = compareAt(c[base]?.t ?? NaN);
      if (baseMain && baseCmp) {
        const values = c.map((k) => { const v = compareAt(k.t); return v ? baseMain * (v / baseCmp) : NaN; });
        polyline(values, cmp.color, 1.6);
        const lastIdx = Math.min(c.length - 1, Math.ceil(g.offset + g.bars));
        const lastVal = compareAt(c[lastIdx]?.t ?? NaN);
        if (lastVal) comparePct = (lastVal / baseCmp - 1) * 100;
      }
    }

    // Trade markers
    for (const m of mk) {
      const i = timeToIndex(m.t); if (i < from - 1 || i > to + 1) continue;
      const px = x(i), py = y(m.price); const up = m.side === "buy";
      ctx.fillStyle = th.hsl(up ? th.up : th.down);
      ctx.beginPath();
      if (up) { ctx.moveTo(px, py + 14); ctx.lineTo(px - 5, py + 22); ctx.lineTo(px + 5, py + 22); }
      else { ctx.moveTo(px, py - 14); ctx.lineTo(px - 5, py - 22); ctx.lineTo(px + 5, py - 22); }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // Last price line + label
    const last = c[c.length - 1]; const prev = c[c.length - 2] ?? last;
    const ly = Math.round(y(last.c)) + 0.5; const lastUp = last.c >= prev.c;
    if (ly >= 0 && ly <= g.plotH) {
      ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = th.hsl(lastUp ? th.up : th.down, 0.8); ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(g.plotW, ly); ctx.stroke(); ctx.restore();
      ctx.fillStyle = th.hsl(lastUp ? th.up : th.down); ctx.fillRect(g.plotW + 2, ly - 9, AXIS_W - 4, 18);
      ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText(formatPrice(last.c), g.plotW + 8, ly);
    }

    // Drawings
    const drawOne = (d: Drawing, isSel: boolean, ghost = false) => {
      const pts = d.points.map(anchorToXY);
      const col = th.hsl(th.accent, ghost ? 0.7 : 1);
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = isSel ? 2 : 1.4; ctx.lineJoin = "round";
      if (ghost) ctx.setLineDash([4, 3]);
      const hline = (yy0: number, price: number) => {
        const yy = Math.round(yy0) + 0.5; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(g.plotW, yy); ctx.stroke();
        ctx.fillStyle = th.hsl(th.accent); ctx.fillRect(g.plotW + 2, yy - 9, AXIS_W - 4, 18); ctx.fillStyle = th.hsl(th.card); ctx.textAlign = "left"; ctx.fillText(formatPrice(price), g.plotW + 8, yy);
      };
      const vline = (xx0: number, t: number) => {
        const xx = Math.round(xx0) + 0.5; ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, axisY); ctx.stroke();
        const label = crosshairTime(t, iv); const tw = ctx.measureText(label).width + 12; const tx = Math.max(0, Math.min(g.plotW - tw, xx - tw / 2));
        ctx.fillStyle = th.hsl(th.accent); ctx.fillRect(tx, axisY + 3, tw, AXIS_H - 6); ctx.fillStyle = th.hsl(th.card); ctx.textAlign = "center"; ctx.fillText(label, tx + tw / 2, axisY + AXIS_H / 2);
      };
      if (d.type === "hline" && pts[0]) hline(pts[0].y, d.points[0].p);
      else if (d.type === "vline" && pts[0]) vline(pts[0].x, d.points[0].t);
      else if (d.type === "crossline" && pts[0]) { hline(pts[0].y, d.points[0].p); ctx.strokeStyle = col; vline(pts[0].x, d.points[0].t); }
      else if (pts.length >= 2) {
        const [a, b] = pts;
        if (d.type === "trend") { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        if (d.type === "ray" || d.type === "extended") {
          const dx = b.x - a.x, dy = b.y - a.y; const k = dx === 0 && dy === 0 ? 0 : FAR;
          ctx.beginPath(); ctx.moveTo(d.type === "extended" ? a.x - dx * k : a.x, d.type === "extended" ? a.y - dy * k : a.y); ctx.lineTo(a.x + dx * k, a.y + dy * k); ctx.stroke();
        }
        if (d.type === "rect") { const x1 = Math.min(a.x, b.x), y1 = Math.min(a.y, b.y); ctx.fillStyle = th.hsl(th.accent, 0.08); ctx.fillRect(x1, y1, Math.abs(b.x - a.x), Math.abs(b.y - a.y)); ctx.strokeRect(x1 + 0.5, y1 + 0.5, Math.abs(b.x - a.x), Math.abs(b.y - a.y)); }
        if (d.type === "fib") {
          const x1 = Math.min(a.x, b.x); const p1 = d.points[0].p, p2 = d.points[1].p;
          ctx.font = `10px ${th.font}`; ctx.textAlign = "left";
          for (const lv of FIB_LEVELS) {
            const yy = Math.round(a.y + (b.y - a.y) * lv) + 0.5; const price = p1 + (p2 - p1) * lv;
            ctx.strokeStyle = th.hsl(th.accent, lv === 0 || lv === 1 ? 0.9 : 0.55); ctx.beginPath(); ctx.moveTo(x1, yy); ctx.lineTo(g.plotW, yy); ctx.stroke();
            ctx.fillStyle = th.hsl(th.fg, 0.85); ctx.fillText(`${(lv * 100).toFixed(1)}%  ${formatPrice(price)}`, x1 + 4, yy - 7);
          }
          const yTop = Math.min(a.y, b.y), yBot = Math.max(a.y, b.y); ctx.fillStyle = th.hsl(th.accent, 0.05); ctx.fillRect(x1, yTop, g.plotW - x1, yBot - yTop);
          ctx.font = `11px ${th.font}`;
        }
      }
      if (isSel) { ctx.setLineDash([]); for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2); ctx.fillStyle = th.hsl(th.card); ctx.fill(); ctx.strokeStyle = th.hsl(th.accent); ctx.lineWidth = 1.5; ctx.stroke(); } }
      ctx.restore();
    };
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, g.plotW + AXIS_W, axisY + AXIS_H); ctx.clip();
    for (const d of list) drawOne(d, d.id === selectedRef.current);
    // In-progress draft
    const hv = hoverRef.current; const draft = draftRef.current; const t = propsRef.current.tool;
    if (draft.length && hv && t !== "cursor") {
      const ghost: Drawing = { id: "draft", type: t, points: pointsNeeded(t) === 1 ? draft : [draft[0], xyToAnchor(hv.x, hv.y)] };
      drawOne(ghost, false, true);
    }
    ctx.restore();

    // Oscillator panes
    const hoverIdx = hv ? Math.round(xToIndex(hv.x)) : c.length - 1;
    const hi2 = Math.max(0, Math.min(c.length - 1, hoverIdx));
    let paneTop = g.plotH;
    for (const out of outs) {
      if (out.meta.placement !== "pane") continue;
      const top = paneTop; const bottom = top + g.paneH; paneTop = bottom;
      ctx.strokeStyle = th.hsl(th.border, 0.9); ctx.beginPath(); ctx.moveTo(0, Math.round(top) + 0.5); ctx.lineTo(g.w, Math.round(top) + 0.5); ctx.stroke();
      let pmin = Infinity, pmax = -Infinity;
      if (out.meta.range) { [pmin, pmax] = out.meta.range; }
      else { for (const s of out.series) for (let i = from; i <= to; i++) { const v = s.values[i]; if (Number.isFinite(v)) { if (v < pmin) pmin = v; if (v > pmax) pmax = v; } } if (!Number.isFinite(pmin)) { pmin = 0; pmax = 1; } if (pmin === pmax) { pmax = pmin + 1; } const pad = (pmax - pmin) * 0.1; pmin -= pad; pmax += pad; }
      const py = (v: number) => bottom - ((v - pmin) / (pmax - pmin)) * (g.paneH - 14) - 4;
      ctx.save(); ctx.beginPath(); ctx.rect(0, top, g.plotW, g.paneH); ctx.clip();
      for (const lv of out.meta.levels ?? []) { if (lv < pmin || lv > pmax) continue; const yy = Math.round(py(lv)) + 0.5; ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = th.hsl(th.border, 0.9); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(g.plotW, yy); ctx.stroke(); ctx.restore(); }
      for (const s of out.series) {
        if (s.style === "histogram") {
          const bw = Math.max(1, g.barW * 0.6); const zero = py(0);
          for (let i = from; i <= to; i++) { const v = s.values[i]; if (!Number.isFinite(v)) continue; const prevV = s.values[i - 1]; const rising = Number.isFinite(prevV) ? v >= prevV : v >= 0; ctx.fillStyle = th.hsl(rising ? th.up : th.down, 0.7); const yy = py(v); ctx.fillRect(x(i) - bw / 2, Math.min(yy, zero), bw, Math.max(1, Math.abs(zero - yy))); }
        } else {
          ctx.save(); ctx.strokeStyle = toneColor(th, s.tone); ctx.lineWidth = 1.2; ctx.beginPath(); let open = false;
          for (let i = from; i <= to; i++) { const v = s.values[i]; if (!Number.isFinite(v)) { open = false; continue; } const px = x(i), yy = py(v); if (!open) { ctx.moveTo(px, yy); open = true; } else ctx.lineTo(px, yy); }
          ctx.stroke(); ctx.restore();
        }
      }
      ctx.restore();
      // Pane axis labels + legend
      ctx.fillStyle = th.hsl(th.muted); ctx.textAlign = "left"; ctx.font = `10px ${th.font}`;
      const ticks = out.meta.levels?.length ? [pmin + (pmax - pmin) * 0.1, ...(out.meta.levels ?? []), pmax - (pmax - pmin) * 0.1] : [pmin + (pmax - pmin) * 0.1, (pmin + pmax) / 2, pmax - (pmax - pmin) * 0.1];
      for (const tv of ticks) if (tv >= pmin && tv <= pmax) ctx.fillText(fmtIndicator(tv), g.plotW + 8, py(tv));
      const vals = out.series.map((s) => { const v = s.values[hi2]; return `${s.label === out.series[0].label && s === out.series[0] ? "" : `${s.label} `}${Number.isFinite(v) ? fmtIndicator(v) : "—"}`; });
      ctx.fillStyle = th.hsl(th.fg, 0.9); ctx.fillText(`${out.series[0].label}  ${vals.join("  ")}`, 8, top + 10);
      ctx.font = `11px ${th.font}`;
    }

    // Crosshair + legend
    const hk = c[hi2] ?? last;
    if (hv && hv.x >= 0 && hv.x <= g.plotW && hv.y >= 0 && hv.y <= axisY) {
      const cx = Math.round(x(Math.round(xToIndex(hv.x)))) + 0.5, cy = Math.round(hv.y) + 0.5;
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = th.hsl(th.fg, 0.35); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, axisY); if (hv.y <= g.plotH) { ctx.moveTo(0, cy); ctx.lineTo(g.plotW, cy); } ctx.stroke(); ctx.restore();
      if (hv.y <= g.plotH) { ctx.fillStyle = th.hsl(th.fg); ctx.fillRect(g.plotW + 2, cy - 9, AXIS_W - 4, 18); ctx.fillStyle = th.hsl(th.card); ctx.textAlign = "left"; ctx.fillText(formatPrice(yToPrice(hv.y)), g.plotW + 8, cy); }
      const label = crosshairTime(indexToTime(Math.round(xToIndex(hv.x))), iv); const tw = ctx.measureText(label).width + 12;
      const tx = Math.max(0, Math.min(g.plotW - tw, cx - tw / 2));
      ctx.fillStyle = th.hsl(th.fg); ctx.fillRect(tx, axisY + 3, tw, AXIS_H - 6); ctx.fillStyle = th.hsl(th.card); ctx.textAlign = "center"; ctx.fillText(label, tx + tw / 2, axisY + AXIS_H / 2);
    }
    // OHLC legend
    const up = hk.c >= hk.o; const chg = hk.o ? ((hk.c - hk.o) / hk.o) * 100 : 0;
    ctx.textAlign = "left"; ctx.font = `11px ${th.font}`;
    const parts: Array<[string, string, string]> = [["O", formatPrice(hk.o), th.hsl(th.fg, 0.9)], ["H", formatPrice(hk.h), th.hsl(th.fg, 0.9)], ["L", formatPrice(hk.l), th.hsl(th.fg, 0.9)], ["C", formatPrice(hk.c), th.hsl(up ? th.up : th.down)], ["", `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`, th.hsl(up ? th.up : th.down)], ["Vol", formatCompact(hk.v), th.hsl(th.muted)]];
    let lx = 10;
    for (const [k, v, col] of parts) {
      if (k) { ctx.fillStyle = th.hsl(th.muted); ctx.fillText(k, lx, 12); lx += ctx.measureText(k).width + 4; }
      ctx.fillStyle = col; ctx.fillText(v, lx, 12); lx += ctx.measureText(v).width + 12;
    }
    // Overlay indicator values + compare, second legend line
    const legend2: Array<[string, string]> = [];
    for (const out of outs) if (out.meta.placement === "overlay") { const s = out.series.find((q) => q.style === "line") ?? out.series[0]; const v = s.values[hi2]; legend2.push([s.label, Number.isFinite(v) ? formatPrice(v) : "—"]); }
    if (cmp) legend2.push([`vs ${cmp.symbol}`, comparePct == null ? "—" : `${comparePct >= 0 ? "+" : ""}${comparePct.toFixed(2)}%`]);
    if (legend2.length) {
      let lx2 = 10; ctx.font = `10px ${th.font}`;
      for (const [k, v] of legend2) { ctx.fillStyle = th.hsl(th.muted); ctx.fillText(k, lx2, 28); lx2 += ctx.measureText(k).width + 4; ctx.fillStyle = th.hsl(th.fg, 0.9); ctx.fillText(v, lx2, 28); lx2 += ctx.measureText(v).width + 12; }
      ctx.font = `11px ${th.font}`;
    }
  }, [geom, priceRange, anchorToXY, xyToAnchor, xToIndex, indexToTime, timeToIndex, yToPrice, outputs, compareAt, S]);

  const schedule = React.useCallback(() => { if (rafRef.current == null) rafRef.current = requestAnimationFrame(draw); }, [draw]);

  // Fit the newest bars into view (initial + on market change).
  const fit = React.useCallback((bars = 120) => {
    const n = propsRef.current.candles.length;
    const b = Math.max(MIN_BARS, Math.min(MAX_BARS, Math.min(bars, Math.max(MIN_BARS, n))));
    viewRef.current = { offset: Math.max(0, n - b + 3), bars: b };
    stickRightRef.current = true; resetScale(); schedule();
  }, [schedule, resetScale]);

  const lastFitKey = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (candles.length && lastFitKey.current !== fitKey) { lastFitKey.current = fitKey; fit(); }
    else if (stickRightRef.current && candles.length) {
      const v = viewRef.current; viewRef.current = { ...v, offset: Math.max(0, candles.length - v.bars + 3) };
    }
    schedule();
  }, [candles, fitKey, fit, schedule]);
  React.useEffect(() => { schedule(); }, [drawings, chartType, tool, markers, showVolume, selected, indicators, compare, log, schedule]);

  // Resize + theme changes
  React.useEffect(() => {
    const el = canvasRef.current; if (!el) return;
    const ro = new ResizeObserver(() => schedule()); ro.observe(el);
    const mo = new MutationObserver(() => schedule()); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-accent"] });
    // Clear the handle too: StrictMode re-runs this effect, and a stale id
    // would make every later schedule() a no-op (blank chart).
    return () => { ro.disconnect(); mo.disconnect(); if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
  }, [schedule]);

  // ── Pointer interactions ─────────────────────────────────────────────────
  const local = (e: { clientX: number; clientY: number }) => { const r = canvasRef.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const region = (x: number, y: number): "plot" | "priceAxis" | "timeAxis" | "pane" => {
    const g = geom();
    if (x > g.plotW && y <= g.plotH) return "priceAxis";
    if (y > g.plotH + g.paneCount * g.paneH) return "timeAxis";
    if (y > g.plotH) return "pane";
    return "plot";
  };

  const commitDrawings = (next: Drawing[]) => { propsRef.current.onDrawingsChange(next); };

  const freezeScale = (): Scale => { const r = priceRange(); const next: Scale = { mode: "manual", min: r.min, max: r.max }; scaleRef.current = next; return next; };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!; canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = local(e); const g = geom();
    if (pinchRef.current || e.pointerType === "touch") {
      const p = pinchRef.current ?? { pointers: new Map(), startDist: 0, startBars: viewRef.current.bars };
      p.pointers.set(e.pointerId, { x, y }); pinchRef.current = p;
      if (p.pointers.size === 2) { const [a, b] = Array.from(p.pointers.values()); p.startDist = Math.hypot(a.x - b.x, a.y - b.y); p.startBars = viewRef.current.bars; dragRef.current = null; return; }
    }
    const where = region(x, y);
    if (where === "priceAxis") { dragRef.current = { kind: "scale", startY: y, startScale: freezeScale() }; setManual(true); return; }
    if (where === "timeAxis") { dragRef.current = { kind: "timescale", startX: x, startBars: viewRef.current.bars, startOffset: viewRef.current.offset }; return; }
    if (x > g.plotW) return;
    if (where === "pane") { dragRef.current = { kind: "pan", startX: x, startY: y, startOffset: viewRef.current.offset, startScale: { ...scaleRef.current }, moved: false }; return; }
    const t = propsRef.current.tool;
    if (t !== "cursor") {
      const a = xyToAnchor(x, y);
      if (draftRef.current.length === 0) { draftRef.current = [a]; dragRef.current = { kind: "draw", startX: x, startY: y, moved: false }; }
      else { finishDrawing(a); }
      if (pointsNeeded(t) === 1) finishDrawing(a);
      schedule(); return;
    }
    const hit = hitTest(x, y);
    if (hit) {
      setSelected(hit.id);
      const d = propsRef.current.drawings.find((dd) => dd.id === hit.id)!;
      if (hit.handle != null) dragRef.current = { kind: "handle", id: hit.id, index: hit.handle };
      else dragRef.current = { kind: "move", id: hit.id, start: { x, y }, points: d.points.map((p) => ({ ...p })), moved: false };
      return;
    }
    setSelected(null);
    dragRef.current = { kind: "pan", startX: x, startY: y, startOffset: viewRef.current.offset, startScale: { ...scaleRef.current }, moved: false };
  };

  const finishDrawing = (a: Anchor) => {
    const t = propsRef.current.tool; if (t === "cursor") return;
    const pts = pointsNeeded(t) === 1 ? [a] : [draftRef.current[0], a];
    if (pts.length === 2 && pts[0].t === pts[1].t && pts[0].p === pts[1].p) { draftRef.current = []; return; }
    const d: Drawing = { id: newDrawingId(), type: t, points: pts };
    draftRef.current = []; dragRef.current = null;
    commitDrawings([...propsRef.current.drawings, d]);
    setSelected(d.id);
    propsRef.current.onToolDone?.();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = local(e);
    const p = pinchRef.current;
    if (p && p.pointers.has(e.pointerId)) {
      p.pointers.set(e.pointerId, { x, y });
      if (p.pointers.size === 2 && p.startDist > 0) {
        const [a, b] = Array.from(p.pointers.values()); const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const bars = Math.max(MIN_BARS, Math.min(MAX_BARS, p.startBars * (p.startDist / Math.max(1, dist))));
        const g = geom(); const cx = (a.x + b.x) / 2; const anchorIdx = xToIndex(cx);
        viewRef.current = { bars, offset: anchorIdx - (cx / g.plotW) * bars + 0.5 }; stickRightRef.current = false; schedule(); return;
      }
    }
    hoverRef.current = { x, y };
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (canvas && !drag) {
      const where = region(x, y);
      canvas.style.cursor = where === "priceAxis" ? "ns-resize" : where === "timeAxis" ? "ew-resize" : propsRef.current.tool === "cursor" ? "crosshair" : "crosshair";
    }
    if (drag?.kind === "scale") {
      // Drag down to stretch the range (zoom out), up to squeeze it, around the centre.
      const g = geom();
      const k = Math.exp((y - drag.startY) / Math.max(60, g.plotH * 0.35));
      const lo = S(drag.startScale.min), hi = S(drag.startScale.max);
      const centre = (lo + hi) / 2, half = ((hi - lo) / 2) * k;
      setScale({ mode: "manual", min: F(centre - half), max: F(centre + half) });
    } else if (drag?.kind === "timescale") {
      const g = geom(); const n = propsRef.current.candles.length;
      const bars = Math.max(MIN_BARS, Math.min(MAX_BARS, drag.startBars * Math.exp(-(x - drag.startX) / Math.max(80, g.plotW * 0.4))));
      const rightEdge = drag.startOffset + drag.startBars;
      viewRef.current = { bars, offset: Math.max(-bars * 0.5, Math.min(n - 3, rightEdge - bars)) };
    } else if (drag?.kind === "pan") {
      const g = geom(); const dx = x - drag.startX; const dy = y - drag.startY; if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
      const n = propsRef.current.candles.length;
      const offset = Math.max(-g.bars * 0.5, Math.min(n - 3, drag.startOffset - dx / g.barW));
      viewRef.current = { ...viewRef.current, offset }; stickRightRef.current = offset + g.bars >= n - 1;
      if (drag.startScale.mode === "manual") {
        // A manual price scale pans vertically with the pointer, like the time axis pans horizontally.
        const lo = S(drag.startScale.min), hi = S(drag.startScale.max);
        const delta = (dy / g.plotH) * (hi - lo);
        scaleRef.current = { mode: "manual", min: F(lo + delta), max: F(hi + delta) };
      }
    } else if (drag?.kind === "move") {
      const dx = x - drag.start.x, dy = y - drag.start.y; if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
      const g = geom(); const di = dx / g.barW; const r = priceRange(); const dp = -(dy / g.plotH) * (S(r.max) - S(r.min));
      const moved = drag.points.map((pt) => ({ t: indexToTime(timeToIndex(pt.t) + di), p: F(S(pt.p) + dp) }));
      commitDrawings(propsRef.current.drawings.map((d) => (d.id === drag.id ? { ...d, points: moved } : d)));
    } else if (drag?.kind === "handle") {
      const a = xyToAnchor(x, y);
      commitDrawings(propsRef.current.drawings.map((d) => (d.id === drag.id ? { ...d, points: d.points.map((pt, i) => (i === drag.index ? a : pt)) } : d)));
    } else if (drag?.kind === "draw") {
      if (Math.hypot(x - drag.startX, y - drag.startY) > 4) drag.moved = true;
    }
    schedule();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = local(e);
    const p = pinchRef.current; if (p) { p.pointers.delete(e.pointerId); if (p.pointers.size === 0) pinchRef.current = null; }
    const drag = dragRef.current;
    if (drag?.kind === "draw" && drag.moved && draftRef.current.length) { finishDrawing(xyToAnchor(x, y)); }
    else if (drag?.kind !== "draw") dragRef.current = null;
    if (drag?.kind === "draw" && !drag.moved) dragRef.current = null; // wait for the second click
    schedule();
  };

  const onPointerLeave = () => { hoverRef.current = null; schedule(); };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x, y } = local(e); const g = geom(); const n = propsRef.current.candles.length;
    if (region(x, y) === "priceAxis") {
      // Scroll on the price axis stretches or squeezes the scale around the price under the pointer.
      const cur = scaleRef.current.mode === "manual" ? scaleRef.current : freezeScale();
      const k = Math.pow(1.0015, e.deltaY);
      const anchor = S(yToPrice(y)); const lo = S(cur.min), hi = S(cur.max);
      setScale({ mode: "manual", min: F(anchor - (anchor - lo) * k), max: F(anchor + (hi - anchor) * k) });
      schedule(); return;
    }
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const offset = Math.max(-g.bars * 0.5, Math.min(n - 3, viewRef.current.offset + (e.deltaX || e.deltaY) / g.barW));
      viewRef.current = { ...viewRef.current, offset }; stickRightRef.current = offset + g.bars >= n - 1; schedule(); return;
    }
    const factor = Math.pow(1.0015, e.deltaY);
    const bars = Math.max(MIN_BARS, Math.min(MAX_BARS, viewRef.current.bars * factor));
    const anchorIdx = xToIndex(x);
    const offset = anchorIdx - (x / g.plotW) * bars + 0.5;
    viewRef.current = { bars, offset: Math.max(-bars * 0.5, Math.min(n - 3, offset)) };
    stickRightRef.current = viewRef.current.offset + bars >= n - 1;
    schedule();
  };
  // React's onWheel is passive; attach a native listener so preventDefault works.
  React.useEffect(() => {
    const el = canvasRef.current; if (!el) return;
    const handler = (ev: WheelEvent) => { ev.preventDefault(); };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const onDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = local(e);
    if (region(x, y) === "priceAxis") { resetScale(); schedule(); return; }
    fit();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedRef.current) { e.preventDefault(); commitDrawings(propsRef.current.drawings.filter((d) => d.id !== selectedRef.current)); setSelected(null); }
    if (e.key === "Escape") { draftRef.current = []; dragRef.current = null; setSelected(null); propsRef.current.onToolDone?.(); schedule(); }
  };

  const axisBtn = "min-h-6 rounded-md border border-border/60 bg-card/85 px-1.5 text-[10px] font-semibold text-muted-foreground backdrop-blur transition-[background-color,color,border-color] duration-150 hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div ref={wrapRef} className={cn("relative h-full w-full select-none overflow-hidden", className)}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label="Price chart. Drag to pan, scroll to zoom, drag or scroll the price axis to stretch it, double-click the axis to reset, Delete removes the selected drawing."
        className="block h-full w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ cursor: "crosshair" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
      />
      {/* Axis controls: auto-fit (when the scale was stretched by hand) and log/linear */}
      <div className="absolute right-1 top-1 flex items-center gap-1">
        {manual && <button type="button" onClick={() => { resetScale(); schedule(); }} className={axisBtn} title="Fit the price scale to the visible bars">Auto</button>}
        <button type="button" aria-pressed={log} onClick={() => { logRef.current = !log; setLog(!log); resetScale(); schedule(); }} className={cn(axisBtn, log && "border-brand-accent/40 bg-brand-accent/12 text-foreground")} title={log ? "Logarithmic price scale (click for linear)" : "Linear price scale (click for logarithmic)"}>{log ? "Log" : "Lin"}</button>
      </div>
    </div>
  );
}

export default CandleChart;
