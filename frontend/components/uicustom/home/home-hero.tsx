"use client";

/**
 * @fileOverview  Landing hero — the source of taste for the whole app.
 *
 *                One focal point: the BrandMark (Veggat™) with its kinetic
 *                letter hover and ™ spring. Everything else is deliberately
 *                quieter: a tracked eyebrow, one line of subcopy, a primary CTA
 *                with a slow gradient ring + magnetic pull, a glass secondary,
 *                and a ghost tertiary. The Ask AI panel arrives collapsed under
 *                the cluster so it never competes with the title.
 *
 *                The particle field is mounted once by `app/page.tsx`
 *                (`<Atmosphere variant="landing" />`), behind the header and all
 *                sections. Colours are semantic tokens only.
 *
 * @stability     evolving
 */

import * as React from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, type MotionValue } from "framer-motion";
import { FaLock, FaUnlockAlt } from "react-icons/fa";
import { FiArrowRight, FiSettings, FiZap } from "react-icons/fi";
import { useHydratedReducedMotion as useReducedMotion } from "@/hooks/use-hydrated-reduced-motion";
import { useUiPreferences } from "@/components/providers/ui-preferences";
import { Button } from "@/components/ui/button";
import { MyLoginButton } from "@/components/uicustom/auth/buttons/login-button";
import DemoLoginButton from "@/components/uicustom/auth/demo-login-button";
import { BrandMark } from "@/components/uicustom/chrome/brand-mark";
import { PulseHeart } from "@/components/uicustom/icons/PulseIcons";
import { cn } from "@/lib/utils";

/* ── Eyebrow: tracked uppercase line with a per-character hover ripple ─────── */

