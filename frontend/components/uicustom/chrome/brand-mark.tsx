"use client";

/**
 * @fileOverview  BrandMark — the "Veggat™" wordmark shared by the app header and
 *                the landing hero. One implementation, two sizes:
 *
 *                - idle: quiet. Foreground ink, a small ™ whose T and M swap
 *                  between the two brand tints in counter-phase (pure CSS, see
 *                  `.brand-tm-letter` in globals.css).
 *                - pointer: the landing's kinetic letter hover — the hovered
 *                  letter lifts and glows, neighbours ripple, and every OTHER
 *                  copy of the same letter resonates in the second tint. The ™
 *                  springs up, and hovering T or M individually tilts it.
 *
 *                Colours are semantic tokens only (`--brand-accent`,
 *                `--brand-accent-alt`, `--foreground`), so the mark is correct in
 *                both themes without a single `dark:` pair. Reduced motion → a
 *                static wordmark, still readable, still branded.
 *
 * @stability     evolving
 */

import * as React from "react";
import { motion } from "framer-motion";
import Link from "@/components/ui/navigation-link";
import { useHydratedReducedMotion } from "@/hooks/use-hydrated-reduced-motion";
import { useUiPreferencesOptional } from "@/components/providers/ui-preferences";
import { cn } from "@/lib/utils";

export const BRAND_NAME = "Veggat";

export type BrandMarkSize = "header" | "hero";

type TmPhase = "t" | "m";

const SIZE: Record<
  BrandMarkSize,
  {
    text: string;
    tm: React.CSSProperties;
    jump: { y: number; scale: number; rotate: number };
    lift: number;
    glow: number;
  }
> = {
  header: {
    text: "text-[1.15rem] font-semibold tracking-tight sm:text-xl",
    tm: { fontSize: "0.5em", top: "-0.5em", left: "0.06em" },
    jump: { y: -4, scale: 1.26, rotate: -6 },
    lift: 1,
    glow: 8,
  },
  hero: {
    text: "text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl 2xl:text-8xl",
    tm: { fontSize: "0.44em", top: "-0.62em", left: "0.10em" },
    jump: { y: -11, scale: 1.38, rotate: -6 },
    lift: 2,
    glow: 12,
  },
};

const SPRING_JUMP = { type: "spring", stiffness: 520, damping: 18, mass: 0.6 } as const;
const SPRING_LETTER = { type: "spring", stiffness: 760, damping: 16, mass: 0.6 } as const;

function canHover() {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;
}

/* ── Letters ────────────────────────────────────────────────────────────────── */

