"use client";

/**
 * @fileOverview  HoverChaser — the "trailing box" for grids and menus. One
 *                spring-driven accent box slides between the hovered/focused
 *                items of a container in any direction (up, down, left,
 *                right), the same feel as the rail's chaser in the header.
 *
 *                Usage: wrap a grid/list, mark each item with `data-chase`,
 *                give items `relative` so they paint above the box, and drop
 *                their own hover backgrounds/borders (the box is the hover).
 *                Positions come from measured geometry, so it works for any
 *                layout (grid, flex, sticky sidebars) and any item size.
 *
 * @stability     evolving
 */

import * as React from "react";
import { motion } from "framer-motion";
import { useHydratedReducedMotion } from "@/hooks/use-hydrated-reduced-motion";
import { cn } from "@/lib/utils";

type Box = { x: number; y: number; w: number; h: number };
const SPRING = { type: "spring", stiffness: 320, damping: 30, mass: 0.8 } as const;

export function HoverChaser({
  as: Tag = "div",
  className,
  boxClassName,
  children,
  ...rest
}: {
  as?: "div" | "nav" | "ul" | "section";
  className?: string;
  /** Override the box look (radius must match the items). */
  boxClassName?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  const ref = React.useRef<HTMLElement>(null);
  const reduceMotion = useHydratedReducedMotion();
  const [box, setBox] = React.useState<Box | null>(null);
  const [visible, setVisible] = React.useState(false);

  const measure = React.useCallback((target: Element | null) => {
    const root = ref.current;
    const item = target instanceof Element ? target.closest<HTMLElement>("[data-chase]") : null;
    if (!root || !item || !root.contains(item)) { setVisible(false); return; }
    const r = root.getBoundingClientRect(), i = item.getBoundingClientRect();
    setBox({ x: i.left - r.left + root.scrollLeft, y: i.top - r.top + root.scrollTop, w: i.width, h: i.height });
    setVisible(true);
  }, []);

  const Comp = Tag as unknown as "div";
  return (
    <Comp
      ref={ref as React.RefObject<HTMLDivElement>}
      className={cn("relative", className)}
      onPointerOver={(e) => measure(e.target as Element)}
      onPointerLeave={() => setVisible(false)}
      onFocusCapture={(e) => measure(e.target as Element)}
      onBlurCapture={(e) => { if (!(e.relatedTarget instanceof Element) || !ref.current?.contains(e.relatedTarget)) setVisible(false); }}
      {...rest}
    >
      {box && (
        <motion.span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-0 top-0 z-0 rounded-xl bg-brand-accent/10 ring-1 ring-inset ring-brand-accent/30 shadow-[0_0_28px_-8px_hsl(var(--brand-accent)/0.55)]",
            boxClassName,
          )}
          initial={false}
          animate={{ x: box.x, y: box.y, width: box.w, height: box.h, opacity: visible ? 1 : 0 }}
          transition={reduceMotion ? { duration: 0 } : { ...SPRING, opacity: { duration: 0.18 } }}
        />
      )}
      {children}
    </Comp>
  );
}

export default HoverChaser;
