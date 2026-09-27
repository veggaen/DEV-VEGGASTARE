"use client";

/**
 * @fileOverview  AppRail — the floating chip navigation used everywhere.
 *
 *                A glass pill of chips with two motion layers behind the labels:
 *                - the ACTIVE box: one persistent element that springs from the
 *                  previous route's chip to the new one on navigation, with a
 *                  touch of overshoot so it reads as "trailing" the click;
 *                - the HOVER chaser: a quieter box that parks (invisibly) on the
 *                  active chip and slides out to whichever chip the pointer or
 *                  keyboard focus is on, then slides back home on leave.
 *
 *                Both boxes are positioned from measured chip geometry (offset
 *                left/width inside the pill) rather than framer `layoutId`
 *                mount/unmount pairs — a single element that only ever moves
 *                never squashes mid-flight and survives label changes at the
 *                lg breakpoint (a ResizeObserver re-measures).
 *
 *                Two variants share the same chips: `header` (centred in the app
 *                header on md+) and `dock` (a fixed, thumb-reachable bar at the
 *                bottom of small screens that replaces the old sidebar).
 *
 *                Tokens only: surface/border/foreground/brand-accent. No zinc.
 *
 * @stability     evolving
 */

import * as React from "react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
// Plain next/link: the shared NavigationLink renders a `fixed` top progress bar
// that would be trapped inside a transformed/blurred chip. The rail shows its
// own per-chip pending state (`ChipPending`) instead.
import Link, { useLinkStatus } from "next/link";
import { useHydratedReducedMotion } from "@/hooks/use-hydrated-reduced-motion";
import { isActiveNavigationPath, type PrimaryNavItem } from "@/components/uicustom/site-navigation";
import { HeaderTip } from "./header-tip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type RailItem = PrimaryNavItem;
export type RailVariant = "header" | "dock";

const SPRING_ACTIVE = { type: "spring", stiffness: 420, damping: 32, mass: 0.9 } as const;
const SPRING_HOVER = { type: "spring", stiffness: 300, damping: 28, mass: 0.8 } as const;

type Box = { x: number; y: number; w: number; h: number };

/** Per-chip pending state driven by Next's real transition status. */
function ChipPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-full bg-brand-accent/10 motion-safe:animate-pulse"
    />
  );
}

/** Tooltip only where it adds information; a Radix Tooltip needs its provider,
 *  so the rail carries one of its own (the header adds another — nesting is fine). */
function MaybeTip({ enabled, label, className, children }: { enabled: boolean; label: string; className?: string; children: React.ReactElement }) {
  if (!enabled) return children;
  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={200}>
      <HeaderTip label={label} className={className}>{children}</HeaderTip>
    </TooltipProvider>
  );
}

function LiveDot({ active }: { active: boolean }) {
  return (
    <span className="relative ml-0.5 flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
      {!active && (
        <span className="absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-60 motion-safe:animate-ping [animation-duration:2.6s]" />
      )}
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-accent" />
    </span>
  );
}

const chipBase =
  "relative z-10 inline-flex select-none items-center whitespace-nowrap rounded-full font-medium " +
  "transition-[color,transform] duration-200 ease-out motion-reduce:transition-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// Header chips are icon-only until lg so a signed-in header (rail + six
// utilities) still fits at 768px; the label stays in the accessible name.
const chipVariant: Record<RailVariant, string> = {
  header: "min-h-9 gap-1.5 px-3 text-[13px] lg:px-3.5",
  dock: "min-h-12 min-w-[3.25rem] flex-col justify-center gap-0.5 px-1.5 py-1 text-[10px] leading-tight",
};

const activeBoxClass =
  "rounded-full bg-brand-accent/12 ring-1 ring-inset ring-brand-accent/25 shadow-[0_0_24px_-6px_hsl(var(--brand-accent)/0.55)]";

/** Any non-link element that should live inside the pill and take the hover
 *  chaser (currency, alerts, cart, messages, theme, account). */
