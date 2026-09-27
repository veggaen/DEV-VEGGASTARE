"use client";

/**
 * @fileOverview  HeaderTip — the one tooltip style for everything in the app
 *                chrome (rail chips, currency, alerts, cart, messages, theme,
 *                account). Radix tooltip, bottom side, small pill; never the
 *                browser's native `title` popup, which ignores the theme.
 * @stability     stable
 */

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function HeaderTip({
  label,
  children,
  className,
  side = "bottom",
}: {
  label: React.ReactNode;
  children: React.ReactElement;
  /** Extra classes for the content, e.g. `lg:hidden` when the label is visible anyway. */
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={6}
        className={cn("rounded-full border-border/60 px-3 py-1.5 text-[11px] font-medium", className)}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export default HeaderTip;
