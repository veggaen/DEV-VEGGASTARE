"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface VisualSliderProps {
  value?: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
  showValue?: boolean;
  showPreview?: boolean;
  previewType?: "bar" | "circle" | "emoji";
  emojis?: string[];
  colors?: { from: string; to: string };
  instruction?: string;
}

const DEFAULT_EMOJIS = ["😞", "😕", "😐", "🙂", "😊", "🤩"];

export function VisualSlider({
  value,
  onChange,
  min = 1,
  max = 5,
  step = 1,
  minLabel,
  maxLabel,
  showValue = true,
  showPreview = true,
  previewType = "circle",
  emojis = DEFAULT_EMOJIS,
  colors = { from: "#ef4444", to: "#22c55e" },
  instruction,
}: VisualSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Local state for immediate visual feedback during drag
  const [localValue, setLocalValue] = useState<number | null>(null);
  
  // Use local value during drag for immediate feedback, otherwise use prop
  const currentValue = localValue ?? value ?? min;
  const percentage = ((currentValue - min) / (max - min)) * 100;
  const steps = Math.floor((max - min) / step) + 1;
  
  // Sync local value with prop when not dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(null);
    }
  }, [isDragging, value]);
  
  // Get current color based on percentage
  const getCurrentColor = useCallback(() => {
    const r1 = parseInt(colors.from.slice(1, 3), 16);
    const g1 = parseInt(colors.from.slice(3, 5), 16);
    const b1 = parseInt(colors.from.slice(5, 7), 16);
    const r2 = parseInt(colors.to.slice(1, 3), 16);
    const g2 = parseInt(colors.to.slice(3, 5), 16);
    const b2 = parseInt(colors.to.slice(5, 7), 16);
    
    const r = Math.round(r1 + (r2 - r1) * (percentage / 100));
    const g = Math.round(g1 + (g2 - g1) * (percentage / 100));
    const b = Math.round(b1 + (b2 - b1) * (percentage / 100));
    
    return `rgb(${r}, ${g}, ${b})`;
  }, [percentage, colors]);

  // Calculate value from pointer position
  const calculateValueFromPointer = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return currentValue;
      const rect = trackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      const rawValue = min + pct * (max - min);
      const steppedValue = Math.round(rawValue / step) * step;
      return Math.max(min, Math.min(max, steppedValue));
    },
    [min, max, step, currentValue]
  );

  // Handle pointer down on track or thumb
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      const newValue = calculateValueFromPointer(e.clientX);
      setLocalValue(newValue); // Update local value immediately
      onChange(newValue);
    },
    [calculateValueFromPointer, onChange]
  );

  // Handle pointer move while dragging
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const newValue = calculateValueFromPointer(e.clientX);
      setLocalValue(newValue); // Update local value immediately
      onChange(newValue);
    },
    [isDragging, calculateValueFromPointer, onChange]
  );

  // Handle pointer up
  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setLocalValue(null); // Clear local value, use prop value
  }, []);

  // Get emoji for current value
  const getCurrentEmoji = useCallback(() => {
    const index = Math.min(
      Math.floor(((currentValue - min) / (max - min)) * emojis.length),
      emojis.length - 1
    );
    return emojis[Math.max(0, index)];
  }, [currentValue, min, max, emojis]);

  return (
    <div className="space-y-6">
      {/* Instruction */}
      {instruction && (
        <motion.p
          className="text-center text-sm text-muted-foreground"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {instruction}
        </motion.p>
      )}

      {/* Visual Preview */}
      {showPreview && (
        <motion.div
          className="flex justify-center mb-8"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          {previewType === "circle" && (
            <motion.div
              className="relative w-32 h-32 rounded-full flex items-center justify-center"
              style={{
                background: `conic-gradient(${getCurrentColor()} ${percentage}%, transparent ${percentage}%)`,
              }}
              animate={{ rotate: isDragging ? [0, 5, -5, 0] : 0 }}
            >
              <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center">
                <motion.span
                  className="text-5xl"
                  animate={{ scale: isDragging ? 1.2 : 1 }}
                  transition={{ type: "spring" }}
                >
                  {getCurrentEmoji()}
                </motion.span>
              </div>
            </motion.div>
          )}

          {previewType === "bar" && (
            <div className="w-full max-w-xs space-y-2">
              <div className="h-16 rounded-2xl bg-muted overflow-hidden relative">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-2xl"
                  style={{
                    background: `linear-gradient(90deg, ${colors.from}, ${getCurrentColor()})`,
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
                <motion.span
                  className="absolute inset-0 flex items-center justify-center text-4xl"
                  animate={{ scale: isDragging ? 1.2 : 1 }}
                >
                  {getCurrentEmoji()}
                </motion.span>
              </div>
            </div>
          )}

          {previewType === "emoji" && (
            <div className="flex gap-2">
              {emojis.map((emoji, idx) => {
                const emojiValue = min + (idx / (emojis.length - 1)) * (max - min);
                const isSelected = currentValue >= emojiValue;
                const isExact = Math.abs(currentValue - emojiValue) < step / 2;

                return (
                  <motion.button
                    key={idx}
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
                      "transition-all duration-200",
                      isExact
                        ? "bg-primary text-primary-foreground scale-125"
                        : isSelected
                        ? "bg-primary/20"
                        : "bg-muted/50"
                    )}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onChange(Math.round(emojiValue))}
                  >
                    {emoji}
                  </motion.button>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* Value Display */}
      {showValue && previewType !== "emoji" && (
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.span
            className="text-5xl font-bold"
            style={{ color: getCurrentColor() }}
            animate={{ scale: isDragging ? 1.1 : 1 }}
          >
            {currentValue}
          </motion.span>
          <span className="text-2xl text-muted-foreground">/{max}</span>
        </motion.div>
      )}

      {/* Slider Track - handles all pointer events */}
      <div className="px-4">
        <div
          ref={trackRef}
          className={cn(
            "relative h-4 rounded-full bg-muted cursor-pointer touch-none select-none",
            isDragging && "cursor-grabbing"
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={isDragging ? undefined : handlePointerUp}
        >
          {/* Filled track */}
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full pointer-events-none"
            style={{
              background: `linear-gradient(90deg, ${colors.from}, ${getCurrentColor()})`,
              width: `${percentage}%`,
            }}
            initial={false}
            animate={{ width: `${percentage}%` }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
          />

          {/* Step markers */}
          <div className="absolute inset-0 flex justify-between items-center pointer-events-none">
            {Array.from({ length: steps }).map((_, idx) => {
              const stepValue = min + idx * step;
              const isActive = currentValue >= stepValue;
              return (
                <div
                  key={idx}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    isActive ? "bg-white" : "bg-muted-foreground/30"
                  )}
                />
              );
            })}
          </div>

          {/* Thumb - purely visual, positioned by percentage */}
          <motion.div
            className={cn(
              "absolute top-1/2 w-8 h-8 rounded-full pointer-events-none",
              "bg-white shadow-xl border-4",
              "flex items-center justify-center",
              isDragging ? "cursor-grabbing" : "cursor-grab"
            )}
            style={{
              borderColor: getCurrentColor(),
              // Position thumb so its center is at the percentage point
              left: `calc(${percentage}% - 16px)`,
              y: "-50%",
            }}
            initial={false}
            animate={{
              scale: isDragging ? 1.15 : 1,
              boxShadow: isDragging
                ? `0 0 20px 4px ${getCurrentColor()}40`
                : "0 4px 12px rgba(0,0,0,0.15)",
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <span className="text-sm">{getCurrentEmoji()}</span>
          </motion.div>
        </div>
      </div>

      {/* Labels */}
      {(minLabel || maxLabel) && (
        <div className="flex justify-between text-sm px-4">
          <span className="text-muted-foreground">{minLabel}</span>
          <span className="text-muted-foreground">{maxLabel}</span>
        </div>
      )}
    </div>
  );
}

export default VisualSlider;
