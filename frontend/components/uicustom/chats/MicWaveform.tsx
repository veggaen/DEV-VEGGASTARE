"use client";

/**
 * @fileOverview MicWaveform — a live frequency bar line. Flat (a thin centered
 *   baseline) when silent, bars bounce up from the centre as you speak. Brand-
 *   accented (sky / emerald). Pure presentational: pass `bars` (0..1) from
 *   useMicLevel.
 * @stability experimental
 */

import * as React from "react";

export function MicWaveform({
  bars,
  className = "",
  height = 48,
}: {
  bars: number[];
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={`flex items-center justify-center gap-[3px] ${className}`}
      style={{ height }}
      aria-hidden
    >
      {bars.map((v, i) => {
        // Min 2px baseline so a flat line is visible when silent; grows with level.
        const h = Math.max(2, v * height);
        return (
          <span
            key={i}
            className="w-[3px] rounded-full bg-sky-500/70 dark:bg-emerald-400/70 transition-[height] duration-75 ease-out"
            style={{ height: h }}
          />
        );
      })}
    </div>
  );
}
