"use client";

/**
 * @fileOverview  ThemeToggle — the header's light/dark switch. Sun ↔ moon morph,
 *                token surfaces, and the app's calm colour cross-fade: it flags
 *                `<html>` with `.theme-transitioning` for ~500ms so globals.css
 *                lets colours ease instead of hard-cutting (never permanently).
 *                Theme state lives ONLY on <html> (next-themes `.dark`).
 * @stability     stable
 */

import * as React from "react";
import { useTheme } from "next-themes";
import { FiSun } from "react-icons/fi";
import { IoMoonOutline } from "react-icons/io5";
import { useClientReady } from "@/hooks/use-client-ready";
import { cn } from "@/lib/utils";

let crossfadeTimer: number | undefined;

/** Briefly opt the whole document into a colour cross-fade (see globals.css). */
export function runThemeCrossfade() {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const root = document.documentElement;
  root.classList.add("theme-transitioning");
  window.clearTimeout(crossfadeTimer);
  crossfadeTimer = window.setTimeout(() => root.classList.remove("theme-transitioning"), 520);
}

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const ready = useClientReady();

  const toggle = () => {
    const effective = (resolvedTheme ?? theme) as string | undefined;
    runThemeCrossfade();
    setTheme(effective === "dark" ? "light" : "dark");
  };

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      title="Toggle theme"
      disabled={!ready}
      onClick={toggle}
      className={cn(
        "group relative inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-surface-1/75 text-muted-foreground backdrop-blur-xl",
        "transition-[color,background-color,border-color,transform,box-shadow] duration-200 ease-out motion-reduce:transition-none",
        "hover:border-border hover:bg-surface-3 hover:text-foreground hover:shadow-e1 motion-safe:hover:-translate-y-px motion-safe:active:scale-95",
        "disabled:pointer-events-none disabled:opacity-60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
  );
}

export default ThemeToggle;
