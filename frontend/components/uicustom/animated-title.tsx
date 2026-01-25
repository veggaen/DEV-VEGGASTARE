"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

export type AnimatedTitleProps = {
  text: string;
  as?: "h1" | "h2" | "h3" | "div";
  className?: string;
  /** "unroll" = per-letter 3D unroll; "prefix" = F→Fr→Fre… build */
  mode?: "unroll" | "prefix";
  /** Base delay before reveal starts (seconds) */
  baseDelay?: number;
  /** Delay between letters (seconds) */
  letterStagger?: number;
  /** Whether to render a dropping trademark (™) if present at end of text */
  trademarkDrop?: boolean;
  /** Extra delay after the main reveal before trademark drops (seconds) */
  trademarkExtraDelay?: number;
};

function splitTrademark(raw: string) {
  const text = String(raw ?? "");
  if (text.endsWith("™")) {
    return { main: text.slice(0, -1).trimEnd(), trademark: "™" };
  }
  if (text.endsWith("®")) {
    return { main: text.slice(0, -1).trimEnd(), trademark: "®" };
  }
  return { main: text, trademark: "" };
}

export default function AnimatedTitle({
  text,
  as = "h1",
  className,
  mode = "unroll",
  baseDelay = 0.08,
  letterStagger = 0.024,
  trademarkDrop = true,
  trademarkExtraDelay = 0,
}: AnimatedTitleProps) {
  const reduceMotion = useReducedMotion();
  const { main, trademark } = React.useMemo(() => splitTrademark(text), [text]);
  const letters = React.useMemo(() => Array.from(main ?? ""), [main]);

  const [prefixIndex, setPrefixIndex] = React.useState(0);
  const [prefixDone, setPrefixDone] = React.useState(false);
  const [prefixStarted, setPrefixStarted] = React.useState(false);

  React.useEffect(() => {
    if (reduceMotion) return;
    if (mode !== "prefix") return;

    setPrefixIndex(0);
    setPrefixDone(false);
    setPrefixStarted(false);

    const ms = Math.max(10, Math.round(letterStagger * 1000));
    const fullLen = String(main ?? "").length;
    if (fullLen <= 0) {
      setPrefixDone(true);
      return;
    }

    const startTimer = window.setTimeout(() => {
      setPrefixStarted(true);
      let i = 0;
      setPrefixIndex(1); // show first char immediately when started
      const t = window.setInterval(() => {
        i += 1;
        const next = Math.min(fullLen, i + 1);
        setPrefixIndex(next);
        if (next >= fullLen) {
          window.clearInterval(t);
          setPrefixDone(true);
        }
      }, ms);

      // Cleanup for the interval if effect re-runs.
      (startTimer as any).__interval = t;
    }, Math.max(0, Math.round(baseDelay * 1000)));

    return () => {
      window.clearTimeout(startTimer);
      const maybeInterval = (startTimer as any).__interval as number | undefined;
      if (maybeInterval) window.clearInterval(maybeInterval);
    };
  }, [reduceMotion, mode, letterStagger, main]);

  const Tag: any = as;

  if (reduceMotion) {
    return (
      <Tag className={className}>
        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: "easeOut" }}>
          {main}
          {trademark}
        </motion.span>
      </Tag>
    );
  }

  // A rough end time so the trademark can drop in after the reveal completes.
  const revealEnd = baseDelay + Math.min(letters.length * letterStagger, 1.35) + 0.12 + trademarkExtraDelay;

  return (
    <Tag className={className} style={{ perspective: 700 }}>
      {mode === "prefix" ? (
        <motion.span
          className="inline"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {prefixStarted ? String(main ?? "").slice(0, prefixIndex) : "\u00A0"}
        </motion.span>
      ) : (
        <motion.span
          className="inline"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: {
              transition: {
                delayChildren: baseDelay,
                staggerChildren: letterStagger,
              },
            },
          }}
        >
          {letters.map((ch, i) => (
            <motion.span
              key={`${ch}-${i}`}
              className="inline-block"
              style={{ transformOrigin: "left center" }}
              variants={{
                hidden: {
                  opacity: 0,
                  scaleX: 0.12,
                  rotateY: -72,
                  x: -4,
                },
                show: {
                  opacity: 1,
                  scaleX: 1,
                  rotateY: 0,
                  x: 0,
                  transition: { duration: 0.14, ease: "easeOut" },
                },
              }}
            >
              {ch === " " ? "\u00A0" : ch}
            </motion.span>
          ))}
        </motion.span>
      )}

      {trademarkDrop && trademark ? (
        mode === "prefix" ? (
          <motion.span
            className="inline-block"
            style={{ transformOrigin: "center" }}
            initial={{ opacity: 0, y: -18, scale: 0.85, rotate: -6 }}
            animate={prefixDone ? { opacity: 1, y: 0, scale: 1, rotate: 0 } : { opacity: 0, y: -18, scale: 0.85, rotate: -6 }}
            transition={{ delay: prefixDone ? trademarkExtraDelay : 0, type: "spring", stiffness: 520, damping: 16, mass: 0.7 }}
          >
            {trademark}
          </motion.span>
        ) : (
          <motion.span
            className="inline-block"
            style={{ transformOrigin: "center" }}
            initial={{ opacity: 0, y: -18, scale: 0.85, rotate: -6 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            transition={{ delay: revealEnd, type: "spring", stiffness: 520, damping: 16, mass: 0.7 }}
          >
            {trademark}
          </motion.span>
        )
      ) : (
        trademark
      )}
    </Tag>
  );
}
