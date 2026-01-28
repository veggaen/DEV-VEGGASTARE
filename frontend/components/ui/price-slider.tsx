'use client';

import React, { useCallback, useRef, useState, useMemo, useLayoutEffect, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PriceSliderProps {
  minValue: number | null;
  maxValue: number | null;
  rangeMin?: number;
  rangeMax?: number;
  step?: number;
  onMinChange: (value: number | null) => void;
  onMaxChange: (value: number | null) => void;
  formatValue?: (value: number) => string;
  parseValue?: (formatted: string) => number | null;
  className?: string;
}

/**
 * A fancy dual-handle price range slider using Framer Motion's useMotionValue.
 * Uses controlled motion values with proper constraints and padding.
 */
export const PriceSlider = ({
  minValue,
  maxValue,
  rangeMin = 0,
  rangeMax = 10000,
  step = 1,
  onMinChange,
  onMaxChange,
  formatValue = (v) => `$${v.toLocaleString()}`,
  parseValue,
  className,
}: PriceSliderProps) => {
  const reduceMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null);
  const [lastDragged, setLastDragged] = useState<'min' | 'max'>('max'); // Track last interacted handle
  const [isHovered, setIsHovered] = useState(false);

  // Pointer-drag state (works on mobile + desktop reliably)
  const activeHandleRef = useRef<'min' | 'max' | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const dragOffsetPxRef = useRef(0);
  
  // State for editable value inputs
  const [editingMin, setEditingMin] = useState(false);
  const [editingMax, setEditingMax] = useState(false);
  const [minInputValue, setMinInputValue] = useState('');
  const [maxInputValue, setMaxInputValue] = useState('');
  const minInputRef = useRef<HTMLInputElement>(null);
  const maxInputRef = useRef<HTMLInputElement>(null);
  
  // Handle dimensions - track has padding for handles
  const handleSize = 24; // w-6
  const trackPadding = handleSize / 2; // 12px padding each side
  
  // Default parser
  const defaultParseValue = useCallback((str: string): number | null => {
    const cleaned = str.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }, []);
  
  const parse = parseValue ?? defaultParseValue;

  // Measure track width (usable area after padding)
  useLayoutEffect(() => {
    const updateWidth = () => {
      if (trackRef.current) {
        // Usable width = total width - padding on both sides
        const totalWidth = trackRef.current.offsetWidth;
        setTrackWidth(Math.max(0, totalWidth - trackPadding * 2));
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [trackPadding]);

  // Calculate values
  const range = rangeMax - rangeMin;
  const effectiveMin = minValue ?? rangeMin;
  const effectiveMax = maxValue ?? rangeMax;
  const minPercent = (effectiveMin - rangeMin) / range;
  const maxPercent = (effectiveMax - rangeMin) / range;

  // Minimum gap between handles. Keep this at 0 so the two handles can meet.
  // (A large min gap makes dragging feel "blocked" / janky.)
  const minGap = 0;

  // Clamp and snap to step
  const snapToStep = useCallback((value: number) => {
    const snapped = Math.round(value / step) * step;
    return Math.max(rangeMin, Math.min(rangeMax, snapped));
  }, [step, rangeMin, rangeMax]);

  // Convert pixel offset (within usable track) to value
  const pxToValue = useCallback((px: number) => {
    if (trackWidth <= 0) return rangeMin;
    const percent = Math.max(0, Math.min(1, px / trackWidth));
    return snapToStep(rangeMin + percent * range);
  }, [trackWidth, rangeMin, range, snapToStep]);

  // Convert value to pixel offset
  const valueToPx = useCallback((value: number) => {
    return ((value - rangeMin) / range) * trackWidth;
  }, [rangeMin, range, trackWidth]);

  // Current positions in pixels (within usable track area)
  const minPx = valueToPx(effectiveMin);
  const maxPx = valueToPx(effectiveMax);

  const clampPx = useCallback((px: number, min: number, max: number) => {
    return Math.max(min, Math.min(px, max));
  }, []);

  const applyMinFromPx = useCallback(
    (px: number) => {
      const clampedPx = clampPx(px, 0, maxPx - minGap);
      const newValue = pxToValue(clampedPx);
      onMinChange(Math.min(newValue, effectiveMax - minGap));
    },
    [clampPx, maxPx, minGap, pxToValue, onMinChange, effectiveMax]
  );

  const applyMaxFromPx = useCallback(
    (px: number) => {
      const clampedPx = clampPx(px, minPx + minGap, trackWidth);
      const newValue = pxToValue(clampedPx);
      onMaxChange(Math.max(newValue, effectiveMin + minGap));
    },
    [clampPx, minPx, minGap, trackWidth, pxToValue, onMaxChange, effectiveMin]
  );

  // Track pointer-down on track (jump to position). This is separate from handle dragging.
  const handleTrackPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-slider-thumb]')) return;
      if (activeHandleRef.current) return;

      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;

      e.preventDefault();
      e.stopPropagation();

      const clickPx = e.clientX - rect.left - trackPadding;
      const clampedClickPx = Math.max(0, Math.min(trackWidth, clickPx));

      const distToMin = Math.abs(clampedClickPx - minPx);
      const distToMax = Math.abs(clampedClickPx - maxPx);

      // Prefer moving the closest handle. If equal, prefer the last dragged.
      const pick: 'min' | 'max' =
        distToMin === distToMax ? lastDragged : distToMin < distToMax ? 'min' : 'max';
      setLastDragged(pick);

      if (pick === 'min') {
        applyMinFromPx(clampedClickPx);
      } else {
        applyMaxFromPx(clampedClickPx);
      }
    },
    [trackPadding, trackWidth, minPx, maxPx, lastDragged, applyMinFromPx, applyMaxFromPx]
  );

  const handleThumbPointerDown = useCallback(
    (which: 'min' | 'max') => (e: React.PointerEvent) => {
      // Start handle drag WITHOUT treating it as a track click.
      e.preventDefault();
      e.stopPropagation();

      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;

      activeHandleRef.current = which;
      activePointerIdRef.current = e.pointerId;
      setIsDragging(which);
      setLastDragged(which);

      // Keep the handle from "jumping" under the pointer/finger.
      const currentPx = which === 'min' ? minPx : maxPx;
      const handleCenterX = rect.left + trackPadding + currentPx;
      dragOffsetPxRef.current = e.clientX - handleCenterX;

      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    },
    [maxPx, minPx, trackPadding]
  );

  const handleThumbPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeHandleRef.current) return;
      if (activePointerIdRef.current !== e.pointerId) return;

      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;

      e.preventDefault();
      e.stopPropagation();

      const px = e.clientX - rect.left - trackPadding - dragOffsetPxRef.current;
      if (activeHandleRef.current === 'min') {
        applyMinFromPx(px);
      } else {
        applyMaxFromPx(px);
      }
    },
    [applyMinFromPx, applyMaxFromPx, trackPadding]
  );

  const handleThumbPointerUp = useCallback((e: React.PointerEvent) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    activeHandleRef.current = null;
    activePointerIdRef.current = null;
    setIsDragging(null);
    dragOffsetPxRef.current = 0;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((handle: 'min' | 'max') => (e: React.KeyboardEvent) => {
    const current = handle === 'min' ? effectiveMin : effectiveMax;
    let newValue = current;

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        newValue = snapToStep(current - step);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        newValue = snapToStep(current + step);
        break;
      case 'Home':
        e.preventDefault();
        newValue = handle === 'min' ? rangeMin : effectiveMin + minGap;
        break;
      case 'End':
        e.preventDefault();
        newValue = handle === 'max' ? rangeMax : effectiveMax - minGap;
        break;
      default:
        return;
    }

    if (handle === 'min') {
      onMinChange(Math.min(newValue, effectiveMax - minGap));
    } else {
      onMaxChange(Math.max(newValue, effectiveMin + minGap));
    }
  }, [effectiveMin, effectiveMax, rangeMin, rangeMax, minGap, step, snapToStep, onMinChange, onMaxChange]);

  // Animated glow position
  const glowPosition = useMemo(() => {
    if (isDragging === 'min') return minPercent;
    if (isDragging === 'max') return maxPercent;
    return (minPercent + maxPercent) / 2;
  }, [isDragging, minPercent, maxPercent]);
  
  // Handlers for editable min value
  const handleMinClick = useCallback(() => {
    setEditingMin(true);
    setMinInputValue(String(effectiveMin));
    setTimeout(() => minInputRef.current?.select(), 0);
  }, [effectiveMin]);
  
  const handleMinBlur = useCallback(() => {
    setEditingMin(false);
    const parsed = parse(minInputValue);
    if (parsed !== null) {
      const clamped = Math.max(rangeMin, Math.min(parsed, effectiveMax - minGap));
      onMinChange(snapToStep(clamped));
    }
  }, [minInputValue, parse, rangeMin, effectiveMax, minGap, onMinChange, snapToStep]);
  
  const handleMinKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setEditingMin(false);
      setMinInputValue(String(effectiveMin));
    }
  }, [effectiveMin]);
  
  // Handlers for editable max value
  const handleMaxClick = useCallback(() => {
    setEditingMax(true);
    setMaxInputValue(String(effectiveMax));
    setTimeout(() => maxInputRef.current?.select(), 0);
  }, [effectiveMax]);
  
  const handleMaxBlur = useCallback(() => {
    setEditingMax(false);
    const parsed = parse(maxInputValue);
    if (parsed !== null) {
      const clamped = Math.min(rangeMax, Math.max(parsed, effectiveMin + minGap));
      onMaxChange(snapToStep(clamped));
    }
  }, [maxInputValue, parse, rangeMax, effectiveMin, minGap, onMaxChange, snapToStep]);
  
  const handleMaxKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setEditingMax(false);
      setMaxInputValue(String(effectiveMax));
    }
  }, [effectiveMax]);

  // Stop propagation to prevent sidebar/menu swipe handlers from seeing these gestures.
  // IMPORTANT: do NOT use *Capture* phase here, or it prevents the slider's own pointer handlers.
  const stopPropagation = useCallback((e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div 
      className={cn("relative select-none", className)}
      data-price-slider
      onPointerDown={stopPropagation}
      onPointerMove={stopPropagation}
      onTouchStart={stopPropagation}
      onTouchMove={stopPropagation}
    >
      {/* Editable value display */}
      <div className="flex items-center justify-between gap-2 mb-3">
        {/* Min value - clickable/editable */}
        <div className="min-w-0 flex-1">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">From</div>
          {editingMin ? (
            <input
              ref={minInputRef}
              type="text"
              inputMode="numeric"
              value={minInputValue}
              onChange={(e) => setMinInputValue(e.target.value)}
              onBlur={handleMinBlur}
              onKeyDown={handleMinKeyDown}
              className="w-full h-6 bg-white/60 dark:bg-white/[0.08] border border-emerald-400/50 dark:border-emerald-500/40 rounded px-1.5 text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={handleMinClick}
              className="group w-full text-left text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums truncate rounded px-1 -mx-1 py-0.5 -my-0.5 hover:bg-white/40 dark:hover:bg-white/[0.06] transition-colors cursor-text border border-transparent hover:border-emerald-400/30 dark:hover:border-emerald-500/20"
              title="Click to edit"
            >
              {formatValue(effectiveMin)}
            </button>
          )}
        </div>
        
        <div className="text-slate-300 dark:text-slate-600 text-xs select-none">–</div>
        
        {/* Max value - clickable/editable */}
        <div className="min-w-0 flex-1 text-right">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">To</div>
          {editingMax ? (
            <input
              ref={maxInputRef}
              type="text"
              inputMode="numeric"
              value={maxInputValue}
              onChange={(e) => setMaxInputValue(e.target.value)}
              onBlur={handleMaxBlur}
              onKeyDown={handleMaxKeyDown}
              className="w-full h-6 bg-white/60 dark:bg-white/[0.08] border border-violet-400/50 dark:border-violet-500/40 rounded px-1.5 text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums text-right outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={handleMaxClick}
              className="group w-full text-right text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums truncate rounded px-1 -mx-1 py-0.5 -my-0.5 hover:bg-white/40 dark:hover:bg-white/[0.06] transition-colors cursor-text border border-transparent hover:border-violet-400/30 dark:hover:border-violet-500/20"
              title="Click to edit"
            >
              {formatValue(effectiveMax)}
            </button>
          )}
        </div>
      </div>

      {/* Track container with padding for handles */}
      <div
        ref={trackRef}
        className="relative h-10 flex items-center cursor-pointer"
        style={{ touchAction: 'none' }}
        onPointerDown={handleTrackPointerDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Background track */}
        <div
          className="absolute h-1.5 rounded-full bg-slate-200/60 dark:bg-white/[0.08]"
          style={{ left: trackPadding, right: trackPadding }}
        />

        {/* Animated glow effect */}
        <motion.div
          className="absolute h-1.5 rounded-full pointer-events-none overflow-hidden"
          style={{ left: trackPadding, right: trackPadding }}
          aria-hidden="true"
        >
          <motion.div
            className="absolute inset-0"
            animate={reduceMotion ? undefined : {
              opacity: isDragging || isHovered ? [0.5, 0.8, 0.5] : 0.3,
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background: `radial-gradient(ellipse 200% 100% at ${glowPosition * 100}% 50%, rgba(34,197,94,0.4), rgba(56,189,248,0.3), transparent 70%)`,
            }}
          />
        </motion.div>

        {/* Active range fill */}
        <div
          className="absolute h-1.5 rounded-full pointer-events-none"
          style={{
            left: trackPadding + minPx,
            width: Math.max(0, maxPx - minPx),
            background: isDragging
              ? 'linear-gradient(90deg, rgba(34,197,94,0.8), rgba(56,189,248,0.7), rgba(167,139,250,0.6))'
              : 'linear-gradient(90deg, rgba(34,197,94,0.6), rgba(56,189,248,0.5), rgba(167,139,250,0.4))',
            transition: 'background 0.2s',
          }}
        />

        {/* Min handle */}
        <motion.div
          data-slider-thumb
          data-handle="min"
          role="slider"
          tabIndex={0}
          aria-label="Minimum price"
          aria-valuenow={effectiveMin}
          aria-valuemin={rangeMin}
          aria-valuemax={rangeMax}
          className={cn(
            "absolute w-6 h-6 rounded-full cursor-grab active:cursor-grabbing",
            "flex items-center justify-center",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
            // Dragging handle always on top, otherwise last dragged handle on top
            isDragging === 'min' ? "z-30" : isDragging === 'max' ? "z-10" : lastDragged === 'min' ? "z-20" : "z-10"
          )}
          style={{
            left: trackPadding + minPx,
            transform: 'translateX(-50%)',
            touchAction: 'none',
          }}
          onPointerDown={handleThumbPointerDown('min')}
          onPointerMove={handleThumbPointerMove}
          onPointerUp={handleThumbPointerUp}
          onPointerCancel={handleThumbPointerUp}
          onKeyDown={handleKeyDown('min')}
          whileDrag={{ scale: 1.2 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 1.15 }}
        >
          {/* Handle glow */}
          <motion.div
            className="absolute -inset-1 rounded-full pointer-events-none"
            animate={reduceMotion ? undefined : {
              opacity: isDragging === 'min' ? [0.6, 1, 0.6] : isHovered ? 0.4 : 0.15,
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background: 'radial-gradient(circle, rgba(34,197,94,0.6), rgba(56,189,248,0.4), transparent 70%)',
              filter: 'blur(4px)',
            }}
          />
          {/* Handle body */}
          <div className={cn(
            "relative w-5 h-5 rounded-full shadow-md",
            "bg-gradient-to-br from-white to-slate-100",
            "dark:from-slate-600 dark:to-slate-800",
            "border-2 border-emerald-500 dark:border-emerald-400"
          )}>
            <div className="absolute inset-0.5 rounded-full bg-gradient-to-br from-emerald-200/30 to-transparent dark:from-emerald-400/20" />
          </div>
        </motion.div>

        {/* Max handle */}
        <motion.div
          data-slider-thumb
          data-handle="max"
          role="slider"
          tabIndex={0}
          aria-label="Maximum price"
          aria-valuenow={effectiveMax}
          aria-valuemin={rangeMin}
          aria-valuemax={rangeMax}
          className={cn(
            "absolute w-6 h-6 rounded-full cursor-grab active:cursor-grabbing",
            "flex items-center justify-center",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
            // Dragging handle always on top, otherwise last dragged handle on top
            isDragging === 'max' ? "z-30" : isDragging === 'min' ? "z-10" : lastDragged === 'max' ? "z-20" : "z-10"
          )}
          style={{
            left: trackPadding + maxPx,
            transform: 'translateX(-50%)',
            touchAction: 'none',
          }}
          onPointerDown={handleThumbPointerDown('max')}
          onPointerMove={handleThumbPointerMove}
          onPointerUp={handleThumbPointerUp}
          onPointerCancel={handleThumbPointerUp}
          onKeyDown={handleKeyDown('max')}
          whileDrag={{ scale: 1.2 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 1.15 }}
        >
          {/* Handle glow */}
          <motion.div
            className="absolute -inset-1 rounded-full pointer-events-none"
            animate={reduceMotion ? undefined : {
              opacity: isDragging === 'max' ? [0.6, 1, 0.6] : isHovered ? 0.4 : 0.15,
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background: 'radial-gradient(circle, rgba(167,139,250,0.6), rgba(236,72,153,0.4), transparent 70%)',
              filter: 'blur(4px)',
            }}
          />
          {/* Handle body */}
          <div className={cn(
            "relative w-5 h-5 rounded-full shadow-md",
            "bg-gradient-to-br from-white to-slate-100",
            "dark:from-slate-600 dark:to-slate-800",
            "border-2 border-violet-500 dark:border-violet-400"
          )}>
            <div className="absolute inset-0.5 rounded-full bg-gradient-to-br from-violet-200/30 to-transparent dark:from-violet-400/20" />
          </div>
        </motion.div>
      </div>

      {/* Range labels */}
      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 dark:text-slate-500">
        <span>{formatValue(rangeMin)}</span>
        <span>{formatValue(rangeMax)}</span>
      </div>
    </div>
  );
};

export default PriceSlider;
