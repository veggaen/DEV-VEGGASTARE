"use client";

/**
 * HeroOrbit — glowing comet propellant tracing an organic Lissajous-style path.
 *
 * Three overlapping sinusoids per axis with incommensurable frequency ratios
 * produce a never-exactly-repeating, slowly-evolving orbit that wanders around
 * the hero content (badge → description → chat widget) without ever leaving
 * the canvas bounds.
 *
 * The heavy 3D torus math is gone — just smooth 2D sinusoids, a comet trail,
 * and hard-clamped boundaries so the orb can never overflow the background.
 *
 * Light-mode: switches to multiply blend with dark-emerald colours so the orb
 * is visible against a white/light background.
 */

import * as React from "react";
import { useReducedMotion } from "framer-motion";

/** Shared position ref — HeroOrbit writes, parent reads. No re-renders. */
export type OrbPosRef = { current: { x: number; y: number } };

/** Collision rect in screen-space that the orb bounces off. */
export type CollisionRect = {
  left: number; top: number; right: number; bottom: number;
  /** Border radius for rounded-pill shapes (px). Default 0. */
  radius?: number;
};
/** Ref array — parent writes badge rects, orbit reads each frame. */
export type CollisionRectsRef = { current: CollisionRect[] };

/** Callback fired when the orb bounces off a collision rect. */
export type OnBounceCallback = (rectIndex: number) => void;

// ── Oscillator constants ────────────────────────────────────────────────────
const OX_FREQS  = [1.10, 1.83, 3.05] as const; // rad/s
const OY_FREQS  = [0.92, 1.54, 2.57] as const;
const OX_PHASES = [0.00, 1.57, 3.14] as const;
const OY_PHASES = [0.78, 2.09, 4.71] as const;
const OX_AMPS   = [0.55, 0.30, 0.15] as const;
const OY_AMPS   = [0.55, 0.30, 0.15] as const;

// Colour palettes per theme
const DARK_RGB  = "52,211,153";   // emerald-400 — pops on dark bg with screen blend
const LIGHT_RGB = "14,165,233";   // sky-500 — vibrant blue on white with multiply blend

