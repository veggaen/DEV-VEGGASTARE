/**
 * @fileOverview  PageHeader / PageShell — the inner-page counterpart of the
 *                landing hero. Every route below the chrome opens the same way:
 *                a tracked eyebrow, a tight title, one line of description and
 *                an optional action cluster on the right. Server-safe (no
 *                hooks), tokens only, entrance handled by CSS (`.page-rise`).
 *
 *                PageShell = the bounded canvas (max-w-7xl + gutters) that the
 *                AppHeader canvas is measured against, so titles align with the
 *                logo on every breakpoint.
 *
 * @stability     evolving
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export function PageShell({
  children,
  className,
  width = "wide",
  as: Tag = "div",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  /** `wide` = app canvas (max-w-7xl); `prose` = long-form reading width. */
  width?: "wide" | "prose" | "narrow";
  as?: "div" | "section" | "article";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={cn(
        "mx-auto w-full min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-8",
        width === "wide" && "max-w-7xl",
        width === "prose" && "max-w-4xl",
        width === "narrow" && "max-w-2xl",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function PageHeader({
  eyebrow,
  title,
  titleId,
  description,
  actions,
  back,
  align = "start",
  size = "md",
  className,
  children,
}: {
  /** Small tracked line above the title ("Marketplace", "Account"). */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** id for aria-labelledby on the enclosing section. */
  titleId?: string;
  description?: React.ReactNode;
  /** Buttons / links rendered on the right (wrap under the title on phones). */
  actions?: React.ReactNode;
  /** A quiet back link rendered above the eyebrow. */
  back?: React.ReactNode;
  align?: "start" | "center";
  size?: "md" | "lg";
  className?: string;
  /** Extra content under the header (tabs, filters, stats). */
  children?: React.ReactNode;
}) {
  return (
    <header
      className={cn(
        "page-rise relative border-b border-border/70 pb-5 sm:pb-6",
        align === "center" && "text-center",
        className,
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-col gap-4",
          align === "start" && "sm:flex-row sm:items-end sm:justify-between",
          align === "center" && "items-center",
        )}
      >
        <div className={cn("min-w-0 max-w-3xl space-y-2", align === "center" && "mx-auto")}>
          {back && <div className="mb-1">{back}</div>}
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-accent-hover dark:text-brand-accent-light">
              {eyebrow}
            </p>
          )}
          <h1
            id={titleId}
            className={cn(
              "text-balance font-semibold tracking-tight text-foreground",
              size === "md" && "text-2xl sm:text-3xl",
              size === "lg" && "text-3xl sm:text-4xl lg:text-5xl",
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className={cn("flex shrink-0 flex-wrap items-center gap-2", align === "center" && "justify-center")}>
            {actions}
          </div>
        )}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </header>
  );
}

export default PageHeader;
