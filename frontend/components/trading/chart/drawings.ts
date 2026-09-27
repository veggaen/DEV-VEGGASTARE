/**
 * @fileOverview  Chart drawings for the paper terminal: types, geometry
 *                helpers and per-symbol persistence. Anchors are stored in
 *                data space (time + price) so a drawing survives timeframe
 *                changes and zooming.
 * @stability     experimental
 */

export type DrawingTool = "cursor" | "trend" | "ray" | "hline" | "rect" | "fib";
export type DrawingType = Exclude<DrawingTool, "cursor">;
export type Anchor = { t: number; p: number };
export type Drawing = { id: string; type: DrawingType; points: Anchor[]; locked?: boolean };

export const TOOLS: Array<{ id: DrawingTool; label: string; hint: string }> = [
  { id: "cursor", label: "Cursor", hint: "Select, move and pan" },
  { id: "trend", label: "Trend line", hint: "Two clicks, or press and drag" },
  { id: "ray", label: "Ray", hint: "Trend line that extends right" },
  { id: "hline", label: "Horizontal line", hint: "One click at a price" },
  { id: "rect", label: "Rectangle", hint: "Two corners" },
  { id: "fib", label: "Fib retracement", hint: "From swing low to swing high (or the reverse)" },
];

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

export function pointsNeeded(type: DrawingType): number {
  return type === "hline" ? 1 : 2;
}

export function newDrawingId(): string {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const STORAGE_PREFIX = "veggat:chart-drawings:";

export function loadDrawings(symbol: string): Drawing[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + symbol.toUpperCase());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d): d is Drawing => Boolean(d) && typeof d === "object" && typeof (d as Drawing).id === "string" && Array.isArray((d as Drawing).points));
  } catch {
    return [];
  }
}

export function saveDrawings(symbol: string, drawings: Drawing[]): void {
  try {
    if (drawings.length) localStorage.setItem(STORAGE_PREFIX + symbol.toUpperCase(), JSON.stringify(drawings));
    else localStorage.removeItem(STORAGE_PREFIX + symbol.toUpperCase());
  } catch {
    /* Storage is optional. */
  }
}

/** Distance from point (px,py) to the segment (x1,y1)-(x2,y2), in px. */
export function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Human price formatting that adapts to magnitude (BTC vs PEPE). */
export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (abs >= 1) return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (abs >= 0.01) return value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 5 });
  return value.toLocaleString(undefined, { maximumSignificantDigits: 4 });
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}