export function HeroOrbit({
  orbPosRef,
  collisionRectsRef,
  onBounce,
}: {
  orbPosRef?: OrbPosRef;
  collisionRectsRef?: CollisionRectsRef;
  onBounce?: OnBounceCallback;
}) {
  const canvasRef  = React.useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  // ── Theme detection (class-based Tailwind dark mode) ──────────────────────
  // isDark drives the canvas blend mode (needs re-render); isDarkRef is read
  // inside the RAF loop without any re-render cost.
  const isDarkRef = React.useRef(true);
  const [isDark, setIsDark] = React.useState(true);

  React.useEffect(() => {
    const check = () => document.documentElement.classList.contains("dark");
    isDarkRef.current = check();
    setIsDark(check());

    const obs = new MutationObserver(() => {
      const d = check();
      isDarkRef.current = d;
      setIsDark(d);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  React.useEffect(() => {
    if (reduceMotion) return;
    if (typeof window === "undefined") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // ── DPR-aware sizing ──────────────────────────────────────────────────
    // The backing store is scaled by devicePixelRatio so the orb stays crisp
    // on retina/high-DPI displays; the context is scaled once so all draw
    // calls keep using CSS pixels. Capped at 2 to bound fill cost.
    let W = 0;
    let H = 0;
    let dpr = 1;
    const resize = () => {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Cached canvas screen-rect ─────────────────────────────────────────
    // getBoundingClientRect() forces layout; calling it per frame is the main
    // jank source. Cache it and refresh only on scroll/resize.
    let canvasRect = canvas.getBoundingClientRect();
    const refreshRect = () => { canvasRect = canvas.getBoundingClientRect(); };
    window.addEventListener("resize", refreshRect, { passive: true });
    window.addEventListener("scroll", refreshRect, { passive: true });

    // ── Time ──────────────────────────────────────────────────────────────
    let totalTime = 0;
    let ts = 0;

    // ── Speed boost — mouse proximity only ────────────────────────────────
    let boost = 0;

    // ── Trail ─────────────────────────────────────────────────────────────
    const trail: { x: number; y: number }[] = [];
    const TRAIL_MAX = 56;

    // ── Current canvas-space position ─────────────────────────────────────
    let px = 0;
    let py = 0;

    // ── Bounce physics ────────────────────────────────────────────────────
    let bounceVx = 0;
    let bounceVy = 0;
    let bounceOffX = 0;
    let bounceOffY = 0;
    const BOUNCE_FRICTION = 0.87;
    const BOUNCE_SPRING   = 0.003;
    const BOUNCE_IMPULSE  = 14;
    const bounceCooldowns: number[] = [];

    const onBounceRef = { current: onBounce };

    // ── Mouse proximity → directional repulsion ───────────────────────────
    const REPEL_RADIUS = 28;
    const onMouseMove = (e: MouseEvent) => {
      const mx = e.clientX - canvasRect.left;
      const my = e.clientY - canvasRect.top;
      const dx = px - mx;
      const dy = py - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < REPEL_RADIUS && dist > 1) {
        const t = 1 - dist / REPEL_RADIUS;
        const impulse = t * t * 22;
        bounceVx += (dx / dist) * impulse;
        bounceVy += (dy / dist) * impulse;
        boost = Math.max(boost, t * 0.7);
      }
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    // ── RAF loop ──────────────────────────────────────────────────────────
    let lastTime = performance.now();
    let rafId = 0;
    const MARGIN = 22;

    const draw = (now: number) => {
      const dt = Math.min(now - lastTime, 50);
      lastTime = now;
      totalTime += dt;
      if (W === 0 || H === 0) { rafId = requestAnimationFrame(draw); return; }

      boost *= 0.97;

      const breathe = 1.20 + 0.15 * Math.sin(totalTime * 0.001 * 0.09);
      const speed   = breathe + boost * 1.2;
      ts += (dt * 0.001) * speed;

      const cx = W * 0.50;
      const cy = H * 0.44;
      const AX = Math.min(W * 0.32, 320);
      const AY = Math.min(H * 0.36, 270);

      let rawX = cx;
      let rawY = cy;
      for (let i = 0; i < 3; i++) {
        rawX += AX * OX_AMPS[i] * Math.sin(OX_FREQS[i] * ts + OX_PHASES[i]);
        rawY += AY * OY_AMPS[i] * Math.sin(OY_FREQS[i] * ts + OY_PHASES[i]);
      }

      // ── Bounce physics ─────────────────────────────────────────────────
      const dtSec = dt / 1000;
      bounceVx += -bounceOffX * BOUNCE_SPRING;
      bounceVy += -bounceOffY * BOUNCE_SPRING;
      bounceVx *= BOUNCE_FRICTION;
      bounceVy *= BOUNCE_FRICTION;
      bounceOffX += bounceVx * dtSec * 60;
      bounceOffY += bounceVy * dtSec * 60;

      if (collisionRectsRef) {
        const screenX = canvasRect.left + rawX + bounceOffX;
        const screenY = canvasRect.top  + rawY + bounceOffY;

        for (let ri = 0; ri < collisionRectsRef.current.length; ri++) {
          const cr = collisionRectsRef.current[ri];
          if (!cr) continue;
          if ((bounceCooldowns[ri] ?? 0) > 0) { bounceCooldowns[ri]--; continue; }

          const ORB_R = 8;
          const l  = cr.left   - ORB_R;
          const r2 = cr.right  + ORB_R;
          const t  = cr.top    - ORB_R;
          const b  = cr.bottom + ORB_R;

          if (screenX >= l && screenX <= r2 && screenY >= t && screenY <= b) {
            const distL = screenX - l;
            const distR = r2 - screenX;
            const distT = screenY - t;
            const distB = b  - screenY;
            const minDist = Math.min(distL, distR, distT, distB);

            let nx = 0, ny = 0, penetration = 0;
            if      (minDist === distL) { nx = -1; penetration = distL; }
            else if (minDist === distR) { nx =  1; penetration = distR; }
            else if (minDist === distT) { ny = -1; penetration = distT; }
            else                        { ny =  1; penetration = distB; }

            bounceOffX += nx * (penetration + 6);
            bounceOffY += ny * (penetration + 6);
            bounceVx = nx * BOUNCE_IMPULSE;
            bounceVy = ny * BOUNCE_IMPULSE;
            bounceCooldowns[ri] = 150;
            onBounceRef.current?.(ri);
          }
        }
      }

      px = Math.max(MARGIN, Math.min(W - MARGIN, rawX + bounceOffX));
      py = Math.max(MARGIN, Math.min(H - MARGIN, rawY + bounceOffY));

      trail.push({ x: px, y: py });
      if (trail.length > TRAIL_MAX) trail.shift();

      if (orbPosRef) {
        orbPosRef.current = { x: canvasRect.left + px, y: canvasRect.top + py };
      }

      // ── Render ────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);

      const dark = isDarkRef.current;
      const rgb  = dark ? DARK_RGB : LIGHT_RGB;

      // Comet tail — a single smooth path stroked in two passes (soft wide
      // underlay + crisp core) instead of ~80 individual segment strokes.
      // Points are joined with quadratic curves through their midpoints so the
      // trail reads as one flowing curve rather than faceted line segments.
      if (trail.length > 2) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const buildPath = () => {
          ctx.beginPath();
          ctx.moveTo(trail[0].x, trail[0].y);
          for (let i = 1; i < trail.length - 1; i++) {
            const mx = (trail[i].x + trail[i + 1].x) / 2;
            const my = (trail[i].y + trail[i + 1].y) / 2;
            ctx.quadraticCurveTo(trail[i].x, trail[i].y, mx, my);
          }
          const last = trail[trail.length - 1];
          ctx.lineTo(last.x, last.y);
        };

        // Soft underlay (glow)
        buildPath();
        ctx.strokeStyle = `rgba(${rgb},${dark ? 0.10 : 0.22})`;
        ctx.lineWidth = dark ? 5 : 4;
        ctx.stroke();

        // Crisp core
        buildPath();
        ctx.strokeStyle = `rgba(${rgb},${dark ? 0.28 : 0.5})`;
        ctx.lineWidth = dark ? 1.6 : 1.4;
        ctx.stroke();
      }

      // Outer glow
      const bn    = Math.min(boost / 3, 1);
      const glowR = 22 + bn * 18;
      const grd   = ctx.createRadialGradient(px, py, 0, px, py, glowR);
      if (dark) {
        grd.addColorStop(0,   `rgba(${rgb},${(0.55 + bn * 0.30).toFixed(3)})`);
        grd.addColorStop(0.4, `rgba(${rgb},${(0.13 + bn * 0.10).toFixed(3)})`);
      } else {
        // Light mode: richer inner glow — emerald-500 reads well with multiply blend
        grd.addColorStop(0,   `rgba(${rgb},${(0.70 + bn * 0.25).toFixed(3)})`);
        grd.addColorStop(0.4, `rgba(${rgb},${(0.18 + bn * 0.10).toFixed(3)})`);
      }
      grd.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = dark ? "rgba(167,243,208,0.95)" : `rgba(${rgb},0.95)`;
      ctx.fill();

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("resize", refreshRect);
      window.removeEventListener("scroll", refreshRect);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [reduceMotion]);

  if (reduceMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-3"
      aria-hidden="true"
      style={{
        // screen blend pops on dark bg; multiply keeps orb visible on light bg
        mixBlendMode: isDark ? "screen" : "multiply",
        width: "100%",
        height: "100%",
      }}
    />
  );
}
