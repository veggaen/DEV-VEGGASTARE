"use client";

/**
 * @fileOverview  Landing page below the hero: the story of the whole stack.
 *                Six doors (marketplace, feed, job board, terminal, wallets,
 *                AI), a promise strip, five chapters with their own scroll
 *                reveal and a live-looking visual each, the trust layer, four
 *                steps, the beta note and the closing CTA. Same DNA as before
 *                (kinetic headings, sliding indicators, magnetic buttons);
 *                more of it, and it now says what Veggat is.
 * @stability     evolving
 */

import * as React from "react";
import { motion, useMotionValue, useSpring, useTransform, type MotionValue, type Variants } from "framer-motion";
import { useHydratedReducedMotion as useReducedMotion } from "@/hooks/use-hydrated-reduced-motion";
import Link from "next/link";
import {
  FiArrowRight, FiBarChart2, FiBriefcase, FiCheck, FiCpu, FiDownload, FiKey, FiLock, FiMessageCircle, FiPackage, FiSend, FiShield, FiShoppingBag, FiTrendingUp, FiUsers, FiZap,
} from "react-icons/fi";
import { PulseHeart } from "@/components/uicustom/icons/PulseIcons";
import { LandingDemoLoop } from "./LandingDemoLoop";

/** Returns true when the page is in dark mode (watches Tailwind's dark class). */
function useIsDark() {
  const [isDark, setIsDark] = React.useState(true);
  React.useEffect(() => {
    const check = () => document.documentElement.classList.contains("dark");
    setIsDark(check());
    const obs = new MutationObserver(() => setIsDark(check()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

const EASE = [0.22, 1, 0.36, 1] as const;

// ── Shared hoverable heading ──────────────────────────────────────────────────
// Plain <span>s with CSS transitions — no framer-motion per-character overhead.

function HoverableHeading({ text, className, externalFraction }: { text: string; className?: string; externalFraction?: number | null }) {
  const reduceMotion = useReducedMotion();
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  const accentRgb = "var(--brand-accent-rgb)"; // follows theme + accent preset
  const letterIndices = React.useMemo(() => Array.from(text).map((c, i) => (c === " " ? -1 : i)).filter((i) => i >= 0), [text]);
  const effectiveIdx = React.useMemo(() => {
    if (reduceMotion) return null;
    if (externalFraction == null) return hoveredIdx;
    if (letterIndices.length === 0) return null;
    const pos = Math.round(externalFraction * (letterIndices.length - 1));
    return letterIndices[Math.max(0, Math.min(letterIndices.length - 1, pos))];
  }, [reduceMotion, externalFraction, hoveredIdx, letterIndices]);
  const words = React.useMemo(
    () => text.split(" ").map((word, index, allWords) => ({ word, start: Array.from(allWords.slice(0, index).join(" ")).length + (index > 0 ? 1 : 0) })),
    [text],
  );

  return (
    <span className={`${className ?? ""} cursor-default`} onPointerLeave={() => setHoveredIdx(null)}>
      <span className="sr-only">{text}</span>
      {words.map(({ word, start }, wordIndex) => (
        <React.Fragment key={start}>
          <span aria-hidden="true" className="inline-block whitespace-nowrap">
            {Array.from(word).map((char, charIndex) => {
              const i = start + charIndex;
              const dist = effectiveIdx !== null ? Math.abs(i - effectiveIdx) : Infinity;
              const intensity = dist === 0 ? 1 : dist === 1 ? 0.55 : dist === 2 ? 0.22 : 0;
              const active = intensity > 0;
              return (
                <span
                  key={i}
                  aria-hidden="true"
                  className="inline-block origin-bottom"
                  style={{
                    color: active ? `rgb(${accentRgb} / ${0.5 + 0.5 * intensity})` : undefined,
                    textShadow: active ? `0 0 ${12 * intensity}px rgb(${accentRgb} / ${0.35 * intensity})` : "none",
                    transform: `scale(${active ? 1 + 0.1 * intensity : 1}) translateY(${active ? -2 * intensity : 0}px)`,
                    transition: "color 0.12s ease-out, text-shadow 0.12s ease-out, transform 0.12s ease-out",
                  }}
                  onPointerEnter={() => { if (!reduceMotion && window.matchMedia("(hover: hover)").matches) setHoveredIdx(i); }}
                >
                  {char}
                </span>
              );
            })}
          </span>
          {wordIndex < words.length - 1 && <span aria-hidden="true">{" "}</span>}
        </React.Fragment>
      ))}
    </span>
  );
}

// ── Magnetic button wrapper — follows cursor, click scale, border glow ───────

function MagneticButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20 });
  const springY = useSpring(y, { stiffness: 300, damping: 20 });
  return (
    <motion.div
      className={`relative group ${className ?? ""}`}
      style={{ x: springX, y: springY }}
      whileTap={{ scale: 0.96 }}
      onMouseMove={(e) => {
        if (reduceMotion) return;
        const rect = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - (rect.left + rect.width / 2)) * 0.18);
        y.set((e.clientY - (rect.top + rect.height / 2)) * 0.18);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.div>
  );
}

// ── Tilt card — the chapter visuals lean toward the cursor ───────────────────

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [6, -6]), { stiffness: 200, damping: 24 });
  const ry = useSpring(useTransform(px, [0, 1], [-8, 8]), { stiffness: 200, damping: 24 });
  return (
    <motion.div
      className={className}
      style={reduceMotion ? undefined : { rotateX: rx as MotionValue<number>, rotateY: ry as MotionValue<number>, transformPerspective: 1000 }}
      onPointerMove={(e) => {
        if (reduceMotion || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width);
        py.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => { px.set(0.5); py.set(0.5); }}
    >
      {children}
    </motion.div>
  );
}

