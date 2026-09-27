"use client";

/**
 * @fileOverview  Atmosphere — the brand star field as a fixed, full-page layer,
 *                dialled per surface so it never competes with content:
 *                - `landing`: the hero intensity (the source of taste);
 *                - `quiet`:   a faint field for calm pages like sign-in.
 *                Honours the "no page animations" preference by rendering
 *                nothing; `HeroParticleField` itself honours reduced motion.
 * @stability     stable
 */

import * as React from "react";
import HeroParticleField from "@/components/uicustom/home/HeroParticleField";
import { useUiPreferencesOptional } from "@/components/providers/ui-preferences";
import { cn } from "@/lib/utils";

export type AtmosphereVariant = "landing" | "quiet";

const VARIANTS: Record<AtmosphereVariant, { density: number; centerFade: number; className: string }> = {
  landing: { density: 0.72, centerFade: 0.18, className: "opacity-70" },
  quiet: { density: 0.26, centerFade: 0.06, className: "opacity-40" },
};

export function Atmosphere({ variant = "quiet", className }: { variant?: AtmosphereVariant; className?: string }) {
  const prefs = useUiPreferencesOptional();
  if (prefs.pageAnimations === "none") return null;
  const cfg = VARIANTS[variant];
  return (
    <HeroParticleField
      fixed
      density={cfg.density}
      centerFade={cfg.centerFade}
      className={cn("z-0", cfg.className, className)}
    />
  );
}

export default Atmosphere;
