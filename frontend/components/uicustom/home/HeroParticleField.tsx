"use client";

/**
 * HeroParticleField — a premium, lightweight canvas particle field.
 *
 * Design goals (world-class, but cheap on the critical path):
 *  - Particles spawn and drift along the LEFT, TOP and RIGHT edges only, so the
 *    centre stays clean for the hero text.
 *  - Soft additive glow + depth (size/opacity/parallax) for a high-quality look
 *    without a 3D bundle.
 *  - Mouse interaction: gentle repel within a radius, with smooth easing back.
 *  - Respects prefers-reduced-motion (renders a static, faint field).
 *  - DPR-aware, pauses when offscreen/hidden, cleans up fully.
 *
 * Uses the brand accent: emerald in dark, sky in light.
 */

import * as React from "react";
import { useReducedMotion } from "framer-motion";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;        // base radius
  baseAlpha: number;
  depth: number;    // 0..1 → parallax + size factor
  twinkle: number;  // phase
};

const EDGE_BAND = 0.34; // fraction of width/height that counts as an "edge" band

export default function HeroParticleField({
  className = "",
  density = 1,
  fixed = false,
}: {
  className?: string;
  /** multiplier on particle count (1 = default) */
  density?: number;
  /** Render as a fixed full-viewport background layer (covers the whole page,
   *  stays put while scrolling) instead of filling its parent. */
  fixed?: boolean;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const reduce = useReducedMotion();

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles: Particle[] = [];
    let running = true;

    const isDark = () =>
      document.documentElement.classList.contains("dark");

    // mouse (in CSS px), eased
    const mouse = { x: -9999, y: -9999, active: false };

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    const inEdgeBand = (x: number, y: number) => {
      if (fixed) return true; // full-page mode: particles fill everywhere
      const lb = w * EDGE_BAND;
      const rb = w * (1 - EDGE_BAND);
      const tb = h * EDGE_BAND;
      return x < lb || x > rb || y < tb; // left, right, or top band
    };

    const spawn = (): Particle => {
      let x: number, y: number;
      if (fixed) {
        // Full-page background: spread across the whole viewport.
        x = rand(0, w);
        y = rand(0, h);
      } else {
        // Hero mode: bias spawn into the left/top/right edge bands.
        const side = Math.random();
        if (side < 0.4) {
          x = rand(0, w * EDGE_BAND);
          y = rand(0, h);
        } else if (side < 0.8) {
          x = rand(w * (1 - EDGE_BAND), w);
          y = rand(0, h);
        } else {
          x = rand(0, w);
          y = rand(0, h * EDGE_BAND);
        }
      }
      const depth = Math.random();
      return {
        x,
        y,
        vx: rand(-0.12, 0.12),
        vy: rand(-0.16, 0.06), // gentle upward drift
        r: rand(0.6, 2.2) * (0.6 + depth * 0.9),
        baseAlpha: rand(0.12, 0.5) * (0.4 + depth * 0.7),
        depth,
        twinkle: Math.random() * Math.PI * 2,
      };
    };

    const resize = () => {
      if (fixed) {
        w = window.innerWidth;
        h = window.innerHeight;
      } else {
        const rect = canvas.parentElement?.getBoundingClientRect();
        w = rect?.width ?? window.innerWidth;
        h = rect?.height ?? window.innerHeight;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const area = w * h;
      const target = Math.round((area / 14000) * density);
      const count = Math.max(24, Math.min(160, target));
      particles = Array.from({ length: count }, spawn);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };
    const onLeave = () => {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    };

    const REPEL_RADIUS = 120;
    const REPEL_RADIUS2 = REPEL_RADIUS * REPEL_RADIUS;

    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      const dark = isDark();
      // brand accent rgb
      const r = dark ? 52 : 14;
      const g = dark ? 211 : 165;
      const b = dark ? 153 : 233;

      const t = performance.now() * 0.001;

      for (const p of particles) {
        if (!reduce) {
          p.x += p.vx;
          p.y += p.vy;

          // mouse repel (depth-scaled so near particles react more)
          if (mouse.active) {
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < REPEL_RADIUS2 && d2 > 0.01) {
              const d = Math.sqrt(d2);
              const force = (1 - d / REPEL_RADIUS) * (0.6 + p.depth) * 0.9;
              p.vx += (dx / d) * force * 0.12;
              p.vy += (dy / d) * force * 0.12;
            }
          }

          // light friction + drift cap
          p.vx *= 0.985;
          p.vy *= 0.985;
          p.vy -= 0.0009; // perpetual faint upward float

          // wrap / respawn when leaving, keep biased to edges
          if (p.y < -10 || p.x < -10 || p.x > w + 10 || p.y > h + 10) {
            Object.assign(p, spawn(), { y: h + 8 });
          }
          // if a particle drifts deep into the clean centre, fade it (handled via alpha below)
        }

        const twAlpha = reduce
          ? p.baseAlpha
          : p.baseAlpha * (0.7 + 0.3 * Math.sin(t * 1.5 + p.twinkle));

        // fade out particles that wander into the central clean zone
        const centreFade = inEdgeBand(p.x, p.y) ? 1 : 0.18;
        const alpha = Math.max(0, twAlpha * centreFade);
        if (alpha <= 0.01) continue;

        const radius = p.r;
        // soft radial glow
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 4);
        grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
        grad.addColorStop(0.4, `rgba(${r},${g},${b},${alpha * 0.35})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * 4, 0, Math.PI * 2);
        ctx.fill();

        // crisp core
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, alpha * 1.4)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();

    const ro = new ResizeObserver(resize);
    if (!fixed && canvas.parentElement) ro.observe(canvas.parentElement);
    if (fixed) window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);

    const onVisibility = () => {
      running = document.visibilityState === "visible";
      if (running && !raf) draw();
      else if (!running) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (fixed) window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduce, density, fixed]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none h-full w-full ${
        fixed ? "fixed inset-0" : "absolute inset-0"
      } ${className}`}
    />
  );
}