// ── Feature card — memoized so indicator state changes don't re-render it ────

const FeatureCard = React.memo(function FeatureCard({
  icon, title, description, href, cta, delay = 0, onMouseEnter,
}: {
  icon: React.ReactNode; title: string; description: string; href: string; cta: string; delay?: number; onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px 0px" }}
      transition={{ delay, duration: 0.5, ease: EASE }}
      whileTap={{ scale: 0.98 }}
      onMouseEnter={onMouseEnter}
      onPointerMove={(e) => {
        // Spotlight follows the cursor: CSS variables on the node, no React state.
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border/60 bg-surface-1/70 p-6 shadow-e1 backdrop-blur-sm transition-[border-color,box-shadow] duration-300 hover:border-border hover:shadow-e2"
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-brand-accent/[0.07] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: "radial-gradient(220px circle at var(--mx, 50%) var(--my, 50%), hsl(var(--brand-accent) / 0.16), transparent 65%)" }} />
      <div className="relative inline-flex size-10 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent transition-transform duration-200 group-hover:scale-110 [&>svg]:size-5">
        {icon}
      </div>
      <div className="relative flex flex-col gap-2">
        <h3 className="text-[15px] font-semibold text-foreground"><HoverableHeading text={title} /></h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Link
        href={href}
        aria-label={`${cta}: ${title}`}
        className="relative mt-auto inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground transition-colors duration-200 group-hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-accent"
      >
        {cta}
        <FiArrowRight aria-hidden="true" className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
      </Link>
    </motion.div>
  );
});

// ── Step card — memoized, with wave-hover on the step number ─────────────────

const StepCard = React.memo(function StepCard({
  step, title, description, delay = 0, isHovered = false, isNeighbor = false, onMouseEnter, onMouseLeave,
}: {
  step: string; title: string; description: string; delay?: number; isHovered?: boolean; isNeighbor?: boolean; onMouseEnter?: () => void; onMouseLeave?: () => void;
}) {
  const isDark = useIsDark();
  const reduceMotion = useReducedMotion();
  const [hoverFraction, setHoverFraction] = React.useState<number | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const pendingFrac = React.useRef(0);
  const handleCardMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pendingFrac.current = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => { rafRef.current = null; setHoverFraction(pendingFrac.current); });
    }
  };
  React.useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  return (
    <motion.div
      className="relative flex cursor-default flex-col gap-3"
      initial={{ opacity: 0, y: 26, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-40px 0px" }}
      transition={{ delay, duration: 0.45, ease: EASE }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={() => { onMouseLeave?.(); setHoverFraction(null); }}
      onPointerMove={handleCardMove}
      onPointerLeave={() => setHoverFraction(null)}
    >
      <motion.div
        className="pointer-events-none absolute -left-6 -top-6 size-32 rounded-full"
        animate={isHovered ? { opacity: 1, scale: 1 } : isNeighbor ? { opacity: 0.35, scale: 0.9 } : { opacity: 0, scale: 0.75 }}
        transition={{ duration: 0.4, ease: EASE }}
        style={{ background: isDark ? "radial-gradient(closest-side, rgb(var(--brand-accent-rgb) / 0.18) 0%, rgb(var(--brand-accent-rgb) / 0.06) 50%, transparent 100%)" : "radial-gradient(closest-side, rgb(var(--brand-accent-rgb) / 0.16) 0%, rgb(var(--brand-accent-rgb) / 0.05) 50%, transparent 100%)" }}
      />
      <div className="relative">
        <motion.span className="block select-none text-5xl font-black leading-none tracking-tighter text-muted-foreground/40" animate={{ scale: isHovered ? 1.16 : isNeighbor ? 1.06 : 1, x: isHovered ? 8 : isNeighbor ? 3 : 0 }} transition={{ duration: 0.3, ease: EASE }}>
          {step}
        </motion.span>
        <motion.span className="absolute inset-0 block select-none text-5xl font-black leading-none tracking-tighter text-brand-accent" animate={{ opacity: isHovered ? 0.65 : isNeighbor ? 0.22 : 0, scale: isHovered ? 1.16 : isNeighbor ? 1.06 : 1, x: isHovered ? 8 : isNeighbor ? 3 : 0 }} transition={{ duration: 0.3, ease: EASE }} aria-hidden="true">
          {step}
        </motion.span>
      </div>
      <h3 className="text-[15px] font-semibold text-foreground"><HoverableHeading text={title} externalFraction={hoverFraction} /></h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </motion.div>
  );
});

// ── Section heading — memoized ───────────────────────────────────────────────

const SectionHeading = React.memo(function SectionHeading({ eyebrow, title, subtitle, align = "center" }: { eyebrow: string; title: string; subtitle?: string; align?: "center" | "start" }) {
  const centered = align === "center";
  return (
    <div className={`mb-12 ${centered ? "text-center" : "text-left"}`}>
      <motion.p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-accent-hover dark:text-brand-accent-light" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
        <HoverableHeading text={eyebrow} />
      </motion.p>
      <motion.h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl" initial={{ opacity: 0, y: 26, filter: "blur(8px)" }} whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }} viewport={{ once: true }} transition={{ duration: 0.45, delay: 0.1 }}>
        <HoverableHeading text={title} />
      </motion.h2>
      {subtitle && (
        <motion.p className={`mt-3 max-w-xl text-pretty text-sm text-muted-foreground sm:text-base ${centered ? "mx-auto" : ""}`} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: 0.2 }}>
          {subtitle}
        </motion.p>
      )}
    </div>
  );
});