function KineticEyebrow({ text, className }: { text: string; className?: string }) {
  const reduceMotion = useReducedMotion();
  const { prefs } = useUiPreferences();
  const fancy = prefs.hoverEffects === "colorful";
  const words = React.useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const [hovered, setHovered] = React.useState<{ w: number; c: number } | null>(null);

  return (
    <span
      className={cn("inline-flex flex-wrap items-center justify-center gap-x-[0.5em] cursor-default", className)}
      onPointerLeave={() => setHovered(null)}
    >
      <span className="sr-only">{text}</span>
      {words.map((word, w) => (
        <span key={`${word}-${w}`} aria-hidden="true" className="inline-flex whitespace-nowrap">
          {Array.from(word).map((char, c) => {
            const sameWord = hovered?.w === w;
            const dist = sameWord ? Math.abs(c - (hovered?.c ?? 0)) : Infinity;
            const intensity = reduceMotion ? 0 : dist === 0 ? 1 : dist === 1 ? 0.6 : sameWord ? 0.3 : 0;
            const active = intensity > 0;
            return (
              <span
                key={c}
                className="inline-block origin-bottom"
                style={{
                  color: active ? `hsl(var(--brand-accent) / ${0.6 + 0.4 * intensity})` : undefined,
                  textShadow: active && fancy ? `0 0 ${10 * intensity}px hsl(var(--brand-accent) / ${0.45 * intensity})` : undefined,
                  transform: active ? `scale(${1 + 0.3 * intensity}) translateY(${-2 * intensity}px)` : "scale(1)",
                  transition: "transform 0.16s ease-out, color 0.16s ease-out, text-shadow 0.16s ease-out",
                }}
                onPointerEnter={() => {
                  if (reduceMotion || !window.matchMedia("(hover: hover)").matches) return;
                  setHovered({ w, c });
                }}
              >
                {char}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

/* ── Magnetic wrapper: the element leans toward the cursor and springs back ── */

function useMagnetic(strength = 0.18) {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 320, damping: 22, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 320, damping: 22, mass: 0.6 });
  const handlers = React.useMemo(
    () => ({
      onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
        if (reduceMotion || e.pointerType !== "mouse") return;
        const rect = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - (rect.left + rect.width / 2)) * strength);
        y.set((e.clientY - (rect.top + rect.height / 2)) * strength);
      },
      onPointerLeave: () => {
        x.set(0);
        y.set(0);
      },
    }),
    [reduceMotion, strength, x, y],
  );
  return { style: { x: sx as MotionValue<number>, y: sy as MotionValue<number> }, handlers };
}

/* ── Hero ───────────────────────────────────────────────────────────────────── */

export default function HomeHero({
  isLoggedIn,
  userName,
  children,
}: {
  isLoggedIn: boolean;
  userName?: string | null;
  children?: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const primary = useMagnetic(0.18);
  const secondary = useMagnetic(0.12);

  const firstName = userName?.trim().split(/\s+/)[0];
  const subcopy = isLoggedIn
    ? `Welcome back${firstName ? `, ${firstName}` : ""}. Your products, polls and AI credits are right where you left them.`
    : "Creator-made digital products, live polls and AI in one place. Look around freely — no card, no account needed.";

  const rise = (delay: number) =>
    reduceMotion
      ? { initial: false as const, animate: { opacity: 1, y: 0 } }
      : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const, delay } };

  return (
    <section
      aria-labelledby="hero-title"
      className="relative flex min-h-[calc(100dvh-var(--app-header-offset,72px)-var(--demo-notice-height,0px))] w-full flex-col"
    >
      {/* No edge scrims: on a white canvas a background/50 gradient read as a
          visible band under the header; the star field is quiet enough alone. */}

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-7 px-6 pb-10 pt-8 text-center sm:gap-8 xl:max-w-6xl">
        {/* Eyebrow — the one line above the mark, kept small and tracked */}
        <motion.p {...rise(0.05)} className="m-0">
          <KineticEyebrow
            text="Digital goods. Built on trust."
            className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-accent-hover sm:text-xs dark:text-brand-accent-light/85"
          />
        </motion.p>

        {/* The focal point */}
        <h1 id="hero-title" className="m-0 leading-none">
          <BrandMark size="hero" as="span" entrance className="motion-safe:animate-[kineticCharIn_0.6s_cubic-bezier(0.22,1,0.36,1)_both]" />
        </h1>

        {/* One line of subcopy */}
        <motion.p
          {...rise(0.16)}
          className="mx-auto mt-1 max-w-xl text-pretty text-[15px] leading-relaxed text-muted-foreground transition-colors duration-500 hover:text-foreground/80 sm:text-base"
        >
          {subcopy}
        </motion.p>

        {/* CTA cluster: primary · secondary · tertiary */}
        <motion.div {...rise(0.26)} className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {/* Primary — magnetic, with a slow gradient ring that brightens on hover */}
          <motion.div className="group relative" style={primary.style} {...primary.handlers}>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-px rounded-full bg-[linear-gradient(90deg,hsl(var(--brand-accent)),hsl(var(--brand-accent-alt)),hsl(var(--brand-accent)))] bg-[length:200%_200%] opacity-60 blur-[2px] transition-[opacity,filter] duration-300 motion-safe:animate-[ambientShift_3.5s_linear_infinite] group-hover:opacity-100 group-hover:blur-[3px]"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-[radial-gradient(closest-side,hsl(var(--brand-accent)/0.28),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
            <Button asChild variant="vegaEmeraldBtn" size="touch" className="relative rounded-full px-7 shadow-e2">
              <Link href="/products" className="group/cta">
                <span>Browse products</span>
                <FiArrowRight
                  aria-hidden="true"
                  className="ml-2 size-4 transition-transform duration-300 ease-out motion-safe:group-hover:translate-x-1"
                />
              </Link>
            </Button>
          </motion.div>

          {/* Secondary — glass chip, same DNA as the rail */}
          <motion.div className="group relative" style={secondary.style} {...secondary.handlers}>
            <Link
              href="/pulse"
              className="relative inline-flex min-h-12 items-center gap-2 rounded-full border border-border/80 bg-surface-1/70 px-6 text-[15px] font-medium text-foreground/85 backdrop-blur-xl transition-[color,border-color,background-color,box-shadow,transform] duration-300 ease-out hover:border-brand-accent/50 hover:bg-brand-accent/[0.08] hover:text-foreground hover:shadow-[0_8px_30px_-12px_hsl(var(--brand-accent)/0.5)] motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <PulseHeart className="size-4 text-brand-accent transition-transform duration-300 motion-safe:group-hover:scale-110" />
              <span>Live polls</span>
              <span className="relative ml-0.5 flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-60 motion-safe:animate-ping [animation-duration:2.6s]" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-accent" />
              </span>
            </Link>
          </motion.div>

          {/* Tertiary — ghost */}
          {isLoggedIn ? (
            <Link
              href="/settings"
              className="group inline-flex min-h-12 items-center gap-2 rounded-full border border-transparent px-5 text-[15px] font-medium text-muted-foreground transition-[color,background-color,border-color] duration-300 hover:border-border/80 hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <FiSettings aria-hidden="true" className="size-4 opacity-60 transition-[opacity,transform] duration-500 group-hover:rotate-90 group-hover:opacity-100" />
              <span>Settings</span>
            </Link>
          ) : (
            <MyLoginButton mode="modal" asChild>
              <button
                type="button"
                className="group inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-[15px] font-medium text-muted-foreground transition-[color,background-color] duration-300 hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span className="relative size-4">
                  <FaLock aria-hidden="true" className="absolute inset-0 size-4 opacity-60 transition-[opacity,transform] duration-300 group-hover:-rotate-12 group-hover:opacity-0" />
                  <FaUnlockAlt aria-hidden="true" className="absolute inset-0 size-4 opacity-0 transition-[opacity,transform] duration-300 group-hover:rotate-12 group-hover:opacity-100" />
                </span>
                <span>Sign in</span>
              </button>
            </MyLoginButton>
          )}
        </motion.div>

        {/* Demo entry — quiet, under the cluster, only for visitors */}
        {!isLoggedIn && (
          <motion.div {...rise(0.36)} className="-mt-2">
            <DemoLoginButton />
          </motion.div>
        )}

        {/* AI hint — a single tracked line, no card */}
        {!children && (
          <motion.p {...rise(0.4)} className="m-0 inline-flex items-center gap-2 text-xs text-muted-foreground/80">
            <FiZap aria-hidden="true" className="size-3.5 text-brand-accent" />
            Verified sellers, prepaid AI and live polls. Nothing hidden behind a paywall.
          </motion.p>
        )}
      </div>

      {/* Ask AI — collapsed under the cluster; expands on demand */}
      {children && <div className="relative z-10 w-full shrink-0">{children}</div>}
    </section>
  );
}