export function RailSlot({ id, className, children, ...rest }: { id: string; className?: string; children: React.ReactNode } & Omit<React.LiHTMLAttributes<HTMLLIElement>, "className" | "children" | "id">) {
  return (
    <li data-rail-chip={`util:${id}`} className={cn("relative flex items-center", className)} {...rest}>
      {children}
    </li>
  );
}

/** Thin separator between the navigation chips and the utilities. */
export function RailDivider() {
  return <li aria-hidden="true" className="mx-1 h-5 w-px shrink-0 self-center bg-border/80" />;
}

/** A non-link chip (e.g. "Menu" on the dock) that shares the chip styling. */
export function RailAction({
  variant = "dock",
  label,
  icon: Icon,
  onClick,
  ...rest
}: {
  variant?: RailVariant;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children" | "className">) {
  return (
    <li className="relative">
      <button
        type="button"
        onClick={onClick}
        className={cn(chipBase, chipVariant[variant], "text-muted-foreground hover:text-foreground")}
        {...rest}
      >
        <Icon aria-hidden="true" className={variant === "dock" ? "size-5" : "size-4"} />
        <span>{label}</span>
      </button>
    </li>
  );
}

export function AppRail({
  id,
  items,
  variant = "header",
  className,
  children,
  onNavigate,
  ...rest
}: {
  /** Stable id for the rail element (also useful for skip links / tests). */
  id: string;
  items: RailItem[];
  variant?: RailVariant;
  className?: string;
  /** Extra chips appended after the links (use `RailAction`). */
  children?: React.ReactNode;
  onNavigate?: () => void;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children" | "id">) {
  const pathname = usePathname() ?? "/";
  const reduceMotion = useHydratedReducedMotion();
  const [hovered, setHovered] = React.useState<string | null>(null);
  const isDock = variant === "dock";

  const listRef = React.useRef<HTMLUListElement>(null);
  // Chip geometry inside the pill, keyed by href. Empty until the first
  // layout-effect measurement (SSR + first paint fall back to a static box on
  // the active chip so the indicator is never missing).
  const [boxes, setBoxes] = React.useState<Record<string, Box>>({});

  const measure = React.useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const next: Record<string, Box> = {};
    list.querySelectorAll<HTMLElement>("[data-rail-chip]").forEach((chip) => {
      const href = chip.dataset.railChip;
      if (!href) return;
      next[href] = { x: chip.offsetLeft, y: chip.offsetTop, w: chip.offsetWidth, h: chip.offsetHeight };
    });
    setBoxes((prev) => {
      const keys = Object.keys(next);
      const same =
        keys.length === Object.keys(prev).length &&
        keys.every((k) => {
          const a = prev[k];
          const b = next[k];
          return a && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
        });
      return same ? prev : next;
    });
  }, []);

  React.useLayoutEffect(() => {
    measure();
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    const observeChips = () => list.querySelectorAll<HTMLElement>("[data-rail-chip]").forEach((chip) => observer.observe(chip));
    observeChips();
    // Utilities mount later (session, cart count); re-measure when chips come and go.
    const mutations = new MutationObserver(() => { observeChips(); measure(); });
    mutations.observe(list, { childList: true, subtree: true });
    return () => { observer.disconnect(); mutations.disconnect(); };
  }, [measure, items]);

  // Delegated hover/focus: any [data-rail-chip] descendant (links, RailSlots) drives the chaser.
  const chipKeyOf = (target: EventTarget | null) => {
    const chip = target instanceof Element ? target.closest<HTMLElement>("[data-rail-chip]") : null;
    return chip && listRef.current?.contains(chip) ? chip.dataset.railChip ?? null : null;
  };

  const activeTransition = reduceMotion ? { duration: 0 } : SPRING_ACTIVE;
  const hoverTransition = reduceMotion ? { duration: 0 } : SPRING_HOVER;
  const activeHref = items.find((item) => isActiveNavigationPath(pathname, item.href))?.href ?? null;

  const measured = Object.keys(boxes).length > 0;
  const activeBox = activeHref ? boxes[activeHref] : undefined;
  // The chaser parks on the active chip while idle so each hover starts from
  // "home" and slides out, instead of popping in from nowhere.
  const chaserBox = (hovered && boxes[hovered]) || activeBox;

  return (
    <nav
      id={id}
      aria-label="Primary navigation"
      data-app-rail={variant}
      className={cn(
        isDock
          ? "pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 md:hidden"
          : "relative",
        className,
      )}
      style={
        isDock
          ? { bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px + var(--cookie-banner-offset, 0px))" }
          : undefined
      }
      {...rest}
    >
      <ul
        ref={listRef}
        role="list"
        onPointerOver={(e) => { const key = chipKeyOf(e.target); if (key) setHovered(key); }}
        onPointerLeave={() => setHovered(null)}
        onFocusCapture={(e) => { const key = chipKeyOf(e.target); if (key) setHovered(key); }}
        onBlurCapture={(e) => { if (!(e.relatedTarget instanceof Element) || !listRef.current?.contains(e.relatedTarget)) setHovered(null); }}
        className={cn(
          "pointer-events-auto relative flex items-center rounded-full border border-border/60 bg-surface-1/75 backdrop-blur-xl backdrop-saturate-150",
          isDock
            ? "w-full max-w-md justify-around gap-0 px-1.5 py-1.5 shadow-e3"
            : "gap-0.5 p-1 shadow-e1",
          // The account circle at the end is taller than the pill; never clip it.
          !isDock && "overflow-visible",
        )}
      >
        {/* Motion layers — one element each, moved by measured geometry. */}
        {activeBox && (
          <motion.span
            aria-hidden="true"
            className={cn("app-rail-box pointer-events-none absolute left-0 top-0", activeBoxClass)}
            initial={false}
            animate={{ x: activeBox.x, y: activeBox.y, width: activeBox.w, height: activeBox.h }}
            transition={activeTransition}
          />
        )}
        {chaserBox && (
          <motion.span
            aria-hidden="true"
            className="app-rail-box pointer-events-none absolute left-0 top-0 rounded-full bg-foreground/[0.06]"
            initial={false}
            animate={{
              x: chaserBox.x,
              y: chaserBox.y,
              width: chaserBox.w,
              height: chaserBox.h,
              opacity: hovered && hovered !== activeHref ? 1 : 0,
            }}
            transition={hoverTransition}
          />
        )}

        {items.map((item) => {
          const active = item.href === activeHref;
          const Icon = item.icon;

          return (
            <li key={item.href} className="relative" data-rail-chip={item.href}>
              {/* Static fallback until the chips have been measured (SSR / first paint). */}
              {active && !measured && (
                <span aria-hidden="true" className={cn("pointer-events-none absolute inset-0", activeBoxClass)} />
              )}
              {/* Header chips are icon-only below lg, so the tooltip carries the
                  label there; from lg the label is visible and the tip hides.
                  The dock always shows labels, so it gets the plain link. */}
              <MaybeTip enabled={!isDock} label={item.live ? `${item.label} · live` : item.label} className="lg:hidden">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  chipBase,
                  chipVariant[variant],
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  !isDock && "motion-safe:hover:-translate-y-px",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 transition-[color,transform] duration-200 motion-reduce:transition-none",
                    isDock ? "size-5" : "size-4",
                    active ? "text-brand-accent" : "text-muted-foreground/80",
                  )}
                />
                <span className={cn("items-center", isDock ? "inline-flex" : "sr-only lg:not-sr-only lg:inline-flex")}>
                  {item.label}
                  {item.live && <LiveDot active={active} />}
                </span>
                <ChipPending />
              </Link>
              </MaybeTip>
            </li>
          );
        })}
        {children}
      </ul>
    </nav>
  );
}

export default AppRail;
