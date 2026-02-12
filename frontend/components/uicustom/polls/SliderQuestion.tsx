"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";

interface SliderQuestionProps {
  questionId: string;
  questionText: string;
  description?: string;
  minValue: number;
  maxValue: number;
  step: number;
  minLabel?: string;
  maxLabel?: string;
  stepLabels?: string[];
  value?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  showTooltip?: boolean;
  colorScheme?: "default" | "gradient" | "reach";
}

const DEFAULT_LABELS = ["A", "B", "C", "D", "E", "F", "G"];

export function SliderQuestion({
  questionId,
  questionText,
  description,
  minValue = 1,
  maxValue = 7,
  step = 1,
  minLabel,
  maxLabel,
  stepLabels,
  value,
  onChange,
  disabled = false,
  showTooltip = true,
  colorScheme = "default",
}: SliderQuestionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [justClickedButton, setJustClickedButton] = useState(false); // Prevent drag override after button click
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialClickPos = useRef<{ x: number; y: number } | null>(null);
  
  // Use ref to track the latest value for event handlers (avoids stale closure bug)
  const latestValueRef = useRef(value);
  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  // Calculate number of steps
  const totalSteps = Math.round((maxValue - minValue) / step) + 1;
  const labels = stepLabels || DEFAULT_LABELS.slice(0, totalSteps);

  // Convert value to step index (0-based)
  const currentStepIndex = value !== undefined 
    ? Math.round((value - minValue) / step)
    : null;

  // Get color based on step position - with dark mode support
  const getStepColor = (stepIndex: number, isActive: boolean) => {
    if (!isActive && colorScheme !== "reach") return "bg-muted dark:bg-muted/70";
    
    if (colorScheme === "gradient") {
      const hue = (stepIndex / (totalSteps - 1)) * 120;
      return `hsl(${hue}, 70%, 50%)`;
    }
    
    if (colorScheme === "reach") {
      // Colors with good dark/light contrast
      const colors = [
        "bg-red-500/90 dark:bg-red-600/90",
        "bg-orange-500/90 dark:bg-orange-600/90", 
        "bg-amber-500/90 dark:bg-amber-600/90",
        "bg-yellow-500/90 dark:bg-yellow-600/90",
        "bg-lime-500/90 dark:bg-lime-600/90",
        "bg-green-500/90 dark:bg-green-600/90",
        "bg-emerald-500/90 dark:bg-emerald-600/90",
      ];
      return colors[stepIndex] || colors[colors.length - 1];
    }
    
    return isActive ? "bg-primary" : "bg-muted dark:bg-muted/70";
  };

  // Calculate step from X position on track
  const getStepFromPosition = useCallback((clientX: number) => {
    if (!trackRef.current) return null;
    
    const rect = trackRef.current.getBoundingClientRect();
    const trackWidth = rect.width;
    const circleRadius = 20; // Half of w-10 (40px)
    
    // The first and last circles are centered at circleRadius and trackWidth - circleRadius
    // So the effective "draggable" range is between these two points
    const effectiveStart = circleRadius;
    const effectiveEnd = trackWidth - circleRadius;
    const effectiveWidth = effectiveEnd - effectiveStart;
    
    const offsetX = clientX - rect.left;
    
    // Map the mouse position to the effective range
    const clampedX = Math.max(effectiveStart, Math.min(offsetX, effectiveEnd));
    const percentage = (clampedX - effectiveStart) / effectiveWidth;
    
    // Calculate step index
    const stepIndex = Math.round(percentage * (totalSteps - 1));
    
    return Math.max(0, Math.min(stepIndex, totalSteps - 1));
  }, [totalSteps]);

  // Handle step selection (click or drag)
  const selectStep = useCallback((stepIndex: number) => {
    if (disabled || stepIndex < 0 || stepIndex >= totalSteps) return;
    const newValue = minValue + stepIndex * step;
    onChange(newValue);
  }, [disabled, minValue, step, totalSteps, onChange]);

  // Handle click on step button
  const handleStepClick = useCallback((stepIndex: number) => {
    selectStep(stepIndex);
  }, [selectStep]);

  // Handle drag/pan on the entire track area
  const handlePanStart = useCallback(() => {
    if (disabled) return;
    setIsDragging(true);
  }, [disabled]);

  const handlePan = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled || !isDragging) return;
    
    // Get the actual client X from the event
    const clientX = 'touches' in event 
      ? event.touches[0].clientX 
      : (event as MouseEvent).clientX;
    
    const stepIndex = getStepFromPosition(clientX);
    if (stepIndex !== null) {
      const newValue = minValue + stepIndex * step;
      if (newValue !== latestValueRef.current) {
        selectStep(stepIndex);
      }
    }
  }, [disabled, isDragging, getStepFromPosition, minValue, step, selectStep]);

  const handlePanEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle click on track (not on step buttons)
  const handleTrackClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    const stepIndex = getStepFromPosition(event.clientX);
    if (stepIndex !== null) {
      selectStep(stepIndex);
    }
  }, [disabled, getStepFromPosition, selectStep]);

  // Touch event handlers for mobile
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (disabled) return;
    setIsDragging(true);
    
    const touch = event.touches[0];
    const stepIndex = getStepFromPosition(touch.clientX);
    if (stepIndex !== null) {
      selectStep(stepIndex);
    }
  }, [disabled, getStepFromPosition, selectStep]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (disabled || !isDragging) return;
    event.preventDefault(); // Prevent scroll while dragging
    
    const touch = event.touches[0];
    const stepIndex = getStepFromPosition(touch.clientX);
    if (stepIndex !== null) {
      const newValue = minValue + stepIndex * step;
      if (newValue !== latestValueRef.current) {
        selectStep(stepIndex);
      }
    }
  }, [disabled, isDragging, getStepFromPosition, minValue, step, selectStep]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      
      const currentIndex = currentStepIndex ?? 0;
      
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        const newIndex = Math.min(currentIndex + 1, totalSteps - 1);
        selectStep(newIndex);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        const newIndex = Math.max(currentIndex - 1, 0);
        selectStep(newIndex);
      } else if (e.key === "Home") {
        e.preventDefault();
        selectStep(0);
      } else if (e.key === "End") {
        e.preventDefault();
        selectStep(totalSteps - 1);
      }
    },
    [disabled, currentStepIndex, totalSteps, selectStep]
  );

  // Global mouse/touch listeners for smooth dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Skip if we just clicked a button directly (prevent override)
      // But allow dragging if user has moved mouse significantly (> 15px)
      if (justClickedButton) {
        if (initialClickPos.current) {
          const dx = Math.abs(e.clientX - initialClickPos.current.x);
          if (dx > 15) {
            // User is actually dragging, allow it
            setJustClickedButton(false);
            initialClickPos.current = null;
          } else {
            return; // Still just a click, ignore mousemove
          }
        } else {
          return;
        }
      }
      if (!trackRef.current) return;
      const stepIndex = getStepFromPosition(e.clientX);
      if (stepIndex !== null) {
        // Calculate the new value and compare against ref (avoids stale closure)
        const newValue = minValue + stepIndex * step;
        if (newValue !== latestValueRef.current) {
          selectStep(stepIndex);
        }
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setJustClickedButton(false);
      initialClickPos.current = null;
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (!trackRef.current || e.touches.length === 0) return;
      
      // Check if user has moved enough to start dragging
      if (justClickedButton && initialClickPos.current && e.touches[0]) {
        const dx = Math.abs(e.touches[0].clientX - initialClickPos.current.x);
        if (dx > 10) {
          setJustClickedButton(false);
          initialClickPos.current = null;
        } else {
          return; // Not enough movement yet
        }
      } else if (justClickedButton) {
        return;
      }
      
      e.preventDefault(); // Prevent scrolling
      const stepIndex = getStepFromPosition(e.touches[0].clientX);
      if (stepIndex !== null) {
        const newValue = minValue + stepIndex * step;
        if (newValue !== latestValueRef.current) {
          selectStep(stepIndex);
        }
      }
    };

    const handleGlobalTouchEnd = () => {
      setIsDragging(false);
      setJustClickedButton(false);
      initialClickPos.current = null;
    };

    // Add global listeners
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', handleGlobalTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isDragging, justClickedButton, getStepFromPosition, minValue, step, selectStep]);

  // Calculate progress percentage
  const progressPercent = currentStepIndex !== null
    ? (currentStepIndex / (totalSteps - 1)) * 100
    : 0;

  return (
    <div className="w-full space-y-4">
      {/* Question Header */}
      <div className="space-y-1">
        <h3 className="text-lg font-medium">{questionText}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Slider Track - now with drag support */}
      <div
        ref={containerRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-valuemin={minValue}
        aria-valuemax={maxValue}
        aria-valuenow={value}
        aria-label={questionText}
        aria-disabled={disabled}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative py-6 px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg select-none",
          disabled && "opacity-50 cursor-not-allowed",
          isDragging && "cursor-grabbing"
        )}
      >
        {/* Invisible touch/click area for track dragging - aligned with step indicators (px-2 = 8px each side) */}
        <div
          ref={trackRef}
          className={cn(
            "absolute top-1/2 left-2 right-2 h-16 -translate-y-1/2 cursor-grab active:cursor-grabbing z-10",
            isDragging && "cursor-grabbing"
          )}
          onClick={handleTrackClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={(e) => {
            if (disabled) return;
            initialClickPos.current = { x: e.clientX, y: e.clientY };
            setIsDragging(true);
          }}
          onMouseUp={() => {
            setIsDragging(false);
            setJustClickedButton(false);
            initialClickPos.current = null;
          }}
          onMouseLeave={() => {
            if (isDragging) {
              // Don't stop dragging on leave - global handler takes over
            }
          }}
        />

        {/* Background Track - extends from center of first to center of last circle */}
        <div className="absolute top-1/2 left-[calc(0.5rem+20px)] right-[calc(0.5rem+20px)] h-2 -translate-y-1/2 bg-zinc-700/60 rounded-full pointer-events-none">
          {/* Progress Track - inside the background track for accurate percentage */}
          <motion.div
            className={cn(
              "absolute top-0 left-0 h-full rounded-full",
              colorScheme === "reach" ? "bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500" : "bg-gradient-to-r from-violet-600 to-violet-400"
            )}
            initial={false}
            animate={{ 
              width: `${progressPercent}%`
            }}
            transition={{ 
              type: "spring", 
              stiffness: isDragging ? 500 : 300, 
              damping: isDragging ? 40 : 30 
            }}
          />
        </div>

        {/* Step Indicators */}
        <div className="relative flex justify-between px-2 pointer-events-none">
          {labels.map((label, index) => {
            const isActive = currentStepIndex !== null && index <= currentStepIndex;
            const isSelected = currentStepIndex === index;
            const isHovered = hoveredStep === index;

            return (
              <div
                key={`${questionId}-step-${index}`}
                className="relative flex flex-col items-center pointer-events-auto"
              >
                {/* Tooltip */}
                <AnimatePresence>
                  {showTooltip && (isSelected || isHovered) && !disabled && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute -top-10 px-2 py-1 text-xs font-medium bg-popover text-popover-foreground rounded shadow-lg border whitespace-nowrap z-20"
                    >
                      {minLabel && index === 0 && minLabel}
                      {maxLabel && index === totalSteps - 1 && maxLabel}
                      {!minLabel && index === 0 && "Min"}
                      {!maxLabel && index === totalSteps - 1 && "Max"}
                      {index > 0 && index < totalSteps - 1 && `Step ${label}`}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Step Button - now supports drag initiation */}
                <motion.button
                  type="button"
                  onMouseDown={(e) => {
                    if (disabled) return;
                    e.preventDefault();
                    e.stopPropagation(); // Prevent track handler from firing
                    selectStep(index); // Select this step immediately
                    setJustClickedButton(true); // Prevent mousemove from overriding
                    initialClickPos.current = { x: e.clientX, y: e.clientY }; // Track initial position for drag detection
                    setIsDragging(true); // Start drag mode for continued dragging
                  }}
                  onTouchStart={(e) => {
                    if (disabled) return;
                    e.stopPropagation();
                    selectStep(index);
                    setJustClickedButton(true);
                    if (e.touches[0]) {
                      initialClickPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                    }
                    setIsDragging(true);
                  }}
                  onMouseEnter={() => setHoveredStep(index)}
                  onMouseLeave={() => setHoveredStep(null)}
                  disabled={disabled}
                  className={cn(
                    "relative w-10 h-10 rounded-full border-2",
                    "flex items-center justify-center text-sm font-bold",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "touch-none cursor-grab active:cursor-grabbing",
                    // Smoother transitions for colors during drag
                    "transition-[border-color,background-color,color] duration-300 ease-out",
                    isSelected
                      ? "border-violet-600 bg-violet-600 text-white shadow-lg z-10 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]"
                      : isActive
                      ? cn(
                          "border-violet-500/70 bg-violet-500/90",
                          "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]"
                        )
                      : "border-zinc-600 bg-zinc-800 hover:border-violet-500/50 text-zinc-300",
                    disabled && "pointer-events-none"
                  )}
                  whileHover={disabled ? {} : { scale: isSelected ? 1.25 : 1.1 }}
                  whileTap={disabled ? {} : { scale: 0.95 }}
                  animate={{ 
                    scale: isSelected ? (isDragging ? 1.35 : 1.25) : 1,
                    boxShadow: isSelected 
                      ? (isDragging 
                          ? "0 10px 40px rgba(var(--primary-rgb), 0.4)" 
                          : "0 4px 20px rgba(var(--primary-rgb), 0.3)")
                      : "0 0 0 rgba(0,0,0,0)"
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30
                  }}
                >
                  {label}
                </motion.button>

                {/* Step Value Label (below) */}
                <span
                  className={cn(
                    "mt-2 text-xs font-medium transition-colors duration-200",
                    isSelected
                      ? "text-primary"
                      : isActive
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {minValue + index * step}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Min/Max Labels */}
      {(minLabel || maxLabel) && (
        <div className="flex justify-between text-sm text-muted-foreground px-2">
          <span>{minLabel || ""}</span>
          <span>{maxLabel || ""}</span>
        </div>
      )}

      {/* Selection Display */}
      <AnimatePresence mode="wait">
        {value !== undefined && (
          <motion.div
            key={value}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="text-center p-3 bg-muted/50 rounded-lg"
          >
            <span className="text-sm text-muted-foreground">Your selection: </span>
            <span className="font-bold text-primary text-lg">
              {labels[currentStepIndex ?? 0]} ({value})
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SliderQuestion;
