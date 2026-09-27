"use client";

/**
 * @fileOverview  CandleChart — a dependency-free canvas chart for the paper
 *                terminal in the spirit of TradingView's Supercharts:
 *                candles / line / area, volume overlay, crosshair with OHLC
 *                legend, wheel + pinch zoom, drag pan, last-price line, and
 *                drawing tools (trend line, ray, horizontal line, rectangle,
 *                fib retracement) with selection, move and reshape handles.
 *
 *                Everything is drawn from theme tokens read at draw time, so
 *                the chart follows light/dark and the accent preset. Drawings
 *                live in data space (time + price), see ./drawings.ts.
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
import { cn } from "@/lib/utils";

export type ChartType = "candles" | "line" | "area";
export type TradeMarker = { t: number; price: number; side: "buy" | "sell" };

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
  className?: string;
  /** Optional: reset key (symbol) so the viewport re-fits on market change. */
  fitKey?: string;
};

type View = { offset: number; bars: number };
type Theme = { fg: string; muted: string; border: string; accent: string; up: string; down: string; card: string; font: string; hsl: (v: string, a?: number) => string };

const AXIS_W = 64;
const AXIS_H = 26;
const MIN_BARS = 8;
const MAX_BARS = 1500;
const HIT_PX = 7;

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

export function CandleChart({ candles, interval, chartType = "candles", tool, onToolDone, drawings, onDrawingsChange, markers = [], showVolume = true, className, fitKey }: CandleChartProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const viewRef = React.useRef<View>({ offset: 0, bars: 120 });
  const stickRightRef = React.useRef(true);
  const hoverRef = React.useRef<{ x: number; y: number } | null>(null);
  const draftRef = React.useRef<Anchor[]>([]);
  const dragRef = React.useRef<
    | { kind: "pan"; startX: number; startOffset: number; moved: boolean }
    | { kind: "move"; id: string; start: { x: number; y: number }; points: Anchor[]; moved: boolean }
    | { kind: "handle"; id: string; index: number }
    | { kind: "draw"; startX: number; startY: number; moved: boolean }
    | null
  >(null);
  const pinchRef = React.useRef<{ pointers: Map<number, { x: number; y: number }>; startDist: number; startBars: number } | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const selectedRef = React.useRef<string | null>(null);
  const rafRef = React.useRef<number | null>(null);

  // Latest props in refs so pointer handlers never go stale (assigned after
  // commit; handlers only run after that).
  const propsRef = React.useRef({ candles, interval, chartType, tool, drawings, onDrawingsChange, onToolDone, markers, showVolume });
  React.useLayoutEffect(() => {
    propsRef.current = { candles, interval, chartType, tool, drawings, onDrawingsChange, onToolDone, markers, showVolume };
    selectedRef.current = selected;
  });

  // ── Geometry helpers (all read from refs) ────────────────────────────────
  const geom = React.useCallback(() => {
    const el = canvasRef.current;
    const w = el?.clientWidth ?? 0, h = el?.clientHeight ?? 0;
    const plotW = Math.max(10, w - AXIS_W), plotH = Math.max(10, h - AXIS_H);
    const { offset, bars } = viewRef.current;
    const barW = plotW / bars;
    return { w, h, plotW, plotH, offset, bars, barW };
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

  const priceRange = React.useCallback(() => {
    const c = propsRef.current.candles; const { offset, bars } = viewRef.current;
    const from = Math.max(0, Math.floor(offset)), to = Math.min(c.length - 1, Math.ceil(offset + bars));
    let min = Infinity, max = -Infinity;
    for (let i = from; i <= to; i++) { const k = c[i]; if (!k) continue; if (k.l < min) min = k.l; if (k.h > max) max = k.h; }
    if (!Number.isFinite(min) || !Number.isFinite(max)) { min = 0; max = 1; }
    if (max === min) { max = min * 1.01 || 1; min = min * 0.99; }
    const pad = (max - min) * 0.08;
    return { min: min - pad, max: max + pad };
  }, []);

  const priceToY = React.useCallback((p: number) => { const g = geom(); const r = priceRange(); return ((r.max - p) / (r.max - r.min)) * g.plotH; }, [geom, priceRange]);
  const yToPrice = React.useCallback((y: number) => { const g = geom(); const r = priceRange(); return r.max - (y / g.plotH) * (r.max - r.min); }, [geom, priceRange]);

  const anchorToXY = React.useCallback((a: Anchor) => ({ x: indexToX(timeToIndex(a.t)), y: priceToY(a.p) }), [indexToX, timeToIndex, priceToY]);
  const xyToAnchor = React.useCallback((x: number, y: number, snapBar = true): Anchor => {
    const i = xToIndex(x); const idx = snapBar ? Math.round(i) : i;
    return { t: indexToTime(idx), p: yToPrice(y) };
  }, [xToIndex, indexToTime, yToPrice]);

  // ── Hit testing ──────────────────────────────────────────────────────────
  const hitTest = React.useCallback((x: number, y: number): { id: string; handle?: number } | null => {
    const g = geom();
    const list = propsRef.current.drawings;
    for (let n = list.length - 1; n >= 0; n--) {
      const d = list[n];
      const pts = d.points.map(anchorToXY);
      for (let i = 0; i < pts.length; i++) if (Math.hypot(pts[i].x - x, pts[i].y - y) <= HIT_PX + 2) return { id: d.id, handle: i };
      if (d.type === "hline") { if (Math.abs(pts[0].y - y) <= HIT_PX) return { id: d.id }; continue; }
      if (pts.length < 2) continue;
      const [a, b] = pts;
      if (d.type === "trend" && distanceToSegment(x, y, a.x, a.y, b.x, b.y) <= HIT_PX) return { id: d.id };
      if (d.type === "ray") {
        const dx = b.x - a.x, dy = b.y - a.y; const far = dx === 0 && dy === 0 ? b : { x: a.x + dx * 10000, y: a.y + dy * 10000 };
        if (distanceToSegment(x, y, a.x, a.y, far.x, far.y) <= HIT_PX) return { id: d.id };
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
    const { candles: c, interval: iv, chartType: type, drawings: list, markers: mk, showVolume: vol } = propsRef.current;
    const g = geom();
    ctx.font = `11px ${th.font}`;
    ctx.textBaseline = "middle";

    if (!c.length) {
      ctx.fillStyle = th.hsl(th.muted); ctx.textAlign = "center"; ctx.fillText("No price data", g.plotW / 2, g.plotH / 2); return;
    }

    const range = priceRange();
    const y = (p: number) => ((range.max - p) / (range.max - range.min)) * g.plotH;
    const x = (i: number) => (i - g.offset) * g.barW + g.barW / 2;
    const from = Math.max(0, Math.floor(g.offset) - 1), to = Math.min(c.length - 1, Math.ceil(g.offset + g.bars) + 1);

    // Grid + price axis
    const step = niceStep(range.max - range.min, Math.max(3, Math.floor(g.plotH / 60)));
    ctx.strokeStyle = th.hsl(th.border, 0.6); ctx.lineWidth = 1;
    ctx.fillStyle = th.hsl(th.muted); ctx.textAlign = "left";
    for (let p = Math.ceil(range.min / step) * step; p <= range.max; p += step) {
      const yy = Math.round(y(p)) + 0.5;
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(g.plotW, yy); ctx.stroke();
      ctx.fillText(formatPrice(p), g.plotW + 8, yy);
    }
    // Time axis
    const labelEvery = Math.max(1, Math.ceil(80 / g.barW));
    ctx.textAlign = "center";
    let lastDay = -1;
    for (let i = from; i <= to; i++) {
      const k = c[i]; if (!k) continue;
      const day = new Date(k.t).getDate(); const boundary = day !== lastDay && i > from; lastDay = day;
      if (i % labelEvery !== 0 && !(boundary && iv !== "1d" && iv !== "1w" && labelEvery > 1 && i % Math.max(1, Math.floor(labelEvery / 2)) === 0)) continue;
      const xx = Math.round(x(i)) + 0.5;
      ctx.strokeStyle = th.hsl(th.border, 0.5); ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, g.plotH); ctx.stroke();
      const label = timeLabel(k.t, iv, boundary); const half = ctx.measureText(label).width / 2;
      if (xx - half < 2 || xx + half > g.plotW - 2) continue; // never draw a clipped label
      ctx.fillStyle = th.hsl(th.muted, boundary ? 1 : 0.85); ctx.fillText(label, xx, g.plotH + AXIS_H / 2);
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
      if (d.type === "hline" && pts[0]) {
        const yy = Math.round(pts[0].y) + 0.5; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(g.plotW, yy); ctx.stroke();
        ctx.fillStyle = th.hsl(th.accent); ctx.fillRect(g.plotW + 2, yy - 9, AXIS_W - 4, 18); ctx.fillStyle = th.hsl(th.card); ctx.textAlign = "left"; ctx.fillText(formatPrice(d.points[0].p), g.plotW + 8, yy);
      } else if (pts.length >= 2) {
        const [a, b] = pts;
        if (d.type === "trend") { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        if (d.type === "ray") { const dx = b.x - a.x, dy = b.y - a.y; const k = dx === 0 && dy === 0 ? 0 : 5000; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + dx * k, a.y + dy * k); ctx.stroke(); }
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
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, g.plotW + AXIS_W, g.plotH); ctx.clip();
    for (const d of list) drawOne(d, d.id === selectedRef.current);
    // In-progress draft
    const hv = hoverRef.current; const draft = draftRef.current; const t = propsRef.current.tool;
    if (draft.length && hv && t !== "cursor") {
      const ghost: Drawing = { id: "draft", type: t, points: pointsNeeded(t) === 1 ? draft : [draft[0], xyToAnchor(hv.x, hv.y)] };
      drawOne(ghost, false, true);
    }
    ctx.restore();

    // Crosshair + legend
    const hoverIdx = hv ? Math.round(xToIndex(hv.x)) : c.length - 1;
    const hk = c[Math.max(0, Math.min(c.length - 1, hoverIdx))] ?? last;
    if (hv && hv.x >= 0 && hv.x <= g.plotW && hv.y >= 0 && hv.y <= g.plotH) {
      const cx = Math.round(x(Math.round(xToIndex(hv.x)))) + 0.5, cy = Math.round(hv.y) + 0.5;
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = th.hsl(th.fg, 0.35); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, g.plotH); ctx.moveTo(0, cy); ctx.lineTo(g.plotW, cy); ctx.stroke(); ctx.restore();
      // price tag
      ctx.fillStyle = th.hsl(th.fg); ctx.fillRect(g.plotW + 2, cy - 9, AXIS_W - 4, 18); ctx.fillStyle = th.hsl(th.card); ctx.textAlign = "left"; ctx.fillText(formatPrice(yToPrice(hv.y)), g.plotW + 8, cy);
      // time tag
      const label = crosshairTime(indexToTime(Math.round(xToIndex(hv.x))), iv); const tw = ctx.measureText(label).width + 12;
      const tx = Math.max(0, Math.min(g.plotW - tw, cx - tw / 2));
      ctx.fillStyle = th.hsl(th.fg); ctx.fillRect(tx, g.plotH + 3, tw, AXIS_H - 6); ctx.fillStyle = th.hsl(th.card); ctx.textAlign = "center"; ctx.fillText(label, tx + tw / 2, g.plotH + AXIS_H / 2);
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
  }, [geom, priceRange, anchorToXY, xyToAnchor, xToIndex, indexToTime, timeToIndex, yToPrice]);

  const schedule = React.useCallback(() => { if (rafRef.current == null) rafRef.current = requestAnimationFrame(draw); }, [draw]);

  // Fit the newest bars into view (initial + on market change).
  const fit = React.useCallback((bars = 120) => {
    const n = propsRef.current.candles.length;
    const b = Math.max(MIN_BARS, Math.min(MAX_BARS, Math.min(bars, Math.max(MIN_BARS, n))));
    viewRef.current = { offset: Math.max(0, n - b + 3), bars: b };
    stickRightRef.current = true; schedule();
  }, [schedule]);

  const lastFitKey = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (candles.length && lastFitKey.current !== fitKey) { lastFitKey.current = fitKey; fit(); }
    else if (stickRightRef.current && candles.length) {
      const v = viewRef.current; viewRef.current = { ...v, offset: Math.max(0, candles.length - v.bars + 3) };
    }
    schedule();
  }, [candles, fitKey, fit, schedule]);
  React.useEffect(() => { schedule(); }, [drawings, chartType, tool, markers, showVolume, selected, schedule]);

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

  const commitDrawings = (next: Drawing[]) => { propsRef.current.onDrawingsChange(next); };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!; canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = local(e); const g = geom();
    if (pinchRef.current || e.pointerType === "touch") {
      const p = pinchRef.current ?? { pointers: new Map(), startDist: 0, startBars: viewRef.current.bars };
      p.pointers.set(e.pointerId, { x, y }); pinchRef.current = p;
      if (p.pointers.size === 2) { const [a, b] = Array.from(p.pointers.values()); p.startDist = Math.hypot(a.x - b.x, a.y - b.y); p.startBars = viewRef.current.bars; dragRef.current = null; return; }
    }
    if (x > g.plotW || y > g.plotH) return;
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
    dragRef.current = { kind: "pan", startX: x, startOffset: viewRef.current.offset, moved: false };
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
    if (drag?.kind === "pan") {
      const g = geom(); const dx = x - drag.startX; if (Math.abs(dx) > 3) drag.moved = true;
      const n = propsRef.current.candles.length;
      const offset = Math.max(-g.bars * 0.5, Math.min(n - 3, drag.startOffset - dx / g.barW));
      viewRef.current = { ...viewRef.current, offset }; stickRightRef.current = offset + g.bars >= n - 1;
    } else if (drag?.kind === "move") {
      const dx = x - drag.start.x, dy = y - drag.start.y; if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
      const g = geom(); const di = dx / g.barW; const dp = -(dy / g.plotH) * (priceRange().max - priceRange().min);
      const moved = drag.points.map((pt) => ({ t: indexToTime(timeToIndex(pt.t) + di), p: pt.p + dp }));
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
    const { x } = local(e); const g = geom(); const n = propsRef.current.candles.length;
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

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedRef.current) { e.preventDefault(); commitDrawings(propsRef.current.drawings.filter((d) => d.id !== selectedRef.current)); setSelected(null); }
    if (e.key === "Escape") { draftRef.current = []; dragRef.current = null; setSelected(null); propsRef.current.onToolDone?.(); schedule(); }
  };

  return (
    <div ref={wrapRef} className={cn("relative h-full w-full select-none overflow-hidden", className)}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label="Price chart. Drag to pan, scroll to zoom, Delete removes the selected drawing."
        className="block h-full w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ cursor: "crosshair" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onWheel={onWheel}
        onDoubleClick={() => fit()}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

export default CandleChart;
