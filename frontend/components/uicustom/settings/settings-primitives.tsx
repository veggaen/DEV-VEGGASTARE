"use client";

/**
 * @fileOverview  Settings primitives — the one visual language for every
 *                settings section: a section header, grouped cards, rows with
 *                a control on the right, choice grids and segmented toggles
 *                with the trailing box, status pills and a sticky action bar.
 *                Tokens only, both themes, reduced-motion safe.
 * @stability     evolving
 */

import * as React from "react";
import { motion } from "framer-motion";
import type { IconType } from "react-icons";
import { FiCheck } from "react-icons/fi";
import { HoverChaser } from "@/components/uicustom/chrome/hover-chaser";
import { useHydratedReducedMotion } from "@/hooks/use-hydrated-reduced-motion";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring", stiffness: 380, damping: 32, mass: 0.7 } as const;

/** The raised card surface every settings block sits on. */
export const settingsCard = "rounded-2xl border border-border/60 bg-card/70 shadow-e1 backdrop-blur-xl";

/** Consistent text-field look inside settings forms. */
export const fieldClass =
  "min-h-11 rounded-xl border-border/70 bg-background/60 text-base shadow-none placeholder:text-muted-foreground/70 focus-visible:border-brand-accent/60 focus-visible:ring-2 focus-visible:ring-brand-accent/25 dark:bg-foreground/[0.04] sm:text-sm";

