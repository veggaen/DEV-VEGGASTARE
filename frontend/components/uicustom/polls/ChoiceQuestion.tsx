"use client";

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";
import Image from "next/image";

interface ChoiceOption {
  id: string;
  text: string;
  description?: string;
  imageUrl?: string;
}

interface ChoiceQuestionProps {
  questionId: string;
  questionText: string;
  description?: string;
  options: ChoiceOption[];
  selectedValue?: string | string[];
  onChange: (value: string | string[]) => void;
  multiSelect?: boolean;
  maxSelections?: number;
  disabled?: boolean;
  showLabels?: boolean; // Show A, B, C, D labels
  layout?: "horizontal" | "vertical" | "grid";
  variant?: "default" | "card" | "minimal";
}

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function ChoiceQuestion({
  questionId,
  questionText,
  description,
  options,
  selectedValue,
  onChange,
  multiSelect = false,
  maxSelections,
  disabled = false,
  showLabels = true,
  layout = "vertical",
  variant = "default",
}: ChoiceQuestionProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Normalize selected value to array for easier handling
  const selectedArray = useMemo(() => {
    if (Array.isArray(selectedValue)) return selectedValue;
    if (selectedValue) return [selectedValue];
    return [];
  }, [selectedValue]);

  const isSelected = (optionId: string) => selectedArray.includes(optionId);

  const canSelectMore =
    !maxSelections || selectedArray.length < maxSelections;

  // Handle option selection
  const handleSelect = useCallback(
    (optionId: string) => {
      if (disabled) return;

      const optionIsSelected = selectedArray.includes(optionId);

      if (multiSelect) {
        if (optionIsSelected) {
          // Deselect
          const newSelection = selectedArray.filter((id) => id !== optionId);
          onChange(newSelection);
        } else if (canSelectMore) {
          // Select
          onChange([...selectedArray, optionId]);
        }
      } else {
        // Single select - toggle or select
        if (optionIsSelected) {
          onChange("");
        } else {
          onChange(optionId);
        }
      }
    },
    [disabled, multiSelect, selectedArray, canSelectMore, onChange]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (disabled) return;

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelect(options[index].id);
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const nextIndex = (index + 1) % options.length;
        setFocusedIndex(nextIndex);
        document.getElementById(`${questionId}-option-${nextIndex}`)?.focus();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const prevIndex = (index - 1 + options.length) % options.length;
        setFocusedIndex(prevIndex);
        document.getElementById(`${questionId}-option-${prevIndex}`)?.focus();
      }
    },
    [disabled, options, questionId, handleSelect]
  );

  // Layout classes
  const layoutClasses = {
    horizontal: "flex flex-wrap gap-3",
    vertical: "flex flex-col gap-3",
    grid: "grid grid-cols-2 gap-3",
  };

  // Variant styles
  const getOptionStyles = (isActive: boolean, index: number) => {
    const baseStyles =
      "relative flex items-center gap-3 transition-all duration-200 cursor-pointer outline-none";

    if (variant === "card") {
      return cn(
        baseStyles,
        "p-4 rounded-xl border-2",
        isActive
          ? "border-primary bg-primary/10 shadow-md"
          : "border-border hover:border-primary/50 hover:bg-muted/50",
        disabled && "opacity-50 cursor-not-allowed"
      );
    }

    if (variant === "minimal") {
      return cn(
        baseStyles,
        "px-4 py-2 rounded-lg",
        isActive
          ? "bg-primary text-primary-foreground"
          : "bg-muted hover:bg-muted/80",
        disabled && "opacity-50 cursor-not-allowed"
      );
    }

    // Default variant
    return cn(
      baseStyles,
      "p-3 rounded-lg border",
      isActive
        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
        : "border-border hover:border-primary/30 hover:bg-muted/30",
      disabled && "opacity-50 cursor-not-allowed"
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* Question Header */}
      <div className="space-y-1">
        <h3 className="text-lg font-medium">{questionText}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {multiSelect && maxSelections && (
          <p className="text-xs text-muted-foreground">
            Select up to {maxSelections} option{maxSelections > 1 ? "s" : ""} (
            {selectedArray.length}/{maxSelections} selected)
          </p>
        )}
      </div>

      {/* Options */}
      <div
        role={multiSelect ? "group" : "radiogroup"}
        aria-label={questionText}
        className={layoutClasses[layout]}
      >
        {options.map((option, index) => {
          const isActive = isSelected(option.id);
          const label = OPTION_LABELS[index] || String(index + 1);

          return (
            <motion.div
              key={option.id}
              id={`${questionId}-option-${index}`}
              role={multiSelect ? "checkbox" : "radio"}
              aria-checked={isActive}
              aria-disabled={disabled || (!canSelectMore && !isActive)}
              tabIndex={disabled ? -1 : 0}
              onClick={() => handleSelect(option.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(null)}
              className={getOptionStyles(isActive, index)}
              whileHover={disabled ? {} : { scale: 1.02 }}
              whileTap={disabled ? {} : { scale: 0.98 }}
              initial={false}
              animate={{
                backgroundColor: isActive
                  ? "var(--primary-5)"
                  : "transparent",
              }}
            >
              {/* Label Badge */}
              {showLabels && (
                <motion.div
                  className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                  animate={{
                    scale: isActive ? 1.1 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  {isActive && multiSelect ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    label
                  )}
                </motion.div>
              )}

              {/* Option Content */}
              <div className="flex-1 min-w-0">
                {option.imageUrl && (
                  <div className="mb-2 rounded-lg overflow-hidden relative h-24">
                    <Image
                      src={option.imageUrl}
                      alt={option.text}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                )}
                <span
                  className={cn(
                    "block text-sm font-medium",
                    isActive ? "text-primary" : "text-foreground"
                  )}
                >
                  {option.text}
                </span>
                {option.description && (
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {option.description}
                  </span>
                )}
              </div>

              {/* Selection Indicator */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="flex-shrink-0"
                  >
                    {multiSelect ? (
                      <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Selection Summary */}
      <AnimatePresence mode="wait">
        {selectedArray.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">Selected: </span>
              <span className="font-medium text-primary">
                {selectedArray
                  .map((id) => {
                    const optIndex = options.findIndex((o) => o.id === id);
                    const opt = options[optIndex];
                    const label = OPTION_LABELS[optIndex];
                    return showLabels ? `${label}. ${opt?.text}` : opt?.text;
                  })
                  .join(", ")}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ChoiceQuestion;
