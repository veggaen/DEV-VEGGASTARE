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

// One shared motion curve so the follow-border and the card's own expand animation
// feel like a single system. Keep in sync with ConversationCard's expand transition
// (duration 0.28s, ease cubic-bezier(0.22,1,0.36,1)).
const GLIDE = "0.28s cubic-bezier(0.22,1,0.36,1)";

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
  // The currently-hovered element lives in STATE (not a ref) so the measurement
  // effect re-runs — and re-attaches its observer to the NEW card — every time
  // you move to a different card.
  const [activeEl, setActiveEl] = React.useState<HTMLElement | null>(null);
  const [style, setStyle] = React.useState<IndicatorStyle | null>(null);
  const visible = activeEl !== null;

  // Measure the active card and keep the indicator glued to it. Cards keep a FIXED
  // height (their hover reveal overlays rather than reflowing the list), so there
  // is no expand animation to chase — the indicator simply GLIDES between stable
  // card rects. A ResizeObserver + scroll listener handle window resize / scroll.
  React.useEffect(() => {
    const container = containerRef.current;
    if (!activeEl || !container) return;

    const measure = () => {
      const cr = container.getBoundingClientRect();
      const cl = activeEl.getBoundingClientRect();
      setStyle({
        left: cl.left - cr.left,
        top: cl.top - cr.top,
        width: cl.width,
        height: cl.height,
      });
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(activeEl);
    container.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure, { passive: true });

    return () => {
      ro.disconnect();
      container.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [activeEl]);

  const onEnter = React.useCallback((el: HTMLElement) => setActiveEl(el), []);

  return (
    <HoverFollowContext.Provider value={{ onEnter }}>
      <div
        ref={containerRef}
        className={`relative ${className ?? ""}`}
        onMouseLeave={() => setActiveEl(null)}
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
              // One uniform glide for position + size between stable card rects.
              transition: `left ${GLIDE}, top ${GLIDE}, width ${GLIDE}, height ${GLIDE}, opacity 0.3s ease-out`,
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
