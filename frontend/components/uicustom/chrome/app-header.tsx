"use client";

/**
 * @fileOverview  AppHeader — the one header every route shares. Three columns so
 *                the floating AppRail is always dead-centre regardless of how
 *                many utilities sit on the right: BrandMark · rail · utilities.
 *
 *                The chrome (blurred background + hairline) is a separate layer
 *                that fades in once the page scrolls, so on the landing page the
 *                star field shows straight through until you move.
 *
 *                `data-header-canvas` / `data-nav-key="logo"` are measured by the
 *                e2e suite (canvas ≤ 1280px, logo ≥ 44px tall, logo x aligned with
 *                page content) — keep the max-width + gutters in sync with pages.
 *
 * @stability     evolving
 */

import * as React from "react";
import { BrandMark } from "./brand-mark";
import { cn } from "@/lib/utils";

export const AppHeader = React.forwardRef<
  HTMLElement,
  {
    /** The floating chip rail (hidden below md; the mobile dock takes over). */
    rail?: React.ReactNode;
    /** Currency, theme, alerts, cart, chat… */
    utilities?: React.ReactNode;
    /** The account / menu trigger, rendered last. */
    account?: React.ReactNode;
    /** Show the blurred chrome layer (page has scrolled). */
    scrolled?: boolean;
    logoHref?: string;
    className?: string;
  }
>(function AppHeader({ rail, utilities, account, scrolled = false, logoHref = "/", className }, ref) {
  return (
    <header ref={ref} className={cn("sticky top-0 z-60 w-full shrink-0", className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 border-b border-border/70 bg-background/80 backdrop-blur-xl backdrop-saturate-150 transition-opacity duration-300 ease-out motion-reduce:transition-none"
        style={{ opacity: scrolled ? 1 : 0 }}
      />
      <div
        data-header-canvas
        className="relative mx-auto grid h-[var(--app-header)] w-full min-w-0 max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 sm:px-6 lg:px-8"
      >
        <div className="flex min-w-0 items-center justify-self-start">
          <BrandMark href={logoHref} size="header" data-nav-key="logo" />
        </div>

        <div className="hidden min-w-0 justify-self-center md:block">{rail}</div>

        <div className="flex min-w-0 items-center justify-end gap-1.5 justify-self-end sm:gap-2">
          {utilities}
          {account}
        </div>
      </div>
    </header>
  );
});

export default AppHeader;
