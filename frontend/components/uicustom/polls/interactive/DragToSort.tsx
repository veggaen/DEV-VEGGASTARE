"use client";

import { useState, useCallback } from "react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { GripVertical, Trophy, Medal, Award, MoveVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortItem {
  id: string;
  text: string;
  icon?: string;
  description?: string;
}

interface DragToSortProps {
  items: SortItem[];
  value?: string[];
  onChange: (order: string[]) => void;
  showMedals?: boolean;
  maxItems?: number;
  instruction?: string;
}

function SortableItem({
  item,
  index,
  showMedals,
  onDragStart,
  onDragEnd,
}: {
  item: SortItem;
  index: number;
  showMedals: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const getMedalIcon = (idx: number) => {
    if (!showMedals) return null;
    if (idx === 0) return <Trophy className="w-5 h-5 text-amber-500" />;
    if (idx === 1) return <Medal className="w-5 h-5 text-zinc-400" />;
    if (idx === 2) return <Award className="w-5 h-5 text-amber-700" />;
    return (
      <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-muted-foreground">
        {idx + 1}
      </span>
    );
  };

  return (
    <Reorder.Item
      value={item.id}
      id={item.id}
      onDragStart={() => {
        setIsDragging(true);
        onDragStart();
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onDragEnd();
      }}
      // Smooth spring animation for reordering
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
      }}
      // Layout animation for smooth position changes
      layout
      layoutId={item.id}
      // Styling
      className={cn(
        "relative flex items-center gap-3 p-4 rounded-2xl select-none",
        "bg-white/90 dark:bg-zinc-800/90 backdrop-blur-xl",
        "border-2 transition-colors duration-200",
        isDragging 
          ? "border-primary/50 cursor-grabbing z-50" 
          : "border-transparent hover:border-primary/20 cursor-grab",
        "shadow-lg"
      )}
      style={{
        touchAction: "none", // Important for touch devices
      }}
      // Drag visual states
      whileDrag={{
        scale: 1.03,
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
        cursor: "grabbing",
      }}
      // Enter animation
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        boxShadow: isDragging 
          ? "0 25px 50px -12px rgba(0, 0, 0, 0.35)" 
          : "0 4px 12px rgba(0, 0, 0, 0.08)"
      }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      {/* Drag indicator - visual only */}
      <motion.div 
        className={cn(
          "shrink-0 p-1.5 rounded-lg transition-colors",
          isDragging 
            ? "bg-primary/20 text-primary" 
            : "text-muted-foreground/50 hover:text-muted-foreground"
        )}
        animate={{ 
          scale: isDragging ? 1.1 : 1,
          rotate: isDragging ? [0, -5, 5, 0] : 0 
        }}
        transition={{ duration: 0.3 }}
      >
        <MoveVertical className="w-4 h-4" />
      </motion.div>

      {/* Rank Medal/Number */}
      <motion.div 
        className={cn(
          "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
          index === 0 
            ? "bg-linear-to-br from-amber-400/20 to-amber-600/20" 
            : "bg-muted/50"
        )}
        layout
      >
        {getMedalIcon(index)}
      </motion.div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {item.icon && <span className="text-xl">{item.icon}</span>}
          <span className="font-semibold text-foreground">{item.text}</span>
        </div>
        {item.description && (
          <p className="text-sm text-muted-foreground mt-0.5 truncate">{item.description}</p>
        )}
      </div>

      {/* Position badge */}
      <motion.div 
        className={cn(
          "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
          index === 0 
            ? "bg-linear-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/30" 
            : "bg-muted text-muted-foreground"
        )}
        layout
        animate={{
          scale: isDragging ? 1.1 : 1,
        }}
      >
        {index + 1}
      </motion.div>

      {/* Drag overlay glow effect */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            className="absolute inset-0 rounded-2xl bg-linear-to-r from-primary/5 to-primary/10 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}

export function DragToSort({
  items,
  value,
  onChange,
  showMedals = true,
  maxItems,
  instruction = "Drag to reorder — top = most important",
}: DragToSortProps) {
  const [isDragging, setIsDragging] = useState(false);

  // Use provided value or default to original order
  const orderedIds = value || items.map((i) => i.id);
  const orderedItems = orderedIds
    .map((id) => items.find((i) => i.id === id))
    .filter(Boolean) as SortItem[];

  const handleReorder = useCallback(
    (newOrder: string[]) => {
      onChange(newOrder);
    },
    [onChange]
  );

  return (
    <div className="space-y-4">
      {/* Instruction */}
      <motion.p
        className="text-center text-sm text-muted-foreground"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {instruction}
      </motion.p>

      {/* Visual hint */}
      <motion.div
        className="flex justify-center items-center gap-3 text-xs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <span className="flex items-center gap-1.5 text-amber-500">
          <Trophy className="w-3.5 h-3.5" /> 
          <span className="font-medium">Most important</span>
        </span>
        <span className="text-muted-foreground/50">→</span>
        <span className="text-muted-foreground">Least important</span>
      </motion.div>

      {/* Drag instruction hint */}
      <motion.p
        className="text-center text-xs text-muted-foreground/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Click and hold anywhere on an item, then drag up or down
      </motion.p>

      {/* Sortable List */}
      <Reorder.Group
        axis="y"
        values={orderedIds}
        onReorder={handleReorder}
        className="space-y-2"
        layoutScroll
      >
        {orderedItems.slice(0, maxItems).map((item, index) => (
          <SortableItem
            key={item.id}
            item={item}
            index={index}
            showMedals={showMedals}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
          />
        ))}
      </Reorder.Group>

      {/* Fixed height placeholder for drag feedback - prevents layout shift */}
      <div className="h-8 flex items-center justify-center">
        <AnimatePresence>
          {isDragging && (
            <motion.span
              className="text-xs text-primary font-medium"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
            >
              ✨ Drop to set new position
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default DragToSort;
