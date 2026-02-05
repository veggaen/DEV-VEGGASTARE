"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useDragControls, PanInfo } from "framer-motion";
import { Check, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchPair {
  id: string;
  left: { text: string; icon?: string };
  right: { text: string; icon?: string };
}

interface DragToMatchProps {
  pairs: MatchPair[];
  value?: Record<string, string>; // { leftId: rightId }
  onChange: (matches: Record<string, string>) => void;
  shuffleRight?: boolean;
  showFeedback?: boolean;
  instruction?: string;
}

interface DraggableItem {
  id: string;
  text: string;
  icon?: string;
  side: "left" | "right";
  originalIndex: number;
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function DragToMatch({
  pairs,
  value = {},
  onChange,
  shuffleRight = true,
  showFeedback = true,
  instruction = "Drag items from the left to match with the right",
}: DragToMatchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [hoveredTarget, setHoveredTarget] = useState<string | null>(null);
  const [rightItems, setRightItems] = useState<DraggableItem[]>([]);
  const [connections, setConnections] = useState<Array<{ from: string; to: string }>>([]);

  // Initialize right items (shuffled or in order)
  useEffect(() => {
    const items = pairs.map((pair, idx) => ({
      id: pair.id,
      text: pair.right.text,
      icon: pair.right.icon,
      side: "right" as const,
      originalIndex: idx,
    }));
    setRightItems(shuffleRight ? shuffleArray(items) : items);
  }, [pairs, shuffleRight]);

  // Track refs for line drawing
  const leftRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rightRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleMatch = useCallback(
    (leftId: string, rightId: string) => {
      const newMatches = { ...value };
      
      // Remove any existing match for this left item
      delete newMatches[leftId];
      
      // Remove any existing match pointing to this right item
      Object.keys(newMatches).forEach((key) => {
        if (newMatches[key] === rightId) {
          delete newMatches[key];
        }
      });
      
      // Add new match
      newMatches[leftId] = rightId;
      onChange(newMatches);
    },
    [value, onChange]
  );

  const isMatched = (id: string, side: "left" | "right") => {
    if (side === "left") {
      return id in value;
    }
    return Object.values(value).includes(id);
  };

  const isCorrectMatch = (leftId: string) => {
    return value[leftId] === leftId; // Assuming correct match has same ID
  };

  const getMatchedRight = (leftId: string) => value[leftId];

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Instruction */}
      <motion.p
        className="text-center text-sm text-muted-foreground"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {instruction}
      </motion.p>

      {/* Match Grid */}
      <div className="grid grid-cols-2 gap-8 relative">
        {/* SVG Lines for connections */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          style={{ overflow: "visible" }}
        >
          {Object.entries(value).map(([leftId, rightId]) => {
            const leftEl = leftRefs.current[leftId];
            const rightEl = rightRefs.current[rightId];
            if (!leftEl || !rightEl || !containerRef.current) return null;

            const containerRect = containerRef.current.getBoundingClientRect();
            const leftRect = leftEl.getBoundingClientRect();
            const rightRect = rightEl.getBoundingClientRect();

            const x1 = leftRect.right - containerRect.left;
            const y1 = leftRect.top + leftRect.height / 2 - containerRect.top;
            const x2 = rightRect.left - containerRect.left;
            const y2 = rightRect.top + rightRect.height / 2 - containerRect.top;

            const isCorrect = leftId === rightId;

            return (
              <motion.path
                key={`${leftId}-${rightId}`}
                d={`M ${x1} ${y1} C ${x1 + 40} ${y1}, ${x2 - 40} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={isCorrect ? "#10b981" : "#3b82f6"}
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ pathLength: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            );
          })}
        </svg>

        {/* Left Column */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-4">
            Drag from here
          </h4>
          {pairs.map((pair, idx) => {
            const matched = isMatched(pair.id, "left");
            return (
              <motion.div
                key={`left-${pair.id}`}
                ref={(el) => { leftRefs.current[pair.id] = el; }}
                className={cn(
                  "relative p-4 rounded-2xl cursor-grab active:cursor-grabbing",
                  "bg-white/80 dark:bg-white/5 backdrop-blur-xl",
                  "border-2 transition-all duration-200",
                  matched
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-white/20 dark:border-white/10 hover:border-primary/50",
                  activeItem === pair.id && "scale-105 shadow-xl z-20"
                )}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                drag
                dragConstraints={containerRef}
                dragElastic={0.1}
                onDragStart={() => setActiveItem(pair.id)}
                onDragEnd={(e, info) => {
                  setActiveItem(null);
                  // Check if dropped on a right item
                  if (hoveredTarget) {
                    handleMatch(pair.id, hoveredTarget);
                  }
                  setHoveredTarget(null);
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-3">
                  {pair.left.icon && <span className="text-2xl">{pair.left.icon}</span>}
                  <span className="font-medium">{pair.left.text}</span>
                </div>
                {matched && (
                  <motion.div
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    <Check className="w-4 h-4 text-white" />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Right Column (Drop Targets) */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-4">
            Drop here to match
          </h4>
          {rightItems.map((item, idx) => {
            const matched = isMatched(item.id, "right");
            const isHovered = hoveredTarget === item.id && activeItem !== null;

            return (
              <motion.div
                key={`right-${item.id}`}
                ref={(el) => { rightRefs.current[item.id] = el; }}
                className={cn(
                  "relative p-4 rounded-2xl transition-all duration-200",
                  "border-2 border-dashed",
                  matched
                    ? "bg-emerald-500/10 border-emerald-500/50"
                    : isHovered
                    ? "bg-primary/10 border-primary scale-105"
                    : "bg-muted/30 border-muted-foreground/30 hover:border-primary/50"
                )}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 + 0.1 }}
                onPointerEnter={() => activeItem && setHoveredTarget(item.id)}
                onPointerLeave={() => setHoveredTarget(null)}
              >
                <div className="flex items-center gap-3">
                  {item.icon && <span className="text-2xl">{item.icon}</span>}
                  <span className="font-medium">{item.text}</span>
                </div>
                
                {/* Drop indicator */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      className="absolute inset-0 rounded-2xl bg-primary/20 flex items-center justify-center"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <Sparkles className="w-6 h-6 text-primary" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Progress indicator */}
      <motion.div
        className="flex justify-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {pairs.map((pair) => (
          <motion.div
            key={pair.id}
            className={cn(
              "w-3 h-3 rounded-full transition-colors",
              value[pair.id] ? "bg-emerald-500" : "bg-muted"
            )}
            animate={{ scale: value[pair.id] ? 1.2 : 1 }}
          />
        ))}
      </motion.div>
    </div>
  );
}

export default DragToMatch;
