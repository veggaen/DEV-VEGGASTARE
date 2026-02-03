"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

type Accent = "emerald" | "sky" | "fuchsia" | "amber" | "auto";

function hashToIndex(input: string, mod: number) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % Math.max(1, mod);
}

function pickAccent(accent: Accent | undefined, accentKey: string | undefined): Exclude<Accent, "auto"> {
  const normalized = (accent ?? "emerald");
  if (normalized !== "auto") return normalized;
  const key = (accentKey ?? "").trim();
  const choices: Array<Exclude<Accent, "auto">> = ["emerald", "sky", "fuchsia", "amber"];
  return choices[hashToIndex(key || "default", choices.length)] ?? "emerald";
}

export type ProductHeroHeadingProps = {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  price: React.ReactNode;
  /** Left-aligned by default to match product pages. */
  align?: "left" | "center";
  /** Accent controls the aura palette. Use "auto" + accentKey for category-based styling. */
  accent?: Accent;
  accentKey?: string;
  className?: string;
};

export default function ProductHeroHeading({
  kicker,
  title,
  price,
  align = "left",
  accent,
  accentKey,
  className,
}: ProductHeroHeadingProps) {
  const reduceMotion = useReducedMotion();

  const resolvedAccent = pickAccent(accent, accentKey);

  const palette = React.useMemo(() => {
    switch (resolvedAccent) {
      case "sky":
        return {
          blobA: "bg-sky-500/12",
          blobB: "bg-violet-500/10",
          aura: "radial-gradient(closest-side, rgba(56,189,248,0.18), rgba(56,189,248,0) 72%)",
          pulse: "radial-gradient(closest-side, rgba(56,189,248,0.14), rgba(56,189,248,0) 70%)",
        };
      case "fuchsia":
        return {
          blobA: "bg-fuchsia-500/12",
          blobB: "bg-sky-500/8",
          aura: "radial-gradient(closest-side, rgba(217,70,239,0.18), rgba(217,70,239,0) 72%)",
          pulse: "radial-gradient(closest-side, rgba(217,70,239,0.14), rgba(217,70,239,0) 70%)",
        };
      case "amber":
        return {
          blobA: "bg-amber-500/12",
          blobB: "bg-emerald-500/8",
          aura: "radial-gradient(closest-side, rgba(245,158,11,0.18), rgba(245,158,11,0) 72%)",
          pulse: "radial-gradient(closest-side, rgba(245,158,11,0.14), rgba(245,158,11,0) 70%)",
        };
      case "emerald":
      default:
        return {
          blobA: "bg-emerald-500/10",
          blobB: "bg-fuchsia-500/8",
          aura: "radial-gradient(closest-side, rgba(34,197,94,0.16), rgba(34,197,94,0) 72%)",
          pulse: "radial-gradient(closest-side, rgba(34,197,94,0.14), rgba(34,197,94,0) 70%)",
        };
    }
  }, [resolvedAccent]);

  const [glowUntilMs, setGlowUntilMs] = React.useState(0);
  const glowActive = !reduceMotion && Date.now() < glowUntilMs;

  React.useEffect(() => {
    if (!glowActive) return;
    const t = window.setTimeout(() => setGlowUntilMs(0), Math.max(0, glowUntilMs - Date.now()) + 20);
    return () => window.clearTimeout(t);
  }, [glowActive, glowUntilMs]);

  const alignment = align === "center" ? "items-center text-center" : "items-start text-left";

  return (
    <motion.div
      className={`relative w-full ${alignment} ${className ?? ""}`.trim()}
      onPointerEnter={() => {
        if (reduceMotion) return;
        setGlowUntilMs((cur) => Math.max(cur, Date.now() + 9000));
      }}
      onPointerLeave={() => {
        if (reduceMotion) return;
        setGlowUntilMs((cur) => Math.max(cur, Date.now() + 6500));
      }}
    >
      {/* soft lighting behind title+price */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-transparent dark:from-white/[0.06] dark:via-white/[0.03] dark:to-transparent" />
        <motion.div
          className={`absolute -top-12 -right-16 h-[220px] w-[220px] rounded-full blur-3xl ${palette.blobA}`}
          animate={reduceMotion ? undefined : { x: [0, -10, 0], y: [0, 8, 0], opacity: [0.12, 0.2, 0.12] }}
          transition={reduceMotion ? undefined : { duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className={`absolute -bottom-16 -left-16 h-[260px] w-[260px] rounded-full blur-3xl ${palette.blobB}`}
          animate={reduceMotion ? undefined : { x: [0, 12, 0], y: [0, -8, 0], opacity: [0.1, 0.18, 0.1] }}
          transition={reduceMotion ? undefined : { duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* aura field that lingers on hover */}
        <motion.div
          aria-hidden
          className="absolute -inset-6 rounded-3xl"
          animate={
            glowActive
              ? { opacity: [0.12, 0.26, 0.16], scale: [1, 1.03, 1] }
              : { opacity: 0, scale: 1 }
          }
          transition={glowActive ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.25 }}
          style={{
            background: palette.aura,
            mixBlendMode: "screen",
          }}
        />
      </div>

      <motion.div
        className={`relative flex w-full flex-col gap-2 rounded-2xl border border-black/5 bg-white/40 p-4 dark:border-white/10 dark:bg-white/[0.04] ${alignment}`}
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={reduceMotion ? undefined : { duration: 0.35, ease: "easeOut" }}
      >
        {kicker ? (
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-700 dark:text-zinc-200">
            {kicker}
          </div>
        ) : null}

        <div className="relative">
          {/* one-time subtle pulse after mount */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-3 rounded-2xl"
            initial={false}
            animate={
              reduceMotion
                ? { opacity: 0 }
                : {
                    opacity: [0, 0.18, 0],
                  }
            }
            transition={reduceMotion ? undefined : { delay: 0.9, duration: 1.05, ease: "easeInOut" }}
            style={{
              background: palette.pulse,
              mixBlendMode: "screen",
            }}
          />

          {title}
        </div>

        <motion.div
          className="relative"
          animate={
            glowActive
              ? {
                  filter: "drop-shadow(0 0 18px rgba(34,197,94,0.10))",
                }
              : { filter: "none" }
          }
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {price}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