function Letters({
  text,
  lift,
  glow,
  reduceMotion,
  externalIdx,
  onHoverChange,
}: {
  text: string;
  lift: number;
  glow: number;
  reduceMotion: boolean;
  externalIdx?: number | null;
  onHoverChange?: (hovering: boolean) => void;
}) {
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);

  // Pointer takes priority; an external driver (e.g. an orbiting element on the
  // landing page) is secondary and only lights the letter it actually touches.
  const effectiveIdx = reduceMotion ? null : (hoveredIdx ?? externalIdx ?? null);
  const externalOnly = hoveredIdx === null && externalIdx != null;
  const hoveredChar = effectiveIdx !== null ? text[effectiveIdx]?.toLowerCase() : null;

  const leave = React.useCallback(() => {
    setHoveredIdx(null);
    onHoverChange?.(false);
  }, [onHoverChange]);

  return (
    <span aria-hidden="true" className="inline-flex" onPointerLeave={leave}>
      {Array.from(text).map((char, i) => {
        const dist = effectiveIdx !== null ? Math.abs(i - effectiveIdx) : Infinity;
        let intensity = externalOnly
          ? dist === 0 ? 0.9 : 0
          : dist === 0 ? 1 : dist === 1 ? 0.55 : dist === 2 ? 0.22 : 0;

        // Same-letter resonance: every other copy of the hovered letter answers
        // in the second brand tint.
        const resonance = !externalOnly && hoveredChar !== null && dist > 2 && char.toLowerCase() === hoveredChar;
        if (resonance) intensity = 0.7;

        const active = intensity > 0;
        const tint = resonance ? "var(--brand-accent-alt)" : "var(--brand-mark-tint)";
        const color = `hsl(${tint} / ${(resonance ? 0.55 : 0.5) + 0.5 * intensity})`;
        const shadow = `0 0 ${Math.round(glow * intensity)}px hsl(${tint} / ${0.35 * intensity})`;

        return (
          <span
            key={i}
            className="inline-block origin-bottom"
            style={{
              color: active ? color : undefined,
              textShadow: active ? shadow : "none",
              transform: active
                ? `scale(${1 + (resonance ? 0.12 : 0.08) * intensity}) translateY(${-(resonance ? lift + 1 : lift) * intensity}px)`
                : "scale(1) translateY(0)",
              transition: "color 0.12s ease-out, text-shadow 0.12s ease-out, transform 0.12s ease-out",
            }}
            onPointerEnter={() => {
              if (reduceMotion || !canHover()) return;
              setHoveredIdx(i);
              onHoverChange?.(true);
            }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}

/* ── ™ ──────────────────────────────────────────────────────────────────────── */

function TmLetter({
  phase,
  active,
  hovered,
  onHover,
  fancy,
  entrance,
  entranceDelay,
  reduceMotion,
}: {
  phase: TmPhase;
  active: boolean;
  hovered: TmPhase | null;
  onHover: (phase: TmPhase | null) => void;
  fancy: boolean;
  entrance: boolean;
  entranceDelay: number;
  reduceMotion: boolean;
}) {
  const isHovered = hovered === phase;
  const letter = phase === "t" ? "T" : "M";

  // While this letter is hovered with colourful effects on, take over from the
  // idle CSS colour swap (a running/paused animation would otherwise win over
  // an inline colour) and glow in the accent → alt gradient.
  const style: React.CSSProperties | undefined = isHovered && fancy
    ? {
        animation: "none",
        color: "hsl(var(--foreground))",
        textShadow: `0 0 8px hsl(var(--brand-accent) / 0.55), 0 0 16px hsl(var(--brand-accent-alt) / 0.45), 0 0 26px hsl(var(--brand-accent) / 0.25)`,
        filter: "drop-shadow(0 0 10px hsl(var(--brand-accent) / 0.25))",
      }
    : undefined;

  return (
    <motion.span
      className="brand-tm-letter inline-block cursor-pointer"
      data-phase={phase}
      initial={entrance && !reduceMotion ? { opacity: 0, y: -18, scale: 0.7 } : false}
      animate={{
        opacity: 1,
        y: 0,
        scale: isHovered ? (active ? 1.34 : 1.24) : active ? 1.12 : 1,
        rotate: isHovered ? (phase === "t" ? -10 : 10) : 0,
      }}
      transition={reduceMotion ? { duration: 0 } : { ...SPRING_LETTER, delay: entrance ? entranceDelay : 0 }}
      onPointerEnter={() => onHover(phase)}
      onPointerLeave={() => onHover(null)}
      style={style}
    >
      {letter}
    </motion.span>
  );
}

/* ── BrandMark ──────────────────────────────────────────────────────────────── */

export type BrandMarkProps = {
  /** Visual scale. `hero` is the landing focal point; `header` is the chrome logo. */
  size?: BrandMarkSize;
  /** Render as a link (the header logo). Omit for a plain mark (the hero h1). */
  href?: string;
  /** Wrapper element when not a link. */
  as?: "h1" | "span" | "div";
  className?: string;
  /** Play the ™'s bouncy T-then-M entrance once (landing only). */
  entrance?: boolean;
  /** External hover drivers, e.g. an orbiting element crossing the mark. */
  externalLetterIdx?: number | null;
  externalTmHover?: "T" | "M" | null;
  onHoverChange?: (hovering: boolean) => void;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">;

export function BrandMark({
  size = "header",
  href,
  as = "span",
  className,
  entrance = false,
  externalLetterIdx = null,
  externalTmHover = null,
  onHoverChange,
  ...rest
}: BrandMarkProps) {
  const reduceMotion = useHydratedReducedMotion();
  const prefs = useUiPreferencesOptional();
  const fancy = prefs.hoverEffects === "colorful";
  const cfg = SIZE[size];

  const [areaHover, setAreaHover] = React.useState(false);
  const [lettersHover, setLettersHover] = React.useState(false);
  const [tmHover, setTmHover] = React.useState<TmPhase | null>(null);

  const externalTm: TmPhase | null = externalTmHover === "T" ? "t" : externalTmHover === "M" ? "m" : null;
  const tmActive =
    !reduceMotion && (areaHover || lettersHover || tmHover !== null || externalTm !== null || externalLetterIdx != null);
  const tmHovered = tmHover ?? externalTm;

  const handleLettersHover = React.useCallback(
    (hovering: boolean) => {
      setLettersHover(hovering);
      onHoverChange?.(hovering);
    },
    [onHoverChange],
  );

  const mark = (
    <span className="inline-flex items-baseline">
      <span className="sr-only">{BRAND_NAME}</span>
      <Letters
        text={BRAND_NAME}
        lift={cfg.lift}
        glow={cfg.glow}
        reduceMotion={reduceMotion}
        externalIdx={externalLetterIdx}
        onHoverChange={handleLettersHover}
      />
      <motion.span
        aria-hidden="true"
        className="relative z-20 ml-1 inline-flex whitespace-nowrap leading-none tracking-tight"
        style={{ position: "relative", ...cfg.tm }}
        initial={false}
        animate={tmActive ? cfg.jump : { y: 0, scale: 1, rotate: 0 }}
        transition={reduceMotion ? { duration: 0 } : SPRING_JUMP}
      >
        {fancy && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-4 -z-10 rounded-full blur-lg"
            initial={false}
            animate={tmActive ? { opacity: 0.42, scale: 1 } : { opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{
              background:
                "radial-gradient(closest-side, hsl(var(--brand-accent) / 0.42), hsl(var(--brand-accent-alt) / 0.26), transparent 72%)",
            }}
          />
        )}
        <TmLetter
          phase="t"
          active={tmActive}
          hovered={tmHovered}
          onHover={setTmHover}
          fancy={fancy}
          entrance={entrance}
          entranceDelay={0.02}
          reduceMotion={reduceMotion}
        />
        <TmLetter
          phase="m"
          active={tmActive}
          hovered={tmHovered}
          onHover={setTmHover}
          fancy={fancy}
          entrance={entrance}
          entranceDelay={0.32}
          reduceMotion={reduceMotion}
        />
      </motion.span>
    </span>
  );

  const shared = {
    "data-brand-mark": size,
    "data-active": tmActive ? "true" : undefined,
    className: cn(
      "relative inline-flex select-none items-center whitespace-nowrap text-foreground",
      cfg.text,
      size === "hero" && "[text-shadow:0_2px_24px_hsl(var(--brand-accent)/0.14)] dark:[text-shadow:none]",
      className,
    ),
    onPointerEnter: () => {
      if (reduceMotion || !canHover()) return;
      setAreaHover(true);
    },
    onPointerLeave: () => setAreaHover(false),
  } as const;

  if (href) {
    return (
      <Link
        href={href}
        {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        {...shared}
        className={cn(
          shared.className,
          "-mx-1 min-h-11 rounded-lg px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {mark}
      </Link>
    );
  }

  const Tag = as;
  return (
    <Tag {...rest} {...shared}>
      {mark}
    </Tag>
  );
}

export default BrandMark;
