"use client";

/**
 * @fileOverview HoverFollowGrid — the landing page's signature interaction,
 *   extracted for reuse: a single accent-colored border box that smoothly
 *   slides + resizes to match whichever child card you hover, then fades out on
 *   leave. (Sky in light, emerald in dark — the brand accent.)
 *
 *   Usage:
 *     <HoverFollowGrid className="grid gap-4 sm:grid-cols-2">
 *       {items.map((it) => (
 *         <HoverFollowItem key={it.id}>
 *           ...your card...
 *         </HoverFollowItem>
 *       ))}
 *     </HoverFollowGrid>
 *
 *   HoverFollowItem just wires onMouseEnter; it renders a plain <div> wrapper so
 *   your card markup is unchanged. The indicator lives in the grid.
 * @stability active
 */

import * as React from "react";

interface IndicatorStyle {
  left: number;
  top: number;
  width: number;
  height: number;
}

const HoverFollowContext = React.createContext<{
  onEnter: (el: HTMLElement) => void;
} | null>(null);

export function HoverFollowGrid({
  children,
  className,
  radiusClass = "rounded-2xl",
}: {
  children: React.ReactNode;
  className?: string;
  /** Match the indicator's corner radius to your cards. */
  radiusClass?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const activeElRef = React.useRef<HTMLElement | null>(null);
  const [style, setStyle] = React.useState<IndicatorStyle | null>(null);
  const [visible, setVisible] = React.useState(false);

  // Measure the active element relative to the container. Called on enter AND
  // continuously while hovered (via ResizeObserver) so the indicator keeps
  // wrapping a card that hover-EXPANDS instead of freezing at its collapsed size.
  const measure = React.useCallback(() => {
    const container = containerRef.current;
    const el = activeElRef.current;
    if (!container || !el) return;
    const cr = container.getBoundingClientRect();
    const cl = el.getBoundingClientRect();
    setStyle({
      left: cl.left - cr.left,
      top: cl.top - cr.top,
      width: cl.width,
      height: cl.height,
    });
  }, []);

  // Observe the active element's size so the border follows its expand/collapse.
  React.useEffect(() => {
    if (!visible || !activeElRef.current) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(activeElRef.current);
    return () => ro.disconnect();
  }, [visible, measure]);

  const onEnter = React.useCallback((el: HTMLElement) => {
    activeElRef.current = el;
    measure();
    setVisible(true);
  }, [measure]);

  return (
    <HoverFollowContext.Provider value={{ onEnter }}>
      <div
        ref={containerRef}
        className={`relative ${className ?? ""}`}
        onMouseLeave={() => { setVisible(false); activeElRef.current = null; }}
      >
        {style !== null && (
          <div
            aria-hidden
            className={`absolute pointer-events-none z-10 ${radiusClass} border border-sky-500/50 dark:border-emerald-400/40 shadow-[0_0_24px_-4px_rgba(56,189,248,0.35)] dark:shadow-[0_0_24px_-4px_rgba(52,211,153,0.30)]`}
            style={{
              left: style.left,
              top: style.top,
              width: style.width,
              height: style.height,
              opacity: visible ? 1 : 0,
              transition:
                "left 0.4s cubic-bezier(0.22,1,0.36,1), top 0.4s cubic-bezier(0.22,1,0.36,1), width 0.4s cubic-bezier(0.22,1,0.36,1), height 0.4s cubic-bezier(0.22,1,0.36,1), opacity 0.45s ease-out",
            }}
          />
        )}
        {children}
      </div>
    </HoverFollowContext.Provider>
  );
}

export function HoverFollowItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(HoverFollowContext);
  return (
    <div
      className={className}
      onMouseEnter={(e) => ctx?.onEnter(e.currentTarget)}
    >
      {children}
    </div>
  );
}
