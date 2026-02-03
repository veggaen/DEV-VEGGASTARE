"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useUiPreferences } from "@/components/providers/ui-preferences";

interface FancySphereProps {
  position: "top-right" | "bottom-left" | "top-left" | "bottom-right" | "center";
  size?: "sm" | "md" | "lg" | "xl";
  color?: "blue" | "purple" | "pink" | "emerald" | "cyan" | "indigo";
  delay?: number;
  /** Override: force disable regardless of preferences */
  forceDisable?: boolean;
}

const sizeMap = {
  sm: "h-[280px] w-[280px]",
  md: "h-[380px] w-[380px]",
  lg: "h-[480px] w-[480px]",
  xl: "h-[560px] w-[560px]",
};

const positionMap = {
  "top-right": "-right-20 top-32",
  "bottom-left": "-left-24 bottom-20",
  "top-left": "-left-20 top-20",
  "bottom-right": "-right-20 bottom-20",
  center: "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
};

const colorMap = {
  blue: "rgba(59,130,246,0.1), rgba(99,102,241,0.06)",
  purple: "rgba(139,92,246,0.1), rgba(168,85,247,0.06)",
  pink: "rgba(236,72,153,0.1), rgba(244,114,182,0.06)",
  emerald: "rgba(16,185,129,0.1), rgba(52,211,153,0.06)",
  cyan: "rgba(6,182,212,0.1), rgba(34,211,238,0.06)",
  indigo: "rgba(99,102,241,0.1), rgba(129,140,248,0.06)",
};

/** Animated gradient sphere - only renders when enableGradientSpheres is true AND user is authenticated */
export function FancySphere({
  position,
  size = "lg",
  color = "blue",
  delay = 0,
  forceDisable = false,
}: FancySphereProps) {
  const { prefs } = useUiPreferences();
  const reduceMotion = useReducedMotion();

  // Force disable takes priority
  if (forceDisable || !prefs.enableGradientSpheres) {
    return null;
  }

  const shouldAnimate = prefs.pageAnimations !== "none" && !reduceMotion;

  return (
    <motion.div
      className={`absolute ${positionMap[position]} ${sizeMap[size]} rounded-full blur-3xl`}
      initial={shouldAnimate ? { opacity: 0 } : undefined}
      animate={
        shouldAnimate
          ? {
              x: [0, -10, 0],
              y: [0, 8, 0],
              opacity: [0.06, 0.12, 0.06],
            }
          : { opacity: 0.08 }
      }
      transition={{
        duration: 14,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
      style={{
        background: `radial-gradient(closest-side, ${colorMap[color]}, transparent 70%)`,
        mixBlendMode: "screen",
      }}
    />
  );
}

interface FancyGradientProps {
  variant?: "default" | "subtle" | "vibrant";
  className?: string;
}

/** Gradient overlay - only renders when enableGradientBackgrounds is true */
export function FancyGradient({
  variant = "default",
  className = "",
}: FancyGradientProps) {
  const { prefs } = useUiPreferences();

  if (!prefs.enableGradientBackgrounds) {
    return null;
  }

  const gradientStyles = {
    default:
      "bg-gradient-to-b from-background via-background/70 to-sky-950/10 dark:from-black/15 dark:via-transparent dark:to-black/5",
    subtle:
      "bg-gradient-to-b from-transparent via-background/30 to-background/50",
    vibrant:
      "bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5",
  };

  return (
    <div
      className={`absolute inset-0 ${gradientStyles[variant]} ${className}`}
    />
  );
}

interface FancyBackgroundProps {
  /** Show gradient overlay */
  gradient?: boolean;
  gradientVariant?: "default" | "subtle" | "vibrant";
  /** Spheres to display */
  spheres?: FancySphereProps[];
  /** Additional CSS classes for the container */
  className?: string;
}

/**
 * FancyBackground - A conditional background component
 * Only renders fancy effects when user preferences are enabled
 */
export function FancyBackground({
  gradient = true,
  gradientVariant = "default",
  spheres = [{ position: "top-right", color: "blue" }],
  className = "",
}: FancyBackgroundProps) {
  const { prefs } = useUiPreferences();

  // If no fancy effects enabled, render nothing
  if (!prefs.enableGradientBackgrounds && !prefs.enableGradientSpheres) {
    return null;
  }

  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`}>
      {gradient && <FancyGradient variant={gradientVariant} />}
      {spheres.map((sphere, index) => (
        <FancySphere key={`sphere-${index}`} {...sphere} />
      ))}
    </div>
  );
}

export default FancyBackground;
