"use client";

import { useState, useCallback } from "react";
import { motion, Reorder, useDragControls } from "framer-motion";
import { cn } from "@/lib/utils";
import { GripVertical, Trophy, Medal, Award, ArrowUp, ArrowDown } from "lucide-react";
import Image from "next/image";

// ─────────────────────────────────────────────────────────────────────────────
// RANKING QUESTION COMPONENT
// Used for: Priority ordering, preference ranking, feature prioritization
// ─────────────────────────────────────────────────────────────────────────────

export interface RankingOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
}

interface RankingQuestionProps {
  questionId: string;
  questionText: string;
  description?: string;
  options: RankingOption[];
  value?: string[]; // Ordered array of option IDs
  onChange: (value: string[]) => void;
  disabled?: boolean;
  showRankNumbers?: boolean;
  showMedals?: boolean;
  maxVisible?: number; // For "Top N" rankings
  variant?: "default" | "cards" | "compact";
}

// Medal colors for top 3
const MEDAL_CONFIG = [
  { icon: Trophy, color: "text-amber-400", bg: "bg-amber-500/20", label: "1st" },
  { icon: Medal, color: "text-slate-400", bg: "bg-slate-500/20", label: "2nd" },
  { icon: Award, color: "text-amber-600", bg: "bg-amber-600/20", label: "3rd" },
];

interface RankingItemProps {
  option: RankingOption;
  index: number;
  total: number;
  showRankNumbers: boolean;
  showMedals: boolean;
  disabled: boolean;
  variant: "default" | "cards" | "compact";
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

function RankingItem({
  option,
  index,
  total,
  showRankNumbers,
  showMedals,
  disabled,
  variant,
  onMoveUp,
  onMoveDown,
}: RankingItemProps) {
  const dragControls = useDragControls();
  const medal = showMedals && index < 3 ? MEDAL_CONFIG[index] : null;
  const MedalIcon = medal?.icon;

  const content = (
    <>
      {/* Drag handle indicator */}
      <div className="shrink-0 text-muted-foreground">
        <GripVertical className="w-5 h-5" />
      </div>

      {/* Rank indicator - always show number, with medal icon for top 3 */}
      {showRankNumbers && (
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm",
          medal ? cn(medal.bg, medal.color) : "bg-muted text-muted-foreground"
        )}>
          {index + 1}
        </div>
      )}

      {/* Icon/Image */}
      {option.icon && (
        <span className="text-xl shrink-0">{option.icon}</span>
      )}
      {option.imageUrl && (
        <Image
          src={option.imageUrl}
          alt={option.label}
          width={40}
          height={40}
          className="rounded-lg object-cover shrink-0"
        />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{option.label}</div>
        {option.description && variant !== "compact" && (
          <div className="text-sm text-muted-foreground truncate">
            {option.description}
          </div>
        )}
      </div>

      {/* Manual reorder buttons (for accessibility) */}
      {!disabled && variant !== "compact" && (
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp?.();
            }}
            disabled={index === 0}
            className={cn(
              "p-1 rounded hover:bg-muted transition-colors",
              index === 0 && "opacity-30 cursor-not-allowed"
            )}
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown?.();
            }}
            disabled={index === total - 1}
            className={cn(
              "p-1 rounded hover:bg-muted transition-colors",
              index === total - 1 && "opacity-30 cursor-not-allowed"
            )}
          >
            <ArrowDown className="w-3 h-3" />
          </button>
        </div>
      )}
    </>
  );

  const itemClasses = cn(
    "flex items-center gap-3 select-none transition-colors touch-none cursor-grab active:cursor-grabbing",
    variant === "cards" && "p-4 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border-none shadow-md",
    variant === "default" && "p-3 rounded-lg bg-zinc-800/70 hover:bg-zinc-700/70 border-none shadow-sm",
    variant === "compact" && "p-2 rounded-md bg-zinc-800/50 hover:bg-zinc-700/50 border-none",
    disabled && "opacity-60 cursor-not-allowed"
  );

  return (
    <Reorder.Item
      value={option.id}
      dragListener={false}
      dragControls={dragControls}
      className={itemClasses}
      onPointerDown={(e: React.PointerEvent) => !disabled && dragControls.start(e)}
      whileDrag={{
        scale: 1.02,
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        zIndex: 50,
      }}
    >
      {content}
    </Reorder.Item>
  );
}

export function RankingQuestion({
  questionId,
  questionText,
  description,
  options,
  value,
  onChange,
  disabled = false,
  showRankNumbers = true,
  showMedals = true,
  maxVisible,
  variant = "default",
}: RankingQuestionProps) {
  // Initialize with provided value or default order
  const [orderedIds, setOrderedIds] = useState<string[]>(
    value || options.map((o) => o.id)
  );

  const handleReorder = useCallback((newOrder: string[]) => {
    setOrderedIds(newOrder);
    onChange(newOrder);
  }, [onChange]);

  const moveItem = useCallback((fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= orderedIds.length) return;
    
    const newOrder = [...orderedIds];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    
    setOrderedIds(newOrder);
    onChange(newOrder);
  }, [orderedIds, onChange]);

  // Get options in current order
  const orderedOptions = orderedIds
    .map((id) => options.find((o) => o.id === id))
    .filter(Boolean) as RankingOption[];

  // Apply maxVisible if set
  const visibleOptions = maxVisible
    ? orderedOptions.slice(0, maxVisible)
    : orderedOptions;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="font-semibold text-lg">{questionText}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <GripVertical className="w-3 h-3" />
          Drag items to reorder • Top = highest priority
        </p>
      </div>

      {/* Ranking list */}
      <Reorder.Group
        axis="y"
        values={orderedIds}
        onReorder={handleReorder}
        className="space-y-2"
      >
        {visibleOptions.map((option, index) => (
          <RankingItem
            key={option.id}
            option={option}
            index={index}
            total={visibleOptions.length}
            showRankNumbers={showRankNumbers}
            showMedals={showMedals}
            disabled={disabled}
            variant={variant}
            onMoveUp={() => moveItem(index, index - 1)}
            onMoveDown={() => moveItem(index, index + 1)}
          />
        ))}
      </Reorder.Group>

      {/* Hidden items indicator */}
      {maxVisible && orderedOptions.length > maxVisible && (
        <div className="text-sm text-muted-foreground text-center py-2 border-t">
          {orderedOptions.length - maxVisible} more items below the cutoff
        </div>
      )}

      {/* Current podium summary - shows top 3 at a glance */}
      {showMedals && visibleOptions.length >= 3 && (
        <div className="mt-4 pt-3 border-t border-zinc-800/50">
          <p className="text-xs text-muted-foreground text-center mb-2">Your Top 3 (drag to reorder)</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            {visibleOptions.slice(0, 3).map((option, idx) => {
              const medal = MEDAL_CONFIG[idx];
              const ordinals = ['1st', '2nd', '3rd'];
              return (
                <div
                  key={option.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs",
                    medal.bg, medal.color
                  )}
                >
                  <span className="font-bold shrink-0">{ordinals[idx]}</span>
                  <span className="font-medium">{option.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default RankingQuestion;
