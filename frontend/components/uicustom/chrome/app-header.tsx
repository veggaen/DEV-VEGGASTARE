"use client";

/**
 * @fileOverview  AppHeader — the one header every route shares. Brand mark on
 *                the left; on md+ a single glass pill on the right that holds
 *                the navigation chips AND the utilities (currency, alerts,
 *                cart, messages, theme) with the account button attached to
 *                its end as a larger circle — one surface, one hover chaser,
 *                never two competing bars. Below md the pill becomes the
 *                bottom dock and the header keeps only theme + menu.
 *
 *                Chrome layer (blur + hairline) fades in on scroll. Keeps
 *                `data-header-canvas` / `data-nav-key="logo"` for e2e.
 * @stability     evolving
 */

import * as React from "react";
import { BrandMark } from "./brand-mark";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const AppHeader = React.forwardRef<
  HTMLElement,
  {
    /** The glass pill (nav chips + utilities + account), hidden below md. */
    rail?: React.ReactNode;
    /** Compact controls shown only below md (theme toggle …). */
    utilities?: React.ReactNode;
    /** The menu trigger shown only below md. */
    account?: React.ReactNode;
    /** Show the blurred chrome layer (page has scrolled). */
    scrolled?: boolean;
    logoHref?: string;
    className?: string;
  }
>(function AppHeader({ rail, utilities, account, scrolled = false, logoHref = "/", className }, ref) {
  return (
    <header ref={ref} className={cn("sticky top-0 z-60 w-full shrink-0", className)}>
      {/* One tooltip provider for the whole chrome: rail chips and utilities
          share timing, so moving across the header feels like one surface. */}
      <TooltipProvider delayDuration={200} skipDelayDuration={200}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 border-b border-border/70 bg-background/80 backdrop-blur-xl backdrop-saturate-150 transition-opacity duration-300 ease-out motion-reduce:transition-none"
        style={{ opacity: scrolled ? 1 : 0 }}
      />
      <div
        data-header-canvas
        className="relative mx-auto flex h-[var(--app-header)] w-full min-w-0 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8"
      >
        <div className="flex min-w-0 items-center">
          <BrandMark href={logoHref} size="header" data-nav-key="logo" />
        </div>

        <div className="hidden min-w-0 md:block">{rail}</div>

        <div className="flex min-w-0 items-center gap-1.5 md:hidden">
          {utilities}
          {account}
        </div>
      </div>
      </TooltipProvider>
    </header>
  );
});

export default AppHeader;
