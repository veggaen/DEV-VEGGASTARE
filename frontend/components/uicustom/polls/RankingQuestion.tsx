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
      {/* Drag handle */}
      <div
        className={cn(
          "shrink-0 touch-none cursor-grab active:cursor-grabbing",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onPointerDown={(e) => !disabled && dragControls.start(e)}
      >
        <GripVertical className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* Rank indicator */}
      {showRankNumbers && (
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm",
          medal ? cn(medal.bg, medal.color) : "bg-muted text-muted-foreground"
        )}>
          {medal && MedalIcon ? (
            <MedalIcon className="w-4 h-4" />
          ) : (
            index + 1
          )}
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
    "flex items-center gap-3 select-none transition-colors",
    variant === "cards" && "p-4 rounded-xl border bg-card hover:bg-muted/50",
    variant === "default" && "p-3 rounded-lg border bg-card/50 hover:bg-muted/50",
    variant === "compact" && "p-2 rounded-md bg-muted/30 hover:bg-muted/50",
    disabled && "opacity-60"
  );

  return (
    <Reorder.Item
      value={option.id}
      dragListener={false}
      dragControls={dragControls}
      className={itemClasses}
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
          Drag to reorder • Top = highest priority
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

      {/* Current ranking summary */}
      {showMedals && visibleOptions.length >= 3 && (
        <div className="flex items-center justify-center gap-4 pt-2 border-t">
          {visibleOptions.slice(0, 3).map((option, idx) => {
            const medal = MEDAL_CONFIG[idx];
            const MedalIcon = medal.icon;
            return (
              <div
                key={option.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
                  medal.bg, medal.color
                )}
              >
                <MedalIcon className="w-4 h-4" />
                <span className="font-medium truncate max-w-[100px]">
                  {option.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RankingQuestion;