// ── Chapter visuals (CSS/SVG, tokens only) ───────────────────────────────────

const mock = "rounded-2xl border border-border/60 bg-surface-1/80 shadow-e2 backdrop-blur-xl";

function MarketVisual() {
  const reduceMotion = useReducedMotion();
  const items = React.useMemo(() => [
    { title: "Studio print · 4K", price: "€24", tag: "Digital · instant delivery" },
    { title: "Oak desk organiser", price: "kr 890", tag: "Physical · ships from Oslo" },
    { title: "500 AI credits", price: "$5", tag: "Prepaid" },
  ], []);
  // The stack keeps dealing: every few seconds the top card goes to the back.
  const [offset, setOffset] = React.useState(0);
  React.useEffect(() => {
    if (reduceMotion) return;
    const t = setInterval(() => setOffset((o) => (o + 1) % items.length), 3600);
    return () => clearInterval(t);
  }, [reduceMotion, items.length]);
  return (
    <div className="relative mx-auto h-64 w-full max-w-md" aria-hidden="true">
      {items.map((item, idx) => {
        const i = (idx - offset + items.length) % items.length;
        return (
        <motion.div
          key={item.title}
          className={`${mock} absolute left-0 right-0 top-0 p-4`}
          initial={{ opacity: 0, y: 40, rotate: 0 }}
          whileInView={{ opacity: 1, y: i * 54, rotate: (i - 1) * 1.5 }}
          viewport={{ once: true, margin: "-60px 0px" }}
          transition={{ delay: 0.15 + i * 0.12, duration: 0.6, ease: EASE }}
          style={{ zIndex: i, marginLeft: i * 14, marginRight: (2 - i) * 14 }}
        >
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-brand-accent/10 text-brand-accent"><FiPackage className="size-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{item.title}</span>
              <span className="block text-xs text-muted-foreground">{item.tag}</span>
            </span>
            <span className="text-sm font-semibold tabular-nums text-brand-accent-hover dark:text-brand-accent-light">{item.price}</span>
          </div>
          {i === 2 && (
            <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3 text-xs text-muted-foreground">
              <FiDownload className="size-3.5 text-brand-accent" /> {idx === 1 ? "Tracked shipment · receipt kept on the order" : "Delivered to My downloads · receipt kept on the order"}
            </div>
          )}
        </motion.div>
        );
      })}
    </div>
  );
}

function FeedVisual() {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={`${mock} mx-auto w-full max-w-md p-5`}
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.92 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-60px 0px" }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <div className="flex items-center gap-3">
        <span className="size-9 rounded-full bg-[linear-gradient(135deg,hsl(var(--brand-accent)/0.6),hsl(var(--muted)))]" />
        <span className="min-w-0"><span className="block text-sm font-semibold text-foreground">Mia · verified seller</span><span className="block text-xs text-muted-foreground">2 min ago · public</span></span>
        <span className="ml-auto rounded-full border border-brand-accent/40 bg-brand-accent/10 px-2 py-0.5 text-[10px] font-semibold text-brand-accent-hover dark:text-brand-accent-light">Reach ×1.2</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-foreground">New batch of prints is live. Which frame colour should ship as default?</p>
      <div className="mt-3 space-y-1.5">
        {[["Black", 62], ["Oak", 31], ["White", 7]].map(([label, pct], i) => (
          <div key={label} className="relative overflow-hidden rounded-lg border border-border/50 px-3 py-1.5 text-xs">
            <motion.span className="absolute inset-y-0 left-0 bg-brand-accent/15" initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.12, duration: reduceMotion ? 0 : 0.8, ease: EASE }} />
            <span className="relative flex justify-between"><span>{label}</span><span className="tabular-nums text-muted-foreground">{pct}%</span></span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 border-t border-border/50 pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 text-brand-accent"><motion.span className="inline-flex" animate={reduceMotion ? undefined : { scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.4, repeatDelay: 1.6, ease: "easeInOut" }}><PulseHeart className="size-3.5" /></motion.span> 128</span>
        <span className="inline-flex items-center gap-1"><FiMessageCircle className="size-3.5" /> 14</span>
        <span className="inline-flex items-center gap-1"><FiUsers className="size-3.5" /> 1.9k reach</span>
      </div>
    </motion.div>
  );
}

