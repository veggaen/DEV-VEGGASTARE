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
  // you move to a different card. (A ref wouldn't re-trigger the effect, which
  // is what left the border stuck on the first expanded card.)
  const [activeEl, setActiveEl] = React.useState<HTMLElement | null>(null);
  const [style, setStyle] = React.useState<IndicatorStyle | null>(null);
  // While true, the indicator's size has NO CSS transition, so the rAF loop's
  // per-frame measurements track the card's OWN expand animation frame-for-frame
  // (instead of a second, slower CSS transition chasing it — which is what made
  // the border lag behind the reveal). It glides only when MOVING BETWEEN cards.
  const [trackingResize, setTrackingResize] = React.useState(false);
  const visible = activeEl !== null;

  // Re-measure + observe whichever card is active. The observer is scoped to
  // THIS card and torn down when active changes, so cards never fight over the
  // indicator; rAF + scroll handling keep it glued during the expand animation.
  React.useEffect(() => {
    const container = containerRef.current;
    if (!activeEl || !container) return;

    let raf = 0;
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

    // Let the position/size GLIDE to the new card for one frame (smooth jump
    // between cards), then switch to transition-free tracking so the border
    // grows in lockstep with this card's reveal.
    const toTracking = requestAnimationFrame(() => setTrackingResize(true));

    // Track the card through its height animation so the border grows with it,
    // then settle (ResizeObserver catches any later layout shifts).
    const start = performance.now();
    const animate = () => {
      measure();
      if (performance.now() - start < 450) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    const ro = new ResizeObserver(measure);
    ro.observe(activeEl);
    container.addEventListener("scroll", measure, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(toTracking);
      ro.disconnect();
      container.removeEventListener("scroll", measure);
      // Next card should glide in, so re-enable the size transition on switch.
      setTrackingResize(false);
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
              // Position always glides (smooth jump between cards). Size glides
              // only when switching cards; while tracking the active card's own
              // reveal it updates transition-free so it grows in perfect lockstep.
              transition: trackingResize
                ? `left ${GLIDE}, top ${GLIDE}, opacity 0.3s ease-out`
                : `left ${GLIDE}, top ${GLIDE}, width ${GLIDE}, height ${GLIDE}, opacity 0.3s ease-out`,
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
