"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, RotateCcw, Sparkles, Target, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// SHAPE MATCH QUESTION COMPONENT
// Used for: Cognitive tests, anti-bot verification, engagement quality assessment
// ─────────────────────────────────────────────────────────────────────────────

export type ShapeType = "circle" | "square" | "triangle" | "star" | "hexagon" | "diamond";
export type ColorType = "red" | "green" | "blue" | "yellow" | "purple" | "orange" | "black" | "white";

export interface ShapeTarget {
  id: string;
  shape: ShapeType;
  color: ColorType;
  label?: string;
}

export interface DraggableShape {
  id: string;
  shape: ShapeType;
  color: ColorType;
  targetId: string; // Which target it should match
}

export interface ShapeMatchConfig {
  mode: "shape-only" | "color-only" | "shape-and-color" | "shape-to-color";
  shapes: DraggableShape[];
  targets: ShapeTarget[];
  timeLimit?: number; // Seconds, optional
  showFeedback?: boolean;
  allowRetry?: boolean;
  instructions?: string;
}

interface ShapeMatchQuestionProps {
  questionId: string;
  questionText: string;
  description?: string;
  config: ShapeMatchConfig;
  value?: Record<string, string>; // shapeId -> targetId mappings
  onChange: (value: Record<string, string>) => void;
  onComplete?: (isCorrect: boolean, timeTaken: number) => void;
  disabled?: boolean;
}

// Color mapping
const COLOR_MAP: Record<ColorType, string> = {
  red: "bg-red-500 border-red-600",
  green: "bg-emerald-500 border-emerald-600",
  blue: "bg-blue-500 border-blue-600",
  yellow: "bg-yellow-400 border-yellow-500",
  purple: "bg-purple-500 border-purple-600",
  orange: "bg-orange-500 border-orange-600",
  black: "bg-neutral-800 border-neutral-900",
  white: "bg-white border-neutral-300",
};

const COLOR_TARGET_MAP: Record<ColorType, string> = {
  red: "bg-red-500/20 border-red-500/50 ring-red-500/30",
  green: "bg-emerald-500/20 border-emerald-500/50 ring-emerald-500/30",
  blue: "bg-blue-500/20 border-blue-500/50 ring-blue-500/30",
  yellow: "bg-yellow-400/20 border-yellow-500/50 ring-yellow-500/30",
  purple: "bg-purple-500/20 border-purple-500/50 ring-purple-500/30",
  orange: "bg-orange-500/20 border-orange-500/50 ring-orange-500/30",
  black: "bg-neutral-800/20 border-neutral-500/50 ring-neutral-500/30",
  white: "bg-white/20 border-neutral-300/50 ring-neutral-300/30",
};