function BoardVisual() {
  const reduceMotion = useReducedMotion();
  const steps = [
    { icon: <FiSend />, title: "Request posted", text: "Custom motor bracket, 2 photos, needed by Friday" },
    { icon: <FiBriefcase />, title: "3 companies reply", text: "Offers land in Messages, with questions" },
    { icon: <FiCheck />, title: "You pick one", text: "Agree terms directly. The board never charges" },
  ];
  return (
    <div className={`${mock} mx-auto w-full max-w-md p-5`} aria-hidden="true">
      <ol className="relative space-y-4 border-l border-border/60 pl-5">
        {steps.map((step, i) => (
          <motion.li
            key={step.title}
            className="relative"
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px 0px" }}
            transition={{ delay: 0.2 + i * 0.18, duration: 0.5, ease: EASE }}
          >
            <span className="absolute -left-[29px] top-0.5 grid size-4 place-items-center rounded-full border border-brand-accent bg-surface-1 text-[9px] text-brand-accent [&>svg]:size-2.5">
              {i === 1 && !reduceMotion && <motion.span aria-hidden="true" className="absolute inset-0 rounded-full border border-brand-accent" animate={{ scale: [1, 2.2], opacity: [0.7, 0] }} transition={{ repeat: Infinity, duration: 1.8, ease: "easeOut", delay: 1 }} />}
              {step.icon}
            </span>
            <p className="text-sm font-semibold text-foreground">{step.title}</p>
            <p className="text-xs text-muted-foreground">{step.text}</p>
          </motion.li>
        ))}
      </ol>
      <motion.div className="mt-4 rounded-xl border border-brand-accent/30 bg-brand-accent/[0.06] px-3 py-2 text-xs text-foreground/85" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.8 }}>
        Run a company on Veggat: team roles, warehouses, payouts and a storefront under one roof.
      </motion.div>
    </div>
  );
}

function TerminalVisual() {
  const reduceMotion = useReducedMotion();
  // A small candle series (x, open, close, high, low) in a 320×140 box; y grows downward.
  const candles = [
    [14, 96, 82, 74, 104], [38, 82, 90, 78, 98], [62, 90, 70, 62, 94], [86, 70, 76, 60, 84], [110, 76, 58, 50, 80], [134, 58, 64, 52, 72],
    [158, 64, 48, 40, 70], [182, 48, 56, 42, 62], [206, 56, 38, 30, 60], [230, 38, 44, 32, 52], [254, 44, 26, 20, 50], [278, 26, 32, 18, 40],
  ];
  const line = "M14 100 C 60 92, 90 84, 120 70 S 200 50, 240 40 S 290 26, 306 24";
  return (
    <motion.div
      className={`${mock} mx-auto w-full max-w-md overflow-hidden`}
      aria-hidden="true"
      initial={{ clipPath: "inset(0 100% 0 0 round 16px)", opacity: 0.4 }}
      whileInView={{ clipPath: "inset(0 0% 0 0 round 16px)", opacity: 1 }}
      viewport={{ once: true, margin: "-60px 0px" }}
      transition={{ duration: reduceMotion ? 0 : 1.1, ease: EASE }}
    >
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5 text-xs">
        <span className="font-semibold text-foreground">ETH / USD <span className="ml-2 font-normal text-muted-foreground">1H</span></span>
        <span className="tabular-nums text-chart-up">+2.4%</span>
      </div>
      <svg viewBox="0 0 320 140" className="block h-40 w-full">
        {[30, 60, 90, 120].map((y) => <line key={y} x1="0" x2="320" y1={y} y2={y} stroke="currentColor" className="text-border/50" strokeWidth="1" />)}
        {candles.map(([x, o, c, h, l], i) => {
          const up = c < o;
          return (
            <motion.g key={x} initial={{ opacity: 0, scaleY: 0.2 }} whileInView={{ opacity: 1, scaleY: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.05, duration: 0.4, ease: EASE }} style={{ transformOrigin: `${x}px ${(h + l) / 2}px` }} className={up ? "text-chart-up" : "text-chart-down"}>
              <line x1={x} x2={x} y1={h} y2={l} stroke="currentColor" strokeWidth="1.5" />
              <rect x={x - 5} y={Math.min(o, c)} width="10" height={Math.max(2, Math.abs(o - c))} fill="currentColor" rx="1" />
            </motion.g>
          );
        })}
        <motion.path d={line} fill="none" stroke="hsl(var(--brand-accent))" strokeWidth="2" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ delay: 0.6, duration: reduceMotion ? 0 : 1.4, ease: "easeInOut" }} />
        {/* A crosshair that keeps sweeping: the chart is alive, not a picture */}
        {!reduceMotion && <motion.line x1="0" x2="0" y1="0" y2="140" stroke="hsl(var(--foreground) / 0.22)" strokeWidth="1" strokeDasharray="3 3" animate={{ x: [0, 320] }} transition={{ repeat: Infinity, duration: 8, ease: "linear", delay: 2 }} />}
      </svg>
      <div className="flex items-center justify-between border-t border-border/50 px-4 py-2.5 text-[11px] text-muted-foreground">
        <span>Paper account · $100,000</span>
        <span className="rounded-full border border-border/60 px-2 py-0.5">RSI · MACD · VWAP</span>
      </div>
    </motion.div>
  );
}

