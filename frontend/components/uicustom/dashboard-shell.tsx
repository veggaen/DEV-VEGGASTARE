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
        return { paddingLeft: offset, transition: "padding-left 0.3s cubic-bezier(0.4,0,0.2,1)" };
      case "right":
        return { paddingRight: offset, transition: "padding-right 0.3s cubic-bezier(0.4,0,0.2,1)" };
      case "top":
        return { paddingTop: offset };
      case "bottom":
        return { paddingBottom: offset };
    }
  }, [position, isExpanded]);

  return (
    <section
      className="relative w-full min-h-[calc(100dvh-var(--app-header,72px))]"
      style={contentStyle}
    >
      {children}
      <MyMenuSide />
    </section>
  );
}