// Shape SVG components
function ShapeSVG({ shape, className }: { shape: ShapeType; className?: string }) {
  const baseClass = cn("w-full h-full", className);
  
  switch (shape) {
    case "circle":
      return (
        <svg viewBox="0 0 100 100" className={baseClass}>
          <circle cx="50" cy="50" r="45" fill="currentColor" />
        </svg>
      );
    case "square":
      return (
        <svg viewBox="0 0 100 100" className={baseClass}>
          <rect x="10" y="10" width="80" height="80" fill="currentColor" />
        </svg>
      );
    case "triangle":
      return (
        <svg viewBox="0 0 100 100" className={baseClass}>
          <polygon points="50,10 90,90 10,90" fill="currentColor" />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 100 100" className={baseClass}>
          <polygon 
            points="50,5 61,40 98,40 68,62 79,97 50,75 21,97 32,62 2,40 39,40" 
            fill="currentColor" 
          />
        </svg>
      );
    case "hexagon":
      return (
        <svg viewBox="0 0 100 100" className={baseClass}>
          <polygon points="50,5 93,25 93,75 50,95 7,75 7,25" fill="currentColor" />
        </svg>
      );
    case "diamond":
      return (
        <svg viewBox="0 0 100 100" className={baseClass}>
          <polygon points="50,5 95,50 50,95 5,50" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}

// Target zone component
function TargetZone({ 
  target, 
  isActive, 
  isCorrect,
  isIncorrect,
  hasShape,
  showShapeOutline,
}: { 
  target: ShapeTarget;
  isActive: boolean;
  isCorrect: boolean;
  isIncorrect: boolean;
  hasShape: boolean;
  showShapeOutline: boolean;
}) {
  const colorClass = COLOR_TARGET_MAP[target.color];
  
  return (
    <motion.div
      className={cn(
        "relative w-24 h-24 rounded-2xl border-2 border-dashed transition-all duration-200",
        "flex items-center justify-center",
        colorClass,
        isActive && "ring-4 scale-105 border-solid",
        isCorrect && "bg-emerald-500/30 border-emerald-500 ring-emerald-500/50",
        isIncorrect && "bg-red-500/30 border-red-500 ring-red-500/50 animate-shake",
        hasShape && "border-solid"
      )}
      animate={isIncorrect ? { x: [0, -10, 10, -10, 10, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      {/* Shape outline hint */}
      {showShapeOutline && !hasShape && (
        <div className="absolute inset-4 opacity-30">
          <ShapeSVG shape={target.shape} className="text-current" />
        </div>
      )}
      
      {/* Label */}
      {target.label && (
        <span className="absolute -bottom-6 text-xs text-muted-foreground whitespace-nowrap">
          {target.label}
        </span>
      )}
      
      {/* Success indicator */}
      {isCorrect && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2"
        >
          <CheckCircle2 className="w-6 h-6 text-emerald-500 fill-emerald-500/20" />
        </motion.div>
      )}
    </motion.div>
  );
}

// Draggable shape component
function DraggableShapeItem({
  shape,
  position,
  onDragEnd,
  disabled,
  isPlaced,
}: {
  shape: DraggableShape;
  position: { x: number; y: number } | null;
  onDragEnd: (info: { point: { x: number; y: number } }) => void;
  disabled: boolean;
  isPlaced: boolean;
}) {
  const colorClass = COLOR_MAP[shape.color];
  
  if (isPlaced) return null;
  
  return (
    <motion.div
      drag={!disabled}
      dragMomentum={false}
      dragElastic={0.1}
      onDragEnd={(_, info) => onDragEnd(info)}
      whileDrag={{ scale: 1.1, zIndex: 100 }}
      whileHover={{ scale: 1.05 }}
      className={cn(
        "w-16 h-16 cursor-grab active:cursor-grabbing rounded-xl border-2 shadow-lg",
        "flex items-center justify-center p-2",
        colorClass,
        disabled && "opacity-50 cursor-not-allowed"
      )}
      style={position ? { x: position.x, y: position.y } : undefined}
    >
      <ShapeSVG 
        shape={shape.shape} 
        className={shape.color === "white" ? "text-neutral-800" : "text-white"} 
      />
    </motion.div>
  );
}

export function ShapeMatchQuestion({
  questionId,
  questionText,
  description,
  config,
  value = {},
  onChange,
  onComplete,
  disabled = false,
}: ShapeMatchQuestionProps) {
  const [placements, setPlacements] = useState<Record<string, string>>(value);
  const [activeTarget, setActiveTarget] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, "correct" | "incorrect">>({});
  const [startTime] = useState<number>(() => Date.now());
  const [isComplete, setIsComplete] = useState(false);
  const [isReadyToConfirm, setIsReadyToConfirm] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(config.timeLimit ?? null);
  const containerRef = useRef<HTMLDivElement>(null);
  const targetRefs = useRef<Map<string, DOMRect>>(new Map());
  const SNAP_DISTANCE_PX = 84;

  // Timer
  useEffect(() => {
    if (!config.timeLimit || isComplete) return;
    
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [config.timeLimit, isComplete]);

  // Update target positions
  const updateTargetPositions = useCallback(() => {
    if (!containerRef.current) return;
    
    const targets = containerRef.current.querySelectorAll("[data-target-id]");
    targets.forEach((target) => {
      const id = target.getAttribute("data-target-id");
      if (id) {
        targetRefs.current.set(id, target.getBoundingClientRect());
      }
    });
  }, []);

  useEffect(() => {
    updateTargetPositions();
    window.addEventListener("resize", updateTargetPositions);
    return () => window.removeEventListener("resize", updateTargetPositions);
  }, [updateTargetPositions]);

  // Check if placement is correct
  const checkPlacement = useCallback((shapeId: string, targetId: string): boolean => {
    const shape = config.shapes.find(s => s.id === shapeId);
    const target = config.targets.find(t => t.id === targetId);
    
    if (!shape || !target) return false;
    
    switch (config.mode) {
      case "shape-only":
        return shape.shape === target.shape;
      case "color-only":
        return shape.color === target.color;
      case "shape-and-color":
        return shape.shape === target.shape && shape.color === target.color;
      case "shape-to-color":
        return shape.targetId === target.id;
      default:
        return shape.targetId === target.id;
    }
  }, [config]);

  // Handle drag end
  const handleDragEnd = useCallback((shapeId: string, info: { point: { x: number; y: number } }) => {
    if (disabled || isComplete) return;
    
    // Find which target the shape was dropped on (inside rect) or nearest target within snap distance
    let droppedTarget: string | null = null;
    let nearestTargetId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    
    targetRefs.current.forEach((rect, targetId) => {
      if (
        info.point.x >= rect.left &&
        info.point.x <= rect.right &&
        info.point.y >= rect.top &&
        info.point.y <= rect.bottom
      ) {
        droppedTarget = targetId;
      }

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(info.point.x - centerX, info.point.y - centerY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestTargetId = targetId;
      }
    });

    if (!droppedTarget && nearestTargetId && nearestDistance <= SNAP_DISTANCE_PX) {
      droppedTarget = nearestTargetId;
    }
    
    if (droppedTarget) {
      const nextPlacements = { ...placements, [shapeId]: droppedTarget };
      setPlacements(nextPlacements);
      onChange(nextPlacements);

      const isCorrect = checkPlacement(shapeId, droppedTarget);
      
      if (config.showFeedback !== false) {
        setFeedback(prev => ({ ...prev, [shapeId]: isCorrect ? "correct" : "incorrect" }));
      }

      const allPlaced = config.shapes.every(s => nextPlacements[s.id]);
      setIsReadyToConfirm(allPlaced);
    }
    
    setActiveTarget(null);
  }, [disabled, isComplete, placements, checkPlacement, config.shapes, onChange]);

  const handleConfirm = useCallback(() => {
    if (disabled || isComplete) return;
    const allPlaced = config.shapes.every((shape) => placements[shape.id]);
    if (!allPlaced) return;

    const nextFeedback: Record<string, "correct" | "incorrect"> = {};
    config.shapes.forEach((shape) => {
      const targetId = placements[shape.id];
      nextFeedback[shape.id] = checkPlacement(shape.id, targetId) ? "correct" : "incorrect";
    });
    setFeedback(nextFeedback);

    const allCorrect = config.shapes.every((shape) => checkPlacement(shape.id, placements[shape.id]));
    setIsComplete(true);
    setIsReadyToConfirm(false);
    onComplete?.(allCorrect, (Date.now() - startTime) / 1000);
  }, [checkPlacement, config.shapes, disabled, isComplete, onComplete, placements, startTime]);

  const removePlacement = useCallback((shapeId: string) => {
    if (disabled || isComplete) return;
    setPlacements((prev) => {
      const next = { ...prev };
      delete next[shapeId];
      onChange(next);
      setIsReadyToConfirm(config.shapes.every((shape) => !!next[shape.id]));
      return next;
    });
    setFeedback((prev) => {
      const next = { ...prev };
      delete next[shapeId];
      return next;
    });
  }, [config.shapes, disabled, isComplete, onChange]);

  // Reset
  const handleReset = useCallback(() => {
    setPlacements({});
    setFeedback({});
    setIsComplete(false);
    setIsReadyToConfirm(false);
    onChange({});
  }, [onChange]);

  const placedShapeIds = Object.keys(placements);
  const correctCount = Object.entries(placements).filter(
    ([shapeId, targetId]) => checkPlacement(shapeId, targetId)
  ).length;

  return (
    <div className="space-y-4" ref={containerRef}>
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-violet-500" />
              {questionText}
            </h3>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          
          {/* Timer */}
          {timeLeft !== null && (
            <div className={cn(
              "px-3 py-1.5 rounded-full text-sm font-mono",
              timeLeft > 10 ? "bg-muted" : "bg-red-500/20 text-red-500 animate-pulse"
            )}>
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
            </div>
          )}
        </div>
        
        {/* Instructions */}
        {config.instructions && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <Shield className="w-4 h-4 text-blue-500 shrink-0" />
            {config.instructions}
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 text-sm">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: `${(correctCount / config.shapes.length) * 100}%` }}
          />
        </div>
        <span className="text-muted-foreground">
          {correctCount}/{config.shapes.length}
        </span>
      </div>

      {/* Game area */}
      <div className="relative bg-gradient-to-br from-neutral-900/50 to-neutral-800/50 rounded-2xl p-6 min-h-[300px]">
        {/* Target zones */}
        <div className="flex flex-wrap justify-center gap-8 mb-8">
          {config.targets.map((target) => {
            const placedShape = Object.entries(placements).find(
              ([_, tId]) => tId === target.id
            );
            const shapeId = placedShape?.[0];
            const shape = shapeId ? config.shapes.find(s => s.id === shapeId) : null;
            
            return (
              <div key={target.id} data-target-id={target.id} className="relative">
                <TargetZone
                  target={target}
                  isActive={activeTarget === target.id}
                  isCorrect={shapeId ? feedback[shapeId] === "correct" : false}
                  isIncorrect={shapeId ? feedback[shapeId] === "incorrect" : false}
                  hasShape={!!shapeId}
                  showShapeOutline={config.mode === "shape-only" || config.mode === "shape-and-color"}
                />
                
                {/* Placed shape */}
                {shape && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={cn(
                      "absolute inset-2 rounded-lg flex items-center justify-center",
                      COLOR_MAP[shape.color],
                      !disabled && !isComplete && "cursor-pointer hover:brightness-110"
                    )}
                    onClick={() => removePlacement(shape.id)}
                    title={!disabled && !isComplete ? "Click to move this shape" : undefined}
                  >
                    <ShapeSVG 
                      shape={shape.shape} 
                      className={shape.color === "white" ? "text-neutral-800" : "text-white"} 
                    />
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>

        {/* Draggable shapes */}
        <div className="flex flex-wrap justify-center gap-4">
          {config.shapes.map((shape) => (
            <DraggableShapeItem
              key={shape.id}
              shape={shape}
              position={null}
              onDragEnd={(info) => handleDragEnd(shape.id, info)}
              disabled={disabled || isComplete}
              isPlaced={placedShapeIds.includes(shape.id)}
            />
          ))}
        </div>

        {/* Complete overlay */}
        <AnimatePresence>
          {isComplete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-2xl flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <Sparkles className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
                <p className="text-xl font-bold text-white mb-1">Complete!</p>
                <p className="text-emerald-400">
                  {correctCount}/{config.shapes.length} correct
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reset button */}
      <div className="flex flex-wrap items-center gap-2">
        {isReadyToConfirm && !isComplete && (
          <Button
            size="sm"
            onClick={handleConfirm}
            className="gap-2 bg-violet-600 hover:bg-violet-500 text-white"
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirm placements
          </Button>
        )}

        {(Object.keys(placements).length > 0 || isComplete) && config.allowRetry !== false && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset & Try Again
          </Button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESET CONFIGURATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const SHAPE_MATCH_PRESETS = {
  // Basic shape matching - circle to circle, square to square
  basicShapes: {
    mode: "shape-only" as const,
    instructions: "Drag each shape to its matching outline",
    shapes: [
      { id: "s1", shape: "circle" as ShapeType, color: "blue" as ColorType, targetId: "t1" },
      { id: "s2", shape: "square" as ShapeType, color: "red" as ColorType, targetId: "t2" },
      { id: "s3", shape: "triangle" as ShapeType, color: "green" as ColorType, targetId: "t3" },
    ],
    targets: [
      { id: "t1", shape: "circle" as ShapeType, color: "blue" as ColorType, label: "Circle" },
      { id: "t2", shape: "square" as ShapeType, color: "red" as ColorType, label: "Square" },
      { id: "t3", shape: "triangle" as ShapeType, color: "green" as ColorType, label: "Triangle" },
    ],
    showFeedback: true,
    allowRetry: true,
  },

  // Outline-only matching with neutral (black) target outlines
  outlineMatch: {
    mode: "shape-only" as const,
    instructions: "Drag each filled shape into the matching black outline",
    shapes: [
      { id: "s1", shape: "circle" as ShapeType, color: "blue" as ColorType, targetId: "t1" },
      { id: "s2", shape: "square" as ShapeType, color: "red" as ColorType, targetId: "t2" },
      { id: "s3", shape: "triangle" as ShapeType, color: "green" as ColorType, targetId: "t3" },
    ],
    targets: [
      { id: "t1", shape: "circle" as ShapeType, color: "black" as ColorType, label: "Circle Outline" },
      { id: "t2", shape: "square" as ShapeType, color: "black" as ColorType, label: "Square Outline" },
      { id: "t3", shape: "triangle" as ShapeType, color: "black" as ColorType, label: "Triangle Outline" },
    ],
    showFeedback: true,
    allowRetry: true,
  },

  // Color matching - drag colored shape to matching color zone
  colorMatch: {
    mode: "color-only" as const,
    instructions: "Drag each shape to the zone with the matching color",
    shapes: [
      { id: "s1", shape: "circle" as ShapeType, color: "red" as ColorType, targetId: "t1" },
      { id: "s2", shape: "square" as ShapeType, color: "green" as ColorType, targetId: "t2" },
      { id: "s3", shape: "triangle" as ShapeType, color: "blue" as ColorType, targetId: "t3" },
    ],
    targets: [
      { id: "t1", shape: "square" as ShapeType, color: "red" as ColorType, label: "Red Zone" },
      { id: "t2", shape: "circle" as ShapeType, color: "green" as ColorType, label: "Green Zone" },
      { id: "t3", shape: "star" as ShapeType, color: "blue" as ColorType, label: "Blue Zone" },
    ],
    showFeedback: true,
    allowRetry: true,
  },

  // Anti-bot: Black box to green box
  antiBot: {
    mode: "shape-to-color" as const,
    instructions: "🔒 Human verification: Drag the black box into the green zone",
    shapes: [
      { id: "s1", shape: "square" as ShapeType, color: "black" as ColorType, targetId: "t1" },
    ],
    targets: [
      { id: "t1", shape: "square" as ShapeType, color: "green" as ColorType, label: "Drop here" },
    ],
    showFeedback: true,
    allowRetry: true,
    timeLimit: 30,
  },

  // Advanced: Full shape + color match
  advanced: {
    mode: "shape-and-color" as const,
    instructions: "Match both shape AND color exactly",
    shapes: [
      { id: "s1", shape: "circle" as ShapeType, color: "red" as ColorType, targetId: "t1" },
      { id: "s2", shape: "circle" as ShapeType, color: "blue" as ColorType, targetId: "t2" },
      { id: "s3", shape: "square" as ShapeType, color: "red" as ColorType, targetId: "t3" },
      { id: "s4", shape: "square" as ShapeType, color: "blue" as ColorType, targetId: "t4" },
    ],
    targets: [
      { id: "t1", shape: "circle" as ShapeType, color: "red" as ColorType },
      { id: "t2", shape: "circle" as ShapeType, color: "blue" as ColorType },
      { id: "t3", shape: "square" as ShapeType, color: "red" as ColorType },
      { id: "t4", shape: "square" as ShapeType, color: "blue" as ColorType },
    ],
    showFeedback: true,
    allowRetry: true,
  },
};

export default ShapeMatchQuestion;