function AiVisual() {
  const reduceMotion = useReducedMotion();
  const bubbles = [
    { who: "You", text: "Draft a launch post for the print series, keep it short.", me: true },
    { who: "Jonas", text: "Mention the oak frame poll result?", me: false },
    { who: "Veggat AI", text: "Sure. \"The oak frame won, 31% to 62% for black… \" (draft ready). Cost: 12 credits.", ai: true },
  ];
  return (
    <div className={`${mock} mx-auto w-full max-w-md p-5`} aria-hidden="true">
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground"><FiUsers className="size-3.5 text-brand-accent" />Launch room · 3 people + AI</span>
        <span className="rounded-full border border-border/60 px-2 py-0.5">Prepaid · 840 credits left</span>
      </div>
      <div className="space-y-2">
        {bubbles.map((b, i) => (
          <motion.div
            key={b.who}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${b.me ? "ml-auto bg-brand-accent text-brand-accent-foreground" : b.ai ? "border border-brand-accent/30 bg-brand-accent/[0.08] text-foreground" : "bg-foreground/[0.06] text-foreground"}`}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-60px 0px" }}
            transition={{ delay: 0.2 + i * 0.22, duration: 0.45, ease: EASE }}
          >
            <span className={`mb-0.5 block text-[10px] font-semibold uppercase tracking-wider ${b.me ? "text-brand-accent-foreground/80" : "text-muted-foreground"}`}>{b.who}</span>
            {b.text}
          </motion.div>
        ))}
        {/* Someone is always about to say something */}
        <motion.div className="flex w-fit items-center gap-1 rounded-2xl bg-foreground/[0.06] px-3 py-2" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1.1 }} aria-hidden="true">
          {[0, 1, 2].map((i) => <motion.span key={i} className="size-1.5 rounded-full bg-muted-foreground" animate={reduceMotion ? undefined : { opacity: [0.25, 1, 0.25] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.18 }} />)}
        </motion.div>
      </div>
    </div>
  );
}

// ── Chapter: text on one side, visual on the other, own reveal ───────────────

const chapterReveal: Record<"left" | "right", Variants> = {
  left: { hidden: { opacity: 0, x: -40 }, show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE } } },
  right: { hidden: { opacity: 0, x: 40 }, show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE } } },
};

function Chapter({ index, eyebrow, title, body, points, href, cta, visual, flip = false }: {
  index: string; eyebrow: string; title: string; body: string; points: string[]; href: string; cta: string; visual: React.ReactNode; flip?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.article
      className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}
      initial={reduceMotion ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-80px 0px" }}
    >
      <motion.div variants={chapterReveal[flip ? "right" : "left"]} className="min-w-0">
        <p className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-accent-hover dark:text-brand-accent-light">
          <span className="font-mono text-muted-foreground/60">{index}</span>
          <HoverableHeading text={eyebrow} />
        </p>
        <h3 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"><HoverableHeading text={title} /></h3>
        <p className="mt-4 max-w-lg text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">{body}</p>
        <ul className="mt-5 space-y-2.5">
          {points.map((point, i) => (
            <motion.li key={point} className="flex gap-3 text-sm text-foreground/90" initial={reduceMotion ? false : { opacity: 0, x: flip ? 16 : -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.25 + i * 0.1, duration: 0.4, ease: EASE }}>
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-accent/12 text-brand-accent"><FiCheck className="size-3" /></span>
              <span>{point}</span>
            </motion.li>
          ))}
        </ul>
        <Link href={href} className="group/link mt-6 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {cta}<FiArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover/link:translate-x-0.5" />
        </Link>
      </motion.div>
      <motion.div variants={chapterReveal[flip ? "left" : "right"]} className="min-w-0">
        <TiltCard>{visual}</TiltCard>
      </motion.div>
    </motion.article>
  );
}

// ── Stats indicator types ─────────────────────────────────────────────────────

type IndicatorStyle = { left: number; top: number; width: number; height: number };
const INDICATOR_TRANSITION = "left 0.4s cubic-bezier(0.22, 1, 0.36, 1), top 0.4s cubic-bezier(0.22, 1, 0.36, 1), width 0.4s cubic-bezier(0.22, 1, 0.36, 1), height 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease-out";

/** One sliding highlight box per grid; the container ref is owned by the caller so this returns plain state. */
function useSlidingIndicator(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [style, setStyle] = React.useState<IndicatorStyle | null>(null);
  const [visible, setVisible] = React.useState(false);
  const enter = React.useCallback((el: HTMLElement | null) => {
    const container = containerRef.current;
    if (!container || !el) return;
    const cr = container.getBoundingClientRect();
    const cl = el.getBoundingClientRect();
    setStyle({ left: cl.left - cr.left, top: cl.top - cr.top, width: cl.width, height: cl.height });
    setVisible(true);
  }, [containerRef]);
  const leave = React.useCallback(() => setVisible(false), []);
  return { style, visible, enter, leave };
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function BelowFoldSections() {
  const reduceMotion = useReducedMotion();
  const featuresRef = React.useRef<HTMLDivElement>(null);
  const statsRef = React.useRef<HTMLDivElement>(null);
  const trustRef = React.useRef<HTMLDivElement>(null);
  const features = useSlidingIndicator(featuresRef);
  const stats = useSlidingIndicator(statsRef);
  const trust = useSlidingIndicator(trustRef);
  const [hoveredStep, setHoveredStep] = React.useState<number | null>(null);
  const statCellRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  const FEATURES = [
    { icon: <FiShoppingBag />, title: "Sell anything, physical or digital", description: "Photos, stock and shipping for things that ship; files that deliver the moment payment is verified for things that download. One listing flow for both.", href: "/products", cta: "Browse the marketplace" },
    { icon: <PulseHeart />, title: "Say it, poll it, watch it move", description: "A live feed of posts and polls scored by real reach, not vanity counts. Verification and good work grow your voice.", href: "/pulse", cta: "Open Pulse" },
    { icon: <FiBriefcase />, title: "Post a request, receive offers", description: "Describe the job, attach photos, and let companies come to you. Or browse open requests and win the work.", href: "/jobs", cta: "See the job board" },
    { icon: <FiTrendingUp />, title: "Chart it, paper trade it, own it", description: "Candles, indicators, drawing tools and a paper account to practise on. Real positions run through your own wallet.", href: "/dashboard/trading", cta: "Open the terminal" },
    { icon: <FiKey />, title: "Your keys stay yours", description: "Connect any EVM wallet, see every token with scam checks, swap, add liquidity and stake, without handing over custody.", href: "/dashboard/trading", cta: "Connect a wallet" },
    { icon: <FiCpu />, title: "Ask alone, or with your team", description: "Prepaid credits or your own API key, rooms where people and models talk together, and the cost shown before every message.", href: "/ai", cta: "Start a chat" },
  ];

  return (
    <div className="relative w-full">
      <div className="mx-auto max-w-5xl px-6 xl:max-w-6xl"><div className="h-px bg-linear-to-r from-transparent via-muted to-transparent" /></div>

      {/* ── Six doors ─────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24 xl:max-w-6xl">
        <SectionHeading eyebrow="One account" title="Everything a maker, a business and a trader need" subtitle="Six products that share one login, one wallet and one set of rules. Start with the one you came for; the rest is already there." />
        <div ref={featuresRef} className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onMouseLeave={features.leave}>
          {features.style !== null && (
            <div className="pointer-events-none absolute z-10 rounded-2xl border border-brand-accent/50" style={{ ...features.style, opacity: features.visible ? 1 : 0, transition: INDICATOR_TRANSITION }} />
          )}
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} delay={i * 0.07} {...f} onMouseEnter={(e) => features.enter(e.currentTarget)} />
          ))}
        </div>
      </div>

      {/* ── Watch it work: a self-playing tour ──────────────────────────── */}
      <div className="border-t border-border/60 bg-foreground/[0.03]">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24 xl:max-w-6xl">
          <SectionHeading eyebrow="Watch it work" title="Four things you can do in the next five minutes" subtitle="A scripted tour that plays on its own. Hover to pause, pick a scene to jump." />
          <motion.div initial={reduceMotion ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px 0px" }} transition={{ duration: 0.55, ease: EASE }}>
            <LandingDemoLoop />
          </motion.div>
        </div>
      </div>

      {/* ── Promise strip ───────────────────────────────────────────────── */}
      <div className="border-y border-border/60 bg-foreground/[0.04]">
        <div ref={statsRef} className="relative mx-auto max-w-5xl xl:max-w-6xl" onMouseLeave={stats.leave}>
          {stats.style !== null && (
            <div className="pointer-events-none absolute z-10 rounded-sm border border-brand-accent/50" style={{ ...stats.style, opacity: stats.visible ? 1 : 0, transition: INDICATOR_TRANSITION }} />
          )}
          <div className="absolute bottom-0 left-0 top-0 w-px bg-muted" /><div className="absolute bottom-0 right-0 top-0 w-px bg-muted" />
          <div className="grid grid-cols-2 divide-x divide-y divide-border/60 sm:grid-cols-4 sm:divide-y-0">
            {([
              { value: "Demo", label: "No card, no sign-up" },
              { value: "BYOK", label: "Your keys, your billing" },
              { value: "Non-custodial", label: "Wallets stay yours" },
              { value: "Verified", label: "Tiers for people and sellers" },
            ] as const).map(({ value, label }, i) => (
              <motion.div
                key={label}
                ref={(el) => { statCellRefs.current[i] = el; }}
                className="flex cursor-default flex-col items-center justify-center gap-1 px-6 py-8 text-center"
                initial={{ opacity: 0, y: 26, filter: "blur(8px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-50px 0px" }}
                transition={{ delay: i * 0.08, duration: 0.4, ease: "easeOut" }}
                onMouseEnter={() => stats.enter(statCellRefs.current[i])}
              >
                <span className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{value}</span>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chapters ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl space-y-24 px-6 py-16 sm:py-24 xl:max-w-6xl">
        <SectionHeading eyebrow="The story" title="Five rooms, one house" subtitle="Each part of Veggat stands on its own. Together they cover what you buy, what you say, what you build, what you trade and what you ask." />

        <Chapter
          index="01" eyebrow="The market" title="A storefront for anything, without the middleman’s cut"
          body="List a product in one screen: photos, files, price, stock and shipping. Buyers check out on clear terms, digital files land in their account and the receipt stays on the order. Companies get a storefront, a team and payouts of their own."
          points={["Digital, physical or both; files delivered on verified payment", "Private downloads, receipts and order history for every buyer", "Company storefronts with roles, warehouses and payout settings"]}
          href="/products" cta="Browse the marketplace" visual={<MarketVisual />}
        />
        <Chapter
          index="02" eyebrow="The feed" title="A public square where reach is earned"
          body="Pulse is where sellers, buyers and builders talk. Post, ask, run a poll in seconds and see what lands. Reach is scored on real engagement and multiplied by verification, so trust, not noise, carries a voice."
          points={["Posts, polls and live results in one stream", "Reach scores instead of follower counts", "Follow people, tag topics, join the conversation"]}
          href="/pulse" cta="Open Pulse" visual={<FeedVisual />} flip
        />
        <Chapter
          index="03" eyebrow="The job board" title="Describe the work. Let the offers come to you."
          body="Need a part made, a service delivered or a project done? Post a request with photos and details, choose which companies see it, and compare the offers that arrive. Companies browse open requests and win work on merit."
          points={["Requests with images, documents and delivery preferences", "Send to every company or a hand-picked few", "Offers and questions arrive in Messages; terms are agreed directly"]}
          href="/jobs" cta="See the job board" visual={<BoardVisual />}
        />
        <Chapter
          index="04" eyebrow="The terminal" title="A real chart, a paper account, and your own wallet"
          body="Candlesticks with the tools you expect: indicators, drawings, measures and comparisons. Practise on a paper account, then trade for real straight from a wallet you control, with scam checks on every token, swaps, liquidity and staking in the same place."
          points={["Indicators, Fibonacci, positions, anchored VWAP and more", "Paper trading with limit and stop orders to learn safely", "Non-custodial swaps, liquidity and HEX staking; verified transfers between wallets"]}
          href="/dashboard/trading" cta="Open the terminal" visual={<TerminalVisual />} flip
        />
        <Chapter
          index="05" eyebrow="The AI room" title="Ask on your own, or in a room with your team"
          body="Chat with leading models on prepaid credits or bring your own API key and let your provider bill you. Rooms hold people and models together, so a decision, a draft or an analysis happens in one place, with the cost shown before you send."
          points={["Prepaid credits with a daily cap, or BYOK with zero markup", "Group rooms: several people and the model in one thread", "Voice dictation and files, kept private to your account"]}
          href="/ai" cta="Start a chat" visual={<AiVisual />}
        />
      </div>

      {/* ── Trust layer ─────────────────────────────────────────────────── */}
      <div className="border-t border-border/60 bg-foreground/[0.03]">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24 xl:max-w-6xl">
          <SectionHeading eyebrow="Built on trust" title="The rules are the same in every room" subtitle="Money, identity and files are handled the same careful way whether you are buying a print, hiring a company or moving tokens." />
          <div ref={trustRef} className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onMouseLeave={trust.leave}>
            {trust.style !== null && (
              <div className="pointer-events-none absolute z-10 rounded-2xl border border-brand-accent/50" style={{ ...trust.style, opacity: trust.visible ? 1 : 0, transition: INDICATOR_TRANSITION }} />
            )}
            {[
              { icon: <FiShield />, title: "Verification tiers", text: "Email, linked accounts, wallet signatures, payments and phone add up to a tier that multiplies reach and unlocks features." },
              { icon: <FiLock />, title: "Non-custodial by design", text: "Wallets connect, sign and send from your own extension. Veggat never holds keys or funds." },
              { icon: <FiZap />, title: "Scam checks on tokens", text: "Every token you hold is screened for honeypots, taxes and thin liquidity before it counts toward your balance." },
              { icon: <FiBarChart2 />, title: "Clear terms, kept records", text: "Prices shown before you commit, the demo never charges, and every order, credit and file keeps its receipt." },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface-1/70 p-5 shadow-e1 backdrop-blur-sm"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.94, y: 16 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px 0px" }}
                transition={{ delay: i * 0.08, duration: 0.5, ease: EASE }}
                onMouseEnter={(e) => trust.enter(e.currentTarget)}
              >
                <span className="grid size-10 place-items-center rounded-xl bg-brand-accent/10 text-brand-accent transition-transform duration-200 group-hover:scale-110 [&>svg]:size-5">{item.icon}</span>
                <h3 className="text-[15px] font-semibold text-foreground"><HoverableHeading text={item.title} /></h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24 xl:max-w-6xl">
        <SectionHeading eyebrow="How it works" title="Four steps, whichever door you take" />
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4" onMouseLeave={() => setHoveredStep(null)}>
          {([
            { step: "01", title: "Create one account", description: "Email, a linked account or a wallet signature. Try the demo first if you like; it never charges." },
            { step: "02", title: "Pick your lane", description: "List a product, post a pulse, send a request, open the chart or start a chat. Everything shares the same profile." },
            { step: "03", title: "Act on clear terms", description: "Prices, credit costs, fees and delivery are shown before you commit. Real purchases go through PayPal or your own wallet." },
            { step: "04", title: "Keep the record", description: "Orders, downloads, credits, trades and messages stay in your account, with receipts you can come back to." },
          ] as const).map(({ step, title, description }, i) => (
            <StepCard key={step} step={step} title={title} description={description} delay={i * 0.1} isHovered={hoveredStep === i} isNeighbor={hoveredStep !== null && Math.abs(hoveredStep - i) === 1} onMouseEnter={() => setHoveredStep(i)} />
          ))}
        </div>
      </div>

      {/* ── Beta note ───────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 pb-4 xl:max-w-6xl">
        <motion.div
          className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-surface-1/70 p-5 shadow-e1 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Veggat is in open beta, built in the open.</p>
            <p className="mt-1 text-sm text-muted-foreground">The marketplace, Pulse, the job board, the terminal and the AI workspace are live. Company checkout and crypto settlement for orders are being finished.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded-full border border-brand-accent/40 bg-brand-accent/10 px-2.5 py-1 text-brand-accent-hover dark:text-brand-accent-light">Live · 5 products</span>
            <span className="rounded-full border border-border/60 bg-foreground/[0.04] px-2.5 py-1 text-muted-foreground">In progress · 2</span>
          </div>
        </motion.div>
      </div>

      {/* ── Bottom CTA strip ─────────────────────────────────────────────── */}
      <div className="border-t border-border/60">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20 xl:max-w-6xl">
          <motion.div className="flex flex-col items-center gap-5 text-center" initial={{ opacity: 0, y: 26, filter: "blur(8px)" }} whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }} viewport={{ once: true }} transition={{ duration: 0.5, ease: "easeOut" }}>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"><HoverableHeading text="Start with the demo. Stay for the whole stack." /></h2>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">Browse the market, read the feed and open the chart without an account. Sign up when you want to sell, post, hire, trade or ask.</p>
            <Link href="/pricing" className="group/plans inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent underline-offset-4 hover:underline">
              <span>See pricing &amp; plans</span>
              <span aria-hidden className="transition-transform duration-300 group-hover/plans:translate-x-0.5">→</span>
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <MagneticButton>
                <motion.div className="absolute -inset-[1px] rounded-xl bg-[linear-gradient(90deg,hsl(var(--brand-accent)),hsl(var(--brand-accent-alt)),hsl(var(--brand-accent)))] blur-[2px] group-hover:blur-[3px]" animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"], opacity: [0.5, 0.8, 0.5] }} whileHover={{ opacity: 1 }} transition={{ backgroundPosition: { duration: 3, repeat: Infinity, ease: "linear" }, opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" } }} style={{ backgroundSize: "200% 200%" }} />
                <Link href="/products" className="relative flex items-center gap-2 rounded-xl bg-brand-accent-hover px-6 py-3 text-sm font-semibold text-brand-accent-foreground backdrop-blur-sm transition duration-300 group-hover:bg-brand-accent-hover group-hover:text-brand-accent-light">
                  <span>Browse products</span>
                  <FiArrowRight aria-hidden="true" className="-ml-3 size-3.5 opacity-0 transition duration-300 group-hover:ml-0 group-hover:opacity-100" />
                </Link>
              </MagneticButton>
              <MagneticButton>
                <motion.div className="absolute -inset-[1px] rounded-xl bg-linear-to-r from-muted/20 via-muted/40 to-muted/20 blur-[1px]" animate={{ opacity: [0.2, 0.4, 0.2] }} whileHover={{ opacity: 0.7 }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} />
                <Link href="/pulse" className="relative flex items-center gap-2 rounded-xl border border-border bg-foreground/[0.06] px-5 py-3 text-sm font-medium text-foreground backdrop-blur-sm transition duration-300 hover:bg-foreground/[0.09] group-hover:shadow-e2">
                  <PulseHeart className="size-4 text-brand-accent transition-transform duration-300 group-hover:scale-110" />
                  <span>Open Pulse</span>
                </Link>
              </MagneticButton>
              <MagneticButton>
                <motion.div className="absolute -inset-[1px] rounded-xl bg-linear-to-r from-brand-accent/10 via-brand-accent/25 to-brand-accent/10 blur-[1px]" animate={{ opacity: [0.15, 0.35, 0.15] }} whileHover={{ opacity: 0.65 }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }} />
                <Link href="/ai" className="relative flex items-center gap-2 rounded-xl border border-brand-accent/30 bg-brand-accent/[0.06] px-5 py-3 text-sm font-medium text-foreground backdrop-blur-sm transition duration-300 hover:border-brand-accent/50 hover:bg-brand-accent/10">
                  <FiCpu className="size-4 text-brand-accent transition-transform duration-300 group-hover:rotate-12" />
                  <span>Ask AI</span>
                </Link>
              </MagneticButton>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
