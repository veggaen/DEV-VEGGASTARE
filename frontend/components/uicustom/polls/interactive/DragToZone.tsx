"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useDragControls, PanInfo } from "framer-motion";
import { Check, X, Target, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DragItem {
  id: string;
  text: string;
  icon?: string;
}

interface DropZone {
  id: string;
  label: string;
  accepts: string[]; // IDs of items that belong here
  color: string;
}

interface DragToZoneProps {
  items: DragItem[];
  zones: DropZone[];
  value?: Record<string, string>; // { itemId: zoneId }
  onChange: (placements: Record<string, string>) => void;
  showFeedback?: boolean;
  instruction?: string;
}

export function DragToZone({
  items,
  zones,
  value = {},
  onChange,
  showFeedback = false,
  instruction = "Drag each item to where you think it belongs",
}: DragToZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const zoneRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Items not yet placed
  const unplacedItems = items.filter((item) => !value[item.id]);

  const handleDrop = useCallback(
    (itemId: string, zoneId: string | null) => {
      const newPlacements = { ...value };
      if (zoneId) {
        newPlacements[itemId] = zoneId;
      } else {
        delete newPlacements[itemId];
      }
      onChange(newPlacements);
    },
    [value, onChange]
  );

  const checkDropZone = useCallback(
    (x: number, y: number): string | null => {
      if (!containerRef.current) return null;

      for (const [zoneId, ref] of Object.entries(zoneRefs.current)) {
        if (!ref) continue;
        const rect = ref.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return zoneId;
        }
      }
      return null;
    },
    []
  );

  const getItemsInZone = (zoneId: string) => {
    return items.filter((item) => value[item.id] === zoneId);
  };

  const isCorrectPlacement = (itemId: string, zoneId: string) => {
    const zone = zones.find((z) => z.id === zoneId);
    return zone?.accepts.includes(itemId) ?? false;
  };

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

      {/* Drop Zones */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {zones.map((zone, idx) => {
          const zoneItems = getItemsInZone(zone.id);
          const isHovered = hoveredZone === zone.id && activeItem !== null;

          return (
            <motion.div
              key={zone.id}
              ref={(el) => { zoneRefs.current[zone.id] = el; }}
              className={cn(
                "relative min-h-[160px] p-4 rounded-3xl",
                "border-2 border-dashed transition-all duration-200",
                isHovered
                  ? "border-primary bg-primary/10 scale-[1.02]"
                  : "border-muted-foreground/30 bg-muted/20"
              )}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              onPointerEnter={() => activeItem && setHoveredZone(zone.id)}
              onPointerLeave={() => setHoveredZone(null)}
              style={{
                background: isHovered
                  ? `linear-gradient(135deg, ${zone.color}10, ${zone.color}05)`
                  : undefined,
              }}
            >
              {/* Zone Label */}
              <div
                className="text-center mb-3 pb-2 border-b"
                style={{ borderColor: `${zone.color}40` }}
              >
                <span
                  className="text-sm font-semibold"
                  style={{ color: zone.color }}
                >
                  {zone.label}
                </span>
              </div>

              {/* Items in this zone */}
              <div className="flex flex-wrap gap-2 justify-center relative">
                <AnimatePresence>
                  {zoneItems.map((item) => {
                    const isCorrect = showFeedback && isCorrectPlacement(item.id, zone.id);
                    return (
                      <motion.div
                        key={item.id}
                        className={cn(
                          "relative px-3 py-2 rounded-xl cursor-grab active:cursor-grabbing",
                          "bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm",
                          "border shadow-sm",
                          showFeedback
                            ? isCorrect
                              ? "border-emerald-500 bg-emerald-500/10"
                              : "border-rose-500 bg-rose-500/10"
                            : "border-white/20 dark:border-white/10"
                        )}
                        style={{
                          zIndex: activeItem === item.id ? 9999 : 1,
                        }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        drag
                        dragSnapToOrigin
                        dragMomentum={false}
                        onDragStart={() => setActiveItem(item.id)}
                        onDragEnd={(e, info) => {
                          setActiveItem(null);
                          const dropZone = checkDropZone(
                            info.point.x,
                            info.point.y
                          );
                          if (dropZone && dropZone !== zone.id) {
                            handleDrop(item.id, dropZone);
                          } else if (!dropZone) {
                            // Dropped outside any zone, remove placement
                            handleDrop(item.id, null);
                          }
                          // If dropped back in same zone, dragSnapToOrigin handles the snap-back
                          setHoveredZone(null);
                        }}
                        layout
                      >
                        <div className="flex items-center gap-2">
                          {item.icon && <span>{item.icon}</span>}
                          <span className="text-sm font-medium">{item.text}</span>
                        </div>
                        {showFeedback && (
                          <motion.div
                            className={cn(
                              "absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center",
                              isCorrect ? "bg-emerald-500" : "bg-rose-500"
                            )}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                          >
                            {isCorrect ? (
                              <Check className="w-3 h-3 text-white" />
                            ) : (
                              <X className="w-3 h-3 text-white" />
                            )}
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Empty state */}
                {zoneItems.length === 0 && (
                  <motion.div
                    className="text-center text-muted-foreground text-sm py-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                  >
                    <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Drop items here
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Unplaced Items Pool */}
      {unplacedItems.length > 0 && (
        <motion.div
          className="p-4 rounded-3xl bg-muted/30 border border-dashed border-muted-foreground/20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-xs text-muted-foreground text-center mb-3">
            Items to categorize
          </p>
          <div className="flex flex-wrap gap-3 justify-center relative">
            {unplacedItems.map((item, idx) => (
              <motion.div
                key={item.id}
                className={cn(
                  "px-4 py-2 rounded-xl cursor-grab active:cursor-grabbing",
                  "bg-white/80 dark:bg-white/5 backdrop-blur-xl",
                  "border border-white/20 dark:border-white/10",
                  "shadow-lg shadow-black/5",
                  "relative"
                )}
                style={{
                  zIndex: activeItem === item.id ? 9999 : 1,
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0, scale: activeItem === item.id ? 1.05 : 1 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                drag
                dragSnapToOrigin
                dragMomentum={false}
                onDragStart={() => setActiveItem(item.id)}
                onDragEnd={(e, info) => {
                  setActiveItem(null);
                  const dropZone = checkDropZone(info.point.x, info.point.y);
                  if (dropZone) {
                    handleDrop(item.id, dropZone);
                  }
                  setHoveredZone(null);
                }}
                layout
              >
                <div className="flex items-center gap-2">
                  {item.icon && <span className="text-lg">{item.icon}</span>}
                  <span className="font-medium">{item.text}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Progress */}
      <motion.div
        className="flex justify-center items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <span className="text-sm text-muted-foreground">
          {Object.keys(value).length} / {items.length} placed
        </span>
        <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-linear-to-r from-emerald-500 to-cyan-500"
            initial={{ width: 0 }}
            animate={{
              width: `${(Object.keys(value).length / items.length) * 100}%`,
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}

export default DragToZone;