export function SectionHeader({
  title,
  description,
  actions,
  icon: Icon,
  eyebrow,
  id,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: IconType;
  eyebrow?: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent-hover dark:text-brand-accent-light">{eyebrow}</p>}
        <h2 id={id} className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
          {Icon && <Icon aria-hidden="true" className="size-5 shrink-0 text-brand-accent" />}
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SettingsGroup({
  title,
  description,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)} aria-label={typeof title === "string" ? title : undefined}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</h3>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

type CardTone = "default" | "accent" | "danger" | "warning" | "muted";
const cardTone: Record<CardTone, string> = {
  default: settingsCard,
  accent: "rounded-2xl border border-brand-accent/30 bg-brand-accent/[0.06]",
  danger: "rounded-2xl border border-destructive/30 bg-destructive/[0.06]",
  warning: "rounded-2xl border border-amber-500/30 bg-amber-500/[0.08]",
  muted: "rounded-2xl border border-dashed border-border/70 bg-foreground/[0.02]",
};

export function SettingsCard({
  children,
  className,
  tone = "default",
  as: Tag = "div",
  ...rest
}: {
  children?: React.ReactNode;
  className?: string;
  tone?: CardTone;
  as?: "div" | "section" | "article" | "form";
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  const Comp = Tag as unknown as "div";
  return (
    <Comp className={cn(cardTone[tone], "p-4 sm:p-5", className)} {...rest}>
      {children}
    </Comp>
  );
}

/** A card whose children are `SettingsRow`s; the trailing box slides between them. */
export function RowList({ children, className, ...rest }: { children: React.ReactNode; className?: string } & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  return (
    <HoverChaser className={cn(settingsCard, "space-y-0.5 p-1", className)} boxClassName="rounded-xl" {...rest}>
      {children}
    </HoverChaser>
  );
}

export function SettingsRow({
  icon,
  title,
  description,
  children,
  className,
  htmlFor,
  disabled,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** The control (switch, button, value) on the right. */
  children?: React.ReactNode;
  className?: string;
  /** Makes the title a label for a control with this id. */
  htmlFor?: string;
  disabled?: boolean;
}) {
  const Title = htmlFor ? "label" : "p";
  return (
    <div data-chase className={cn("flex min-h-14 items-center gap-3 rounded-xl px-3 py-3", disabled && "opacity-60", className)}>
      {icon && <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-foreground/[0.05] text-muted-foreground [&>svg]:size-4">{icon}</span>}
      <div className="min-w-0 flex-1">
        <Title htmlFor={htmlFor} className="block text-sm font-medium text-foreground">{title}</Title>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

export type Choice<T extends string> = { id: T; label: React.ReactNode; description?: React.ReactNode; icon?: React.ReactNode; hint?: string; disabled?: boolean };
const gridCols: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  6: "grid-cols-3 sm:grid-cols-6",
  7: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7",
};

/** Option cards in a grid; the trailing box follows the pointer, the accent marks the choice. */
export function ChoiceGrid<T extends string>({
  options,
  value,
  onChange,
  columns = 3,
  ariaLabel,
  className,
  disabled,
  size = "md",
}: {
  options: Choice<T>[];
  value: T | null | undefined;
  onChange: (id: T, event: React.MouseEvent<HTMLButtonElement>) => void;
  columns?: 2 | 3 | 4 | 6 | 7;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <HoverChaser role="radiogroup" aria-label={ariaLabel} className={cn("grid gap-2", gridCols[columns], className)} boxClassName="rounded-xl">
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            title={o.hint}
            disabled={disabled || o.disabled}
            onClick={(e) => onChange(o.id, e)}
            data-chase
            className={cn(
              "relative flex flex-col items-start gap-1 rounded-xl border text-left transition-[border-color,background-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              size === "md" ? "min-h-16 px-3 py-3" : "min-h-11 px-3 py-2",
              selected ? "border-brand-accent/60 bg-brand-accent/10" : "border-border/60 bg-card/60",
            )}
          >
            {selected && (
              <span aria-hidden="true" className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-brand-accent text-brand-accent-foreground">
                <FiCheck className="size-3" />
              </span>
            )}
            {o.icon && <span className={cn("mb-0.5 text-xl leading-none [&>svg]:size-5", selected ? "text-brand-accent" : "text-muted-foreground")}>{o.icon}</span>}
            <span className="pr-6 text-sm font-medium text-foreground">{o.label}</span>
            {o.description && <span className="text-xs leading-snug text-muted-foreground">{o.description}</span>}
          </button>
        );
      })}
    </HoverChaser>
  );
}

/** A pill toggle with a sliding highlight; for 2–4 short options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  disabled,
}: {
  options: { id: T; label: React.ReactNode; description?: React.ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}) {
  const id = React.useId();
  const reduceMotion = useHydratedReducedMotion();
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex w-full rounded-xl bg-foreground/[0.05] p-1", className)}>
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={cn(
              "relative flex min-h-9 flex-1 flex-col items-center justify-center rounded-lg px-3 py-1 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {selected && (
              <motion.span
                layoutId={reduceMotion ? undefined : `segmented-${id}`}
                transition={reduceMotion ? { duration: 0 } : SPRING}
                aria-hidden="true"
                className="absolute inset-0 rounded-lg bg-card shadow-e1 ring-1 ring-border/60"
              />
            )}
            <span className="relative">{o.label}</span>
            {o.description && <span className="relative text-[11px] font-normal text-muted-foreground">{o.description}</span>}
          </button>
        );
      })}
    </div>
  );
}

type PillTone = "neutral" | "accent" | "warning" | "danger";
const pillTone: Record<PillTone, string> = {
  neutral: "border-border/60 bg-foreground/[0.05] text-muted-foreground",
  accent: "border-brand-accent/30 bg-brand-accent/10 text-brand-accent-hover dark:text-brand-accent-light",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function StatusPill({ tone = "neutral", children, className }: { tone?: PillTone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", pillTone[tone], className)}>{children}</span>;
}

/** Save/cancel bar that stays in view at the bottom of a long form. */
export function StickyActions({ children, className, ...rest }: { children: React.ReactNode; className?: string } & Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "children">) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-border/60 bg-card/90 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:-mx-6 sm:px-6",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-dashed border-border/70 px-6 py-8 text-center", className)}>
      {icon && <span className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-foreground/[0.05] text-muted-foreground [&>svg]:size-5">{icon}</span>}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Skeleton rows while a section loads; shape-matched to RowList. */
export function RowsSkeleton({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className={cn(settingsCard, "space-y-0.5 p-1")}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex min-h-14 items-center gap-3 px-3 py-3 motion-safe:animate-pulse" style={{ opacity: 1 - i * 0.18 }}>
          <span className="size-9 rounded-lg bg-muted" />
          <span className="flex-1 space-y-2"><span className="block h-3.5 w-40 rounded bg-muted" /><span className="block h-3 w-64 max-w-full rounded bg-muted" /></span>
          <span className="h-6 w-11 rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}
