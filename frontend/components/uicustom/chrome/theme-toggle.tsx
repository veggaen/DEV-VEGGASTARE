"use client";

/**
 * @fileOverview  ThemeToggle — the header's light/dark switch.
 *
 *                Motion: on browsers with the View Transitions API the new
 *                theme is revealed with a circular wipe that grows from the
 *                button itself (`html.theme-vt::view-transition-new(root)` in
 *                globals.css). Both frames are real snapshots, so nothing goes
 *                through a muddy mid-gray and canvases/particles are included.
 *                Older browsers fall back to the calm 320ms colour cross-fade
 *                (`.theme-transitioning`). Reduced motion: instant swap.
 *
 *                Theme state lives ONLY on <html> (next-themes `.dark`).
 * @stability     stable
 */

import * as React from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { FiSun } from "react-icons/fi";
import { IoMoonOutline } from "react-icons/io5";
import { useClientReady } from "@/hooks/use-client-ready";
import { HeaderTip } from "./header-tip";
import { cn } from "@/lib/utils";

let crossfadeTimer: number | undefined;

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => { finished: Promise<void>; ready: Promise<void> };
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Briefly opt the whole document into a colour cross-fade (see globals.css). */
export function runThemeCrossfade() {
  if (typeof window === "undefined" || prefersReducedMotion()) return;
  const root = document.documentElement;
  root.classList.add("theme-transitioning");
  window.clearTimeout(crossfadeTimer);
  crossfadeTimer = window.setTimeout(() => root.classList.remove("theme-transitioning"), 520);
}

/**
 * Swap the theme with a circular reveal anchored at `origin` (viewport px).
 * Falls back to the cross-fade when View Transitions are unavailable.
 */
export function swapThemeWithReveal(
  apply: () => void,
  origin?: { x: number; y: number },
) {
  if (typeof document === "undefined") return apply();
  const doc = document as ViewTransitionDocument;
  const root = document.documentElement;
  if (prefersReducedMotion() || typeof doc.startViewTransition !== "function") {
    if (!prefersReducedMotion()) runThemeCrossfade();
    return apply();
  }
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? 0;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  root.style.setProperty("--vt-x", `${x}px`);
  root.style.setProperty("--vt-y", `${y}px`);
  root.style.setProperty("--vt-r", `${Math.ceil(radius)}px`);
  root.classList.add("theme-vt");
  const transition = doc.startViewTransition(() => {
    flushSync(apply);
  });
  transition.finished.finally(() => root.classList.remove("theme-vt"));
}

export function ThemeToggle({ className, variant = "default" }: { className?: string; /** "chip": borderless, for inside the header pill */ variant?: "default" | "chip" }) {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const ready = useClientReady();

  const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    const effective = (resolvedTheme ?? theme) as string | undefined;
    const next = effective === "dark" ? "light" : "dark";
    const rect = event.currentTarget.getBoundingClientRect();
    swapThemeWithReveal(() => setTheme(next), { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  };

  const effective = (resolvedTheme ?? theme) as string | undefined;
  return (
    <HeaderTip label={ready && effective === "dark" ? "Switch to light" : ready ? "Switch to dark" : "Theme"}>
    <button
      type="button"
      aria-label="Toggle theme"
      disabled={!ready}
      onClick={toggle}
      className={cn(
        variant === "chip"
          ? "group relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[color,transform] duration-200 ease-out hover:text-foreground motion-safe:active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          : "group relative inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-surface-1/75 text-muted-foreground backdrop-blur-xl transition-[color,background-color,border-color,transform,box-shadow] duration-200 ease-out motion-reduce:transition-none hover:border-border hover:bg-surface-3 hover:text-foreground hover:shadow-e1 motion-safe:hover:-translate-y-px motion-safe:active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
    >
      <FiSun
        aria-hidden="true"
        className="size-[18px] rotate-0 scale-100 transition-transform duration-300 ease-out motion-reduce:transition-none dark:-rotate-90 dark:scale-0"
      />
      <IoMoonOutline
        aria-hidden="true"
        className="absolute size-[18px] rotate-90 scale-0 transition-transform duration-300 ease-out motion-reduce:transition-none dark:rotate-0 dark:scale-100"
      />
    </button>
    </HeaderTip>
  );
}

export default ThemeToggle;
