"use client";

/**
 * @fileOverview  Live ticker — a slow, seamless marquee of the kinds of things
 *                that happen on Veggat (a listing, a poll closing, a request,
 *                a paper fill, a room). Pure CSS loop (the `marquee` keyframe
 *                in globals.css), pauses on hover, disabled under reduced
 *                motion where it becomes a wrapped list.
 * @stability     evolving
 */

import * as React from "react";
import { FiBarChart2, FiBriefcase, FiCpu, FiKey, FiPackage, FiTrendingUp, FiUsers } from "react-icons/fi";
import { PulseHeart } from "@/components/uicustom/icons/PulseIcons";
import { useHydratedReducedMotion as useReducedMotion } from "@/hooks/use-hydrated-reduced-motion";
import { cn } from "@/lib/utils";

const ITEMS: { icon: React.ReactNode; label: string; detail: string; tone?: "up" | "down" }[] = [
  { icon: <FiPackage />, label: "New listing", detail: "Oak desk organiser · kr 890 · ships from Oslo" },
  { icon: <PulseHeart />, label: "Poll closed", detail: "Black frame wins, 62%" },
  { icon: <FiBriefcase />, label: "Request posted", detail: "Custom motor bracket · 3 offers" },
  { icon: <FiTrendingUp />, label: "ETH / USD", detail: "+2.4% · paper order filled", tone: "up" },
  { icon: <FiCpu />, label: "Room: Launch plan", detail: "3 people + AI · 12 credits" },
  { icon: <FiKey />, label: "Wallet verified", detail: "Reach multiplier ×1.2" },
  { icon: <FiPackage />, label: "Digital delivery", detail: "Studio print · 4K · in My downloads" },
  { icon: <FiUsers />, label: "Company created", detail: "Fjord Woodworks · 2 members" },
  { icon: <FiBarChart2 />, label: "HEX / USD", detail: "−0.8% · stake matured", tone: "down" },
  { icon: <PulseHeart />, label: "Pulse", detail: "128 heartbeats · 1.9k reach" },
];

function Row({ ariaHidden }: { ariaHidden?: boolean }) {
  return (
    <ul aria-hidden={ariaHidden} className="flex shrink-0 items-center gap-3 pr-3">
      {ITEMS.map((item, i) => (
        <li key={`${item.label}-${i}`} className="flex shrink-0 items-center gap-2.5 rounded-full border border-border/60 bg-surface-1/70 py-1.5 pl-2 pr-3.5 text-xs shadow-e1 backdrop-blur-sm">
          <span className={cn("grid size-6 place-items-center rounded-full bg-brand-accent/10 text-brand-accent [&>svg]:size-3.5", item.tone === "down" && "bg-chart-down/10 text-chart-down", item.tone === "up" && "bg-chart-up/10 text-chart-up")}>{item.icon}</span>
          <span className="font-semibold text-foreground">{item.label}</span>
          <span className="text-muted-foreground">{item.detail}</span>
        </li>
      ))}
    </ul>
  );
}

export function LiveTicker({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return (
      <section aria-label="What happens on Veggat" className={cn("mx-auto max-w-5xl px-6 xl:max-w-6xl", className)}>
        <ul className="flex flex-wrap justify-center gap-2">
          {ITEMS.map((item, i) => (
            <li key={`${item.label}-${i}`} className="flex items-center gap-2 rounded-full border border-border/60 bg-surface-1/70 py-1.5 pl-2 pr-3 text-xs">
              <span className="grid size-6 place-items-center rounded-full bg-brand-accent/10 text-brand-accent [&>svg]:size-3.5">{item.icon}</span>
              <span className="font-semibold text-foreground">{item.label}</span>
              <span className="text-muted-foreground">{item.detail}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <section
      aria-label="What happens on Veggat"
      className={cn("group relative w-full overflow-hidden py-2 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]", className)}
    >
      <div className="flex w-max animate-[marquee_60s_linear_infinite] group-hover:[animation-play-state:paused]">
        <Row />
        <Row ariaHidden />
      </div>
    </section>
  );
}

export default LiveTicker;
