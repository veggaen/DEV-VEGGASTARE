"use client";

/**
 * HeroOrbit — a glowing particle that revolves in a tilted ellipse around
 * the hero text content block.
 *
 * Rendering: Canvas 2D with screen blend-mode.
 *   Black pixels → transparent on dark backgrounds; barely visible on light.
 *   Ellipse guide + comet tail + radial glow at particle tip.
 *
 * Interaction (mouse only — no touch needed):
 *   • Mouse near particle  → speed boost (proximity-proportional, decays over time)
 *   • Mouse Y position     → orbit inclination tilt (follows cursor height smoothly)
 *
 * Performance: single RAF loop, clearRect per frame, max 32 trail points.
 */

import * as React from "react";
import { useReducedMotion } from "framer-motion";

export function HeroOrbit() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    if (reduceMotion) return;
    if (typeof window === "undefined") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;

    const resize = () => {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Orbit state ───────────────────────────────────────────────────────────
    let angle = Math.PI * 0.3; // start offset so particle isn't at dead-right on load
    const BASE_SPEED = 0.38;   // rad/sec → full orbit ≈ 16 s
    let boost = 0;
    let inclination = -0.1;
    let inclinationTarget = -0.1;

    // ── Trail ─────────────────────────────────────────────────────────────────
    const trail: { x: number; y: number }[] = [];
    const TRAIL_MAX = 32;

    // Current particle position (updated each frame for proximity test)
    let px = 0;
    let py = 0;

    // ── Mouse → proximity boost + inclination ─────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Proximity boost: ramps from 0 at 110 px away to 1.8 at 0 px
      const dx = mx - px;
      const dy = my - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 110) {
        boost = Math.max(boost, 1.8 * (1 - dist / 110));
      }

      // Inclination: mouse Y maps to [-0.28 … +0.28] rad tilt
      if (H > 0) {
        inclinationTarget = ((my - H * 0.5) / (H * 0.5)) * 0.28;
      }
    };

    // Use window so we catch movement everywhere (canvas is pointer-events-none)
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    // ── RAF loop ──────────────────────────────────────────────────────────────
    let lastTime = performance.now();
    let rafId = 0;

    const draw = (now: number) => {
      const dt = Math.min(now - lastTime, 50); // cap to avoid jump on tab restore
      lastTime = now;

      if (W === 0 || H === 0) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      // Smooth inclination toward target
      inclination += (inclinationTarget - inclination) * 0.035;

      // Advance orbital angle
      angle += ((BASE_SPEED + boost) * dt) / 1000;
      boost *= 0.97; // decay boost each frame

      // ── Orbit geometry ────────────────────────────────────────────────────
      const cx = W / 2;
      const cy = H / 2;
      // Ellipse radii — snug around the text block, capped for very wide screens
      const rx = Math.min(W * 0.44, 500);
      const ry = Math.min(H * 0.28, 210);

      // Particle position on the inclined ellipse
      const ex = rx * Math.cos(angle);
      const ey = ry * Math.sin(angle);
      px = cx + ex * Math.cos(inclination) - ey * Math.sin(inclination);
      py = cy + ex * Math.sin(inclination) + ey * Math.cos(inclination);

      trail.push({ x: px, y: py });
      if (trail.length > TRAIL_MAX) trail.shift();

      // ── Render ────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);

      // Orbit ellipse guide — barely visible hint of the path
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(inclination);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(52,211,153,0.055)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Comet tail (segments with increasing alpha/width toward tip)
      for (let i = 1; i < trail.length; i++) {
        const t = i / trail.length;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = `rgba(52,211,153,${(t * 0.26).toFixed(3)})`;
        ctx.lineWidth = t * 2.8 + 0.3;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      // Soft outer glow — grows slightly when boosted
      const boostNorm = Math.min(boost / 1.8, 1);
      const glowR = 18 + boostNorm * 12;
      const grd = ctx.createRadialGradient(px, py, 0, px, py, glowR);
      grd.addColorStop(0, `rgba(52,211,153,${(0.42 + boostNorm * 0.22).toFixed(3)})`);
      grd.addColorStop(0.4, `rgba(52,211,153,${(0.1 + boostNorm * 0.08).toFixed(3)})`);
      grd.addColorStop(1, "rgba(52,211,153,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Hard core dot
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(167,243,208,0.95)";
      ctx.fill();

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [reduceMotion]);

  if (reduceMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[3]"
      aria-hidden="true"
      style={{ mixBlendMode: "screen", width: "100%", height: "100%" }}
    />
  );
}
