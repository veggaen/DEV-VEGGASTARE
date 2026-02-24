"use client";

/**
 * NeonCursorTrail — lightweight cursor trail using the "fade overlay" technique.
 *
 * Instead of clearRect + redrawing every point with radial gradients,
 * we draw a semi-transparent black rect each frame to decay the trail naturally.
 * Black = transparent in screen blend mode, so only the glowing trail shows.
 *
 * GPU cost: ~1 fillRect + N short line segments + 1 radial gradient per frame.
 * Much cheaper than the previous per-point radial gradient approach.
 */

import * as React from "react";
import { useReducedMotion } from "framer-motion";

// Subtle palette — cycles slowly so it doesn't feel noisy
const DARK_PALETTE: [number, number, number][] = [
  [52, 211, 153],  // emerald-400
  [56, 189, 248],  // sky-400
  [139, 92, 246],  // violet-400
];

const LIGHT_PALETTE: [number, number, number][] = [
  [56, 189, 248],  // sky-400 (was emerald)
  [52, 211, 153],  // emerald-400 (was sky)
  [139, 92, 246],  // violet-400
];

export function NeonCursorTrail() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

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
    // Skip on touch devices — no cursor to trail
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);
    const onResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    // History of recent mouse positions
    const hist: { x: number; y: number }[] = [];
    const MAX = 20;       // keep last 20 sampled positions
    const MIN_D2 = 5 * 5; // only sample if moved ≥ 5px
    let lastX = -999;
    let lastY = -999;
    let colorTick = 0;
    let rafId = 0;
    let idle = 0; // frames since last mouse move

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (dx * dx + dy * dy < MIN_D2) return;
      lastX = e.clientX;
      lastY = e.clientY;
      hist.push({ x: lastX, y: lastY });
      if (hist.length > MAX) hist.shift();
      colorTick++;
      idle = 0;
    };

    const draw = () => {
      // Decay: overlay semi-transparent black each frame.
      // In screen blend mode, black pixels = fully transparent — so this
      // smoothly erases old trail content without a jarring clearRect.
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(0, 0, W, H);

      // Skip rendering when idle — RAF still runs to keep decay going
      if (hist.length >= 2 && idle < 30) {
        const palette = isDarkRef.current ? DARK_PALETTE : LIGHT_PALETTE;
        const [r, g, b] = palette[Math.floor(colorTick / 6) % palette.length];

        // Tapered line segments — thin at tail, wider at tip
        for (let i = 1; i < hist.length; i++) {
          const t = i / hist.length; // 0 = oldest tail, 1 = freshest tip
          ctx.beginPath();
          ctx.moveTo(hist[i - 1].x, hist[i - 1].y);
          ctx.lineTo(hist[i].x, hist[i].y);
          ctx.strokeStyle = `rgba(${r},${g},${b},${t * 0.28})`;
          ctx.lineWidth = t * 2.5 + 0.5;
          ctx.lineCap = "round";
          ctx.stroke();
        }

        // Single soft glow at the cursor tip — one radial gradient only
        const tip = hist[hist.length - 1];
        const grd = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 14);
        grd.addColorStop(0, `rgba(${r},${g},${b},0.18)`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      idle++;
      rafId = requestAnimationFrame(draw);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    rafId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafId);
    };
  }, [reduceMotion, isDark]);

  if (reduceMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-5"
      aria-hidden="true"
      style={{ mixBlendMode: "screen" }}
    />
  );
}