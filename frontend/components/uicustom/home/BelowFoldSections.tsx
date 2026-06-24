"use client";

import * as React from "react";
import { motion, useReducedMotion, useMotionValue, useSpring, type MotionValue } from "framer-motion";
import Link from "next/link";

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

// ── Shared hoverable heading ──────────────────────────────────────────────────
// Plain <span>s with CSS transitions — no framer-motion per-character overhead.

function HoverableHeading({
  text,
  className,
  /** When provided (0..1), the highlight position is driven externally (e.g. by
   *  the parent card's horizontal mouse position) instead of per-character
   *  hover. null clears it. */
  externalFraction,
}: {
  text: string;
  className?: string;
  externalFraction?: number | null;
}) {
  const reduceMotion = useReducedMotion();
  const isDark = useIsDark();
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);

  // Brand accent RGB: sky-500 in light, emerald-400 in dark
  const accentRgb = isDark ? "52, 211, 153" : "14, 165, 233";

  // Map an external 0..1 fraction onto a character index (spaces excluded so the
  // wave lands on real letters as you read left→right).
  const letterIndices = React.useMemo(
    () => Array.from(text).map((c, i) => (c === " " ? -1 : i)).filter((i) => i >= 0),
    [text]
  );
  const effectiveIdx = React.useMemo(() => {
    if (externalFraction == null) return hoveredIdx;
    if (letterIndices.length === 0) return null;
    const pos = Math.round(externalFraction * (letterIndices.length - 1));
    return letterIndices[Math.max(0, Math.min(letterIndices.length - 1, pos))];
  }, [externalFraction, hoveredIdx, letterIndices]);

  if (reduceMotion) return <span className={className}>{text}</span>;

  return (
    <span
      className={`${className ?? ""} cursor-default`}
      onPointerLeave={() => setHoveredIdx(null)}
    >
      {Array.from(text).map((char, i) => {
        if (char === " ") {
          return (
            <span key={i} className="inline-block" style={{ width: "0.28em" }}>
              &nbsp;
            </span>
          );
        }
        const dist = effectiveIdx !== null ? Math.abs(i - effectiveIdx) : Infinity;
        const intensity = dist === 0 ? 1 : dist === 1 ? 0.55 : dist === 2 ? 0.22 : 0;
        const active = intensity > 0;
        return (
          <span
            key={i}
            className="inline-block origin-bottom"
            style={{
              color: active ? `rgba(${accentRgb}, ${0.5 + 0.5 * intensity})` : undefined,
              textShadow: active
                ? `0 0 ${12 * intensity}px rgba(${accentRgb}, ${0.35 * intensity})`
                : "none",
              transform: `scale(${active ? 1 + 0.1 * intensity : 1}) translateY(${
                active ? -2 * intensity : 0
              }px)`,
              transition:
                "color 0.12s ease-out, text-shadow 0.12s ease-out, transform 0.12s ease-out",
            }}
            onPointerEnter={() => setHoveredIdx(i)}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}

// ── Magnetic button wrapper — follows cursor, click scale, border glow ───────

function MagneticButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
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

// ── Inline SVG icons (defined once outside components) ───────────────────────

function AiIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 10 10" />
      <path d="M12 12 2.1 9.1" />
      <path d="m12 12 9-5" />
      <path d="M12 12v10" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function PollIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

// Stable icon instances — prevents React.memo from seeing new props on parent re-render
const AI_ICON = <AiIcon />;
const POLL_ICON = <PollIcon />;
const BOX_ICON = <BoxIcon />;

// ── Feature card — memoized so stats-hover state changes don't re-render it ──

const FeatureCard = React.memo(function FeatureCard({
  icon,
  title,
  description,
  href,
  accentClass,
  delay = 0,
  onMouseEnter,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  accentClass: string;
  delay?: number;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px 0px" }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.98 }}
      onMouseEnter={onMouseEnter}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-gray-200/60 dark:border-white/7 bg-white/70 dark:bg-white/2.5 p-6 backdrop-blur-sm transition-all duration-300 hover:border-gray-300 dark:hover:border-white/12 hover:shadow-lg dark:hover:shadow-[0_8px_40px_rgba(0,0,0,0.25)] cursor-pointer"
    >
      <div
        className={`pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br ${accentClass} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
      />
      <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/6 text-gray-500 dark:text-white/60 transition-all duration-200 group-hover:bg-gray-200 dark:group-hover:bg-white/10 group-hover:scale-110">
        {icon}
      </div>
      <div className="relative flex flex-col gap-2">
        <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">
          <HoverableHeading text={title} />
        </h3>
        <p className="text-sm leading-relaxed text-gray-500 dark:text-white/45">{description}</p>
      </div>
      <Link
        href={href}
        className="relative mt-auto inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-white/35 transition-colors duration-200 group-hover:text-gray-700 dark:group-hover:text-white/70"
      >
        Explore
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          className="transition-transform duration-300 group-hover:translate-x-0.5"
        >
          <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
        </svg>
      </Link>
    </motion.div>
  );
});

// ── Step card — memoized, with wave-hover on the step number ─────────────────

const StepCard = React.memo(function StepCard({
  step,
  title,
  description,
  delay = 0,
  isHovered = false,
  isNeighbor = false,
  onMouseEnter,
  onMouseLeave,
}: {
  step: string;
  title: string;
  description: string;
  delay?: number;
  isHovered?: boolean;
  isNeighbor?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const isDark = useIsDark();
  const reduceMotion = useReducedMotion();
  // Horizontal mouse position over the whole card (0 = left, 1 = right), which
  // drives the title's letter-by-letter highlight so it "reads" left→right as
  // the cursor moves across the card.
  const [hoverFraction, setHoverFraction] = React.useState<number | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const pendingFrac = React.useRef(0);

  const handleCardMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pendingFrac.current = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setHoverFraction(pendingFrac.current);
      });
    }
  };

  React.useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  return (
    <motion.div
      className="relative flex flex-col gap-3 cursor-default"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px 0px" }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={() => { onMouseLeave?.(); setHoverFraction(null); }}
      onPointerMove={handleCardMove}
      onPointerLeave={() => setHoverFraction(null)}
    >
      {/* Ambient radial glow behind the number — no border box, just soft light */}
      <motion.div
        className="pointer-events-none absolute -top-6 -left-6 w-32 h-32 rounded-full"
        animate={
          isHovered
            ? { opacity: 1, scale: 1 }
            : isNeighbor
              ? { opacity: 0.35, scale: 0.9 }
              : { opacity: 0, scale: 0.75 }
        }
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: isDark
            ? "radial-gradient(closest-side, rgba(52,211,153,0.18) 0%, rgba(52,211,153,0.06) 50%, transparent 100%)"
            : "radial-gradient(closest-side, rgba(14,165,233,0.18) 0%, rgba(14,165,233,0.06) 50%, transparent 100%)",
        }}
      />

      {/* Step number: ghost base + emerald overlay that fades in on hover */}
      <div className="relative">
        {/* Base ghost number — light mode needs a touch more ink than gray-200,
            which all but vanishes on the soft #F9FAFB bg and made the whole step
            sequence read as missing until hovered. */}
        <motion.span
          className="select-none text-5xl font-black leading-none tracking-tighter text-gray-300/80 dark:text-white/[0.07]"
          animate={{
            scale: isHovered ? 1.16 : isNeighbor ? 1.06 : 1,
            x: isHovered ? 8 : isNeighbor ? 3 : 0,
          }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: "block" }}
        >
          {step}
        </motion.span>
        {/* Brand accent overlay — fades in on hover, no border box needed */}
        <motion.span
          className="absolute inset-0 select-none text-5xl font-black leading-none tracking-tighter text-sky-400 dark:text-emerald-400"
          animate={{
            opacity: isHovered ? 0.65 : isNeighbor ? 0.22 : 0,
            scale: isHovered ? 1.16 : isNeighbor ? 1.06 : 1,
            x: isHovered ? 8 : isNeighbor ? 3 : 0,
          }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden="true"
          style={{ display: "block" }}
        >
          {step}
        </motion.span>
      </div>

      <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">
        <HoverableHeading text={title} />
      </h3>
      <p className="text-sm leading-relaxed text-gray-400 dark:text-white/40">{description}</p>
    </motion.div>
  );
});

// ── Section heading — memoized ───────────────────────────────────────────────

const SectionHeading = React.memo(function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-12 text-center">
      <motion.p
        className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-emerald-400/60"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
      >
        <HoverableHeading text={eyebrow} />
      </motion.p>
      <motion.h2
        className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, delay: 0.1 }}
      >
        <HoverableHeading text={title} />
      </motion.h2>
      {subtitle && (
        <motion.p
          className="mx-auto mt-3 max-w-lg text-sm text-gray-400 dark:text-white/35"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.2 }}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
});

// ── Stats indicator types ─────────────────────────────────────────────────────

type IndicatorStyle = { left: number; top: number; width: number; height: number };

const STAT_COUNT = 4;

// ── Main export ───────────────────────────────────────────────────────────────

export default function BelowFoldSections() {
  // ── Stats sliding indicator ─────────────────────────────────────────────
  //
  // 4 cells → 4 positions. The indicator box matches the hovered cell exactly
  // with all 4 borders, sliding smoothly via CSS transition.

  const statsContainerRef = React.useRef<HTMLDivElement>(null);
  const statCellRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  const [indicatorStyle, setIndicatorStyle] = React.useState<IndicatorStyle | null>(null);
  const [indicatorVisible, setIndicatorVisible] = React.useState(false);

  // ── How-it-works step hover ──────────────────────────────────────────────
  const [hoveredStep, setHoveredStep] = React.useState<number | null>(null);

  // ── Feature cards sliding indicator ─────────────────────────────────────

  const featureContainerRef = React.useRef<HTMLDivElement>(null);
  const [featureIndicatorStyle, setFeatureIndicatorStyle] = React.useState<IndicatorStyle | null>(null);
  const [featureIndicatorVisible, setFeatureIndicatorVisible] = React.useState(false);

  const handleFeatureEnter = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = featureContainerRef.current;
    const card = e.currentTarget;
    if (!container) return;

    const cr = container.getBoundingClientRect();
    const cl = card.getBoundingClientRect();

    setFeatureIndicatorStyle({
      left: cl.left - cr.left,
      top: cl.top - cr.top,
      width: cl.width,
      height: cl.height,
    });
    setFeatureIndicatorVisible(true);
  }, []);

  const handleStatEnter = React.useCallback((i: number) => {
    const container = statsContainerRef.current;
    const cell = statCellRefs.current[i];
    if (!container || !cell) return;

    const cr = container.getBoundingClientRect();
    const cl = cell.getBoundingClientRect();

    // Indicator stays within the grid cell — no edge-bleed
    setIndicatorStyle({
      left: cl.left - cr.left,
      top: cl.top - cr.top,
      width: cl.width,
      height: cl.height,
    });
    setIndicatorVisible(true);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full">
      {/* Top divider */}
      <div className="mx-auto max-w-5xl px-6 xl:max-w-6xl">
        <div className="h-px bg-linear-to-r from-transparent via-gray-200 dark:via-white/7 to-transparent" />
      </div>

      {/* ── Features grid ──────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24 xl:max-w-6xl">
        <SectionHeading
          eyebrow="Platform"
          title="One platform, built for this"
          subtitle="For teams and creators who move fast."
        />

        <div
          ref={featureContainerRef}
          className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          onMouseLeave={() => setFeatureIndicatorVisible(false)}
        >
          {/* Sliding indicator — matches hovered card, fades on leave */}
          {featureIndicatorStyle !== null && (
            <div
              className="absolute pointer-events-none z-10 rounded-2xl border border-sky-500/50 dark:border-emerald-400/40"
              style={{
                left: featureIndicatorStyle.left,
                top: featureIndicatorStyle.top,
                width: featureIndicatorStyle.width,
                height: featureIndicatorStyle.height,
                opacity: featureIndicatorVisible ? 1 : 0,
                transition: "left 0.4s cubic-bezier(0.22, 1, 0.36, 1), top 0.4s cubic-bezier(0.22, 1, 0.36, 1), width 0.4s cubic-bezier(0.22, 1, 0.36, 1), height 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease-out",
              }}
            />
          )}

          <FeatureCard
            delay={0}
            href="/ai"
            title="AI Chat"
            description="Six AI models including GPT, Claude, and Gemini. Free on platform keys — or bring your own for unlimited access."
            icon={AI_ICON}
            accentClass="from-violet-500/6 to-transparent"
            onMouseEnter={handleFeatureEnter}
          />
          <FeatureCard
            delay={0.1}
            href="/pulse"
            title="Live Polls"
            description="AI-generated polls with real-time voting and verification-weighted results. Create, share, and watch the community decide — powered by True Reach™."
            icon={POLL_ICON}
            accentClass="from-emerald-500/6 to-transparent"
            onMouseEnter={handleFeatureEnter}
          />
          <FeatureCard
            delay={0.2}
            href="/dashboard/trading"
            title="Trading & Inventory"
            description="Warehouse tracking, shipping rates, and order management from a single dashboard."
            icon={BOX_ICON}
            accentClass="from-sky-500/6 to-transparent"
            onMouseEnter={handleFeatureEnter}
          />
        </div>
      </div>

      {/* ── Stats strip ────────────────────────────────────────────────────── */}
      <div className="border-y border-gray-100 dark:border-white/5 bg-gray-50/60 dark:bg-white/1.5">
        {/* `relative` here is the positioning context for the indicator */}
        <div
          ref={statsContainerRef}
          className="relative mx-auto max-w-5xl xl:max-w-6xl"
          onMouseLeave={() => {
            setIndicatorVisible(false);
          }}
        >

          {/* Sliding indicator — 4 positions, all 4 borders, smooth CSS transition */}
          {indicatorStyle !== null && (
            <div
              className="absolute pointer-events-none z-10 border border-sky-500/50 dark:border-emerald-400/40 rounded-sm"
              style={{
                left: indicatorStyle.left,
                top: indicatorStyle.top,
                width: indicatorStyle.width,
                height: indicatorStyle.height,
                opacity: indicatorVisible ? 1 : 0,
                transition: "left 0.4s cubic-bezier(0.22, 1, 0.36, 1), top 0.4s cubic-bezier(0.22, 1, 0.36, 1), width 0.4s cubic-bezier(0.22, 1, 0.36, 1), height 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease-out",
              }}
            />
          )}

          {/* Gray edge dividers at left and right of the grid */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-100 dark:bg-white/5" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-100 dark:bg-white/5" />

          <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 dark:divide-white/5 sm:grid-cols-4 sm:divide-y-0">
            {(
              [
                { value: "6", label: "AI Models" },
                { value: "BYOK", label: "Your Keys, No Limits" },
                { value: "$0", label: "To Start" },
                { value: "12", label: "Trust Tiers" },
              ] as const
            ).map(({ value, label }, i) => (
              <motion.div
                key={label}
                ref={(el) => {
                  statCellRefs.current[i] = el;
                }}
                className="flex flex-col items-center justify-center gap-1 px-6 py-8 text-center cursor-default"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px 0px" }}
                transition={{ delay: i * 0.08, duration: 0.4, ease: "easeOut" }}
                onMouseEnter={() => handleStatEnter(i)}
              >
                <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                  {value}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-white/35">
                  {label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24 xl:max-w-6xl">
        <SectionHeading eyebrow="How it works" title="Three steps to get started" />

        <div
          className="grid gap-10 sm:grid-cols-3"
          onMouseLeave={() => setHoveredStep(null)}
        >
          {(
            [
              { step: "01", title: "Browse or Ask", description: "Explore products or ask AI for recommendations. Choose or select multiple models from included tiers, or bring your own key for unlimited access." },
              { step: "02", title: "Vote & Decide", description: "Join live polls where you and llm-models are creating the options, the activity, the mission or the goal, to then have its weight adjusted by the Reach architecture." },
              { step: "03", title: "Track & Ship", description: "Track product orders, inventory statuses, and shipping logistics from one dashboard." },
            ] as const
          ).map(({ step, title, description }, i) => (
            <StepCard
              key={step}
              step={step}
              title={title}
              description={description}
              delay={i * 0.1}
              isHovered={hoveredStep === i}
              isNeighbor={hoveredStep !== null && Math.abs(hoveredStep - i) === 1}
              onMouseEnter={() => setHoveredStep(i)}
            />
          ))}
        </div>
      </div>

      {/* ── Bottom CTA strip ─────────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 dark:border-white/5">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20 xl:max-w-6xl">
          <motion.div
            className="flex flex-col items-center gap-5 text-center"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
              <HoverableHeading text="Start exploring Freedom Store™" />
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-gray-400 dark:text-white/40">
              SaaS, shop, and crypto in one platform — free to start. Subscribe for
              premium AI, or bring your own key for no limits.
            </p>
            <Link
              href="/pricing"
              className="group/plans inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent underline-offset-4 hover:underline"
            >
              <span>See pricing &amp; plans</span>
              <span aria-hidden className="transition-transform duration-300 group-hover/plans:translate-x-0.5">→</span>
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Browse products — primary CTA with animated gradient border */}
              <MagneticButton>
                {/* Animated gradient border */}
                <motion.div
                  className="absolute -inset-[1px] rounded-xl bg-linear-to-r from-sky-500 via-cyan-400 to-sky-500 dark:from-emerald-500 dark:via-cyan-400 dark:to-emerald-500 blur-[2px] group-hover:blur-[3px]"
                  animate={{
                    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  whileHover={{ opacity: 1 }}
                  transition={{
                    backgroundPosition: { duration: 3, repeat: Infinity, ease: "linear" },
                    opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                  }}
                  style={{ backgroundSize: "200% 200%" }}
                />
                {/* Hover glow */}
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute -inset-6 rounded-2xl"
                  animate={{ opacity: [0, 0.06, 0] }}
                  whileHover={{ opacity: 0.2 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  style={{ background: "radial-gradient(closest-side, rgba(14,165,233,0.25), transparent 70%)" }}
                />
                <Link
                  href="/products"
                  className="relative flex items-center gap-2 rounded-xl bg-sky-600 dark:bg-black/80 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-300 group-hover:bg-sky-700 dark:group-hover:bg-black/90 group-hover:text-sky-100 dark:group-hover:text-emerald-300"
                >
                  <span>Browse products</span>
                  <motion.svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                    className="opacity-0 -ml-3 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300"
                  >
                    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                  </motion.svg>
                </Link>
              </MagneticButton>

              {/* Open Pulse — secondary CTA with icon swap */}
              <MagneticButton>
                {/* Subtle idle border pulse */}
                <motion.div
                  className="absolute -inset-[1px] rounded-xl bg-linear-to-r from-gray-400/20 via-gray-400/40 to-gray-400/20 dark:from-white/5 dark:via-white/15 dark:to-white/5 blur-[1px]"
                  animate={{ opacity: [0.2, 0.4, 0.2] }}
                  whileHover={{ opacity: 0.7 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  style={{ backgroundSize: "200% 200%" }}
                />
                <Link
                  href="/pulse"
                  className="relative flex items-center gap-2 rounded-xl border border-gray-300 dark:border-white/20 bg-gray-100/80 dark:bg-white/5 px-5 py-3 text-sm font-medium text-gray-700 dark:text-white/80 backdrop-blur-sm transition-all duration-300 hover:border-gray-400 dark:hover:border-white/40 hover:bg-gray-200/80 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white group-hover:shadow-[0_0_20px_rgba(0,0,0,0.08)] dark:group-hover:shadow-[0_0_20px_rgba(255,255,255,0.08)]"
                >
                  {/* Icon swap: RSS → bolt on hover */}
                  <span className="relative h-4 w-4">
                    <span className="absolute inset-0 opacity-60 transition-all duration-300 group-hover:opacity-0 group-hover:-rotate-12">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" />
                      </svg>
                    </span>
                    <span className="absolute inset-0 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:rotate-12">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 2 3 14h7l-1 8 12-14h-7l1-6z" />
                      </svg>
                    </span>
                  </span>
                  <span>Live Polls</span>
                </Link>
              </MagneticButton>

              {/* Ask AI — tertiary CTA: subtle, magnetic, spark icon swap */}
              <MagneticButton>
                <motion.div
                  className="absolute -inset-[1px] rounded-xl bg-linear-to-r from-violet-400/15 via-violet-400/30 to-violet-400/15 dark:from-violet-500/5 dark:via-violet-400/12 dark:to-violet-500/5 blur-[1px]"
                  animate={{ opacity: [0.15, 0.35, 0.15] }}
                  whileHover={{ opacity: 0.65 }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                />
                <Link
                  href="/ai"
                  className="relative flex items-center gap-2 rounded-xl border border-violet-300/60 dark:border-violet-400/20 bg-violet-50/70 dark:bg-violet-500/5 px-5 py-3 text-sm font-medium text-violet-700 dark:text-violet-300/80 backdrop-blur-sm transition-all duration-300 hover:border-violet-400/80 dark:hover:border-violet-400/40 hover:bg-violet-100/80 dark:hover:bg-violet-500/10 hover:text-violet-900 dark:hover:text-violet-200 group-hover:shadow-[0_0_20px_rgba(139,92,246,0.08)] dark:group-hover:shadow-[0_0_20px_rgba(139,92,246,0.12)]"
                >
                  {/* Icon swap: sparkle → message on hover */}
                  <span className="relative h-4 w-4">
                    <span className="absolute inset-0 opacity-70 transition-all duration-300 group-hover:opacity-0 group-hover:scale-75">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                      </svg>
                    </span>
                    <span className="absolute inset-0 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </span>
                  </span>
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
