/**
 * @fileOverview  Dashboard shell — the dock is now a fixed floating overlay
 *                (Win11-style taskbar). This shell just adds padding so content
 *                doesn't hide behind the dock, and renders <MyMenuSide /> once.
 * @stability     evolving
 */

"use client";

import { useMemo } from "react";
import { useDashboardDock } from "@/contexts/dashboard-dock-context";
import {
  MyMenuSide,
  FLOATING_GAP,
  COLLAPSED_SIZE,
  EXPANDED_V_WIDTH,
  DOCK_H_APPROX,
} from "@/components/uicustom/sidemenumainauth";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { position, isExpanded } = useDashboardDock();

  /* Padding keeps content from hiding behind the floating dock */
  const contentStyle = useMemo((): React.CSSProperties => {
    const isVertical = position === "left" || position === "right";
    const size = isVertical
      ? (isExpanded ? EXPANDED_V_WIDTH : COLLAPSED_SIZE)
      : DOCK_H_APPROX;
    const offset = size + FLOATING_GAP + 8; // dock + gap + small buffer

    switch (position) {
      case "left":
        return { '--dashboard-left': `${offset}px` } as React.CSSProperties;
      case "right":
        return { '--dashboard-right': `${offset}px` } as React.CSSProperties;
      case "top":
        return { '--dashboard-top': `${offset}px` } as React.CSSProperties;
      case "bottom":
        return { '--dashboard-bottom': `${offset}px` } as React.CSSProperties;
    }
  }, [position, isExpanded]);

  return (
    <section
      className="relative w-full min-w-0 min-h-[calc(100dvh-var(--app-header-offset,72px)-var(--demo-notice-height,0px))] lg:pl-[var(--dashboard-left,0px)] lg:pr-[var(--dashboard-right,0px)] lg:pt-[var(--dashboard-top,0px)] lg:pb-[var(--dashboard-bottom,0px)]"
      style={contentStyle}
    >
      {children}
      <div className="hidden lg:block"><MyMenuSide /></div>
    </section>
  );
}
