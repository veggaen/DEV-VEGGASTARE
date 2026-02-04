"use client";

import { useState, useCallback, useRef } from "react";
import { motion, useDragControls, PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import { Move, RotateCcw, CheckCircle2, Layers, Grid, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// UI ARRANGE QUESTION COMPONENT
// Used for: Layout preferences, visual arrangement tasks, spatial reasoning
// "Drag boxes to arrange your ideal dashboard layout"
// ─────────────────────────────────────────────────────────────────────────────

export interface ArrangeBox {
  id: string;
  label: string;
  color?: string;
  icon?: string;
  width?: number; // Grid units (1-4)
  height?: number; // Grid units (1-4)
  initialPosition?: { x: number; y: number };
}

export interface DropZone {
  id: string;
  label: string;
  description?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  acceptedBoxIds?: string[]; // If set, only these boxes can be dropped here
  color?: string;
}

export interface ArrangeResult {
  boxPlacements: {
    boxId: string;
    zoneId: string | null;
    position: { x: number; y: number };
  }[];
  completionTime?: number;
  accuracy?: number;
}

interface UIArrangeQuestionProps {
  questionId: string;
  questionText: string;
  description?: string;
  boxes: ArrangeBox[];
  dropZones?: DropZone[];
  gridSize?: { cols: number; rows: number };
  value?: ArrangeResult;
  onChange: (result: ArrangeResult) => void;
  disabled?: boolean;
  freeform?: boolean; // If true, boxes can be placed anywhere
  showGrid?: boolean;
  expectedArrangement?: { boxId: string; zoneId: string }[]; // For scoring
  variant?: "dashboard" | "layout" | "spatial";
}

const CELL_SIZE = 60; // px
const GAP = 4; // px

const DEFAULT_COLORS = [
  "bg-blue-500/80",
  "bg-green-500/80",
  "bg-purple-500/80",
  "bg-orange-500/80",
  "bg-pink-500/80",
  "bg-cyan-500/80",
  "bg-amber-500/80",
  "bg-rose-500/80",
];

interface DraggableBoxProps {
  box: ArrangeBox;
  position: { x: number; y: number };
  onDragEnd: (position: { x: number; y: number }) => void;
  disabled: boolean;
  gridSize: { cols: number; rows: number };
  colorIndex: number;
  freeform: boolean;
}

function DraggableBox({
  box,
  position,
  onDragEnd,
  disabled,
  gridSize,
  colorIndex,
  freeform,
}: DraggableBoxProps) {
  const dragControls = useDragControls();
  const boxRef = useRef<HTMLDivElement>(null);

  const width = (box.width || 1) * CELL_SIZE + ((box.width || 1) - 1) * GAP;
  const height = (box.height || 1) * CELL_SIZE + ((box.height || 1) - 1) * GAP;

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled) return;

    let newX = position.x + info.offset.x;
    let newY = position.y + info.offset.y;

    if (!freeform) {
      // Snap to grid
      const cellWithGap = CELL_SIZE + GAP;
      newX = Math.round(newX / cellWithGap) * cellWithGap;
      newY = Math.round(newY / cellWithGap) * cellWithGap;

      // Clamp to grid bounds
      const maxX = (gridSize.cols - (box.width || 1)) * cellWithGap;
      const maxY = (gridSize.rows - (box.height || 1)) * cellWithGap;
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
    }

    onDragEnd({ x: newX, y: newY });
  };

  const colorClass = box.color || DEFAULT_COLORS[colorIndex % DEFAULT_COLORS.length];

  return (
    <motion.div
      ref={boxRef}
      drag={!disabled}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0}
      onDragEnd={handleDragEnd}
      initial={false}
      animate={{ x: position.x, y: position.y }}
      whileDrag={{ scale: 1.05, zIndex: 100 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      style={{ width, height }}
      className={cn(
        "absolute rounded-lg flex flex-col items-center justify-center gap-1",
        "cursor-grab active:cursor-grabbing select-none",
        "border-2 border-white/20 shadow-lg",
        colorClass,
        disabled && "opacity-60 cursor-not-allowed"
      )}
    >
      {box.icon && <span className="text-xl">{box.icon}</span>}
      <span className="text-xs font-medium text-white text-center px-1 truncate w-full">
        {box.label}
      </span>
      <Move className="w-3 h-3 text-white/60 absolute bottom-1 right-1" />
    </motion.div>
  );
}

interface DropZoneElementProps {
  zone: DropZone;
  isOccupied: boolean;
  colorIndex: number;
}

function DropZoneElement({ zone, isOccupied, colorIndex }: DropZoneElementProps) {
  const width = zone.width * CELL_SIZE + (zone.width - 1) * GAP;
  const height = zone.height * CELL_SIZE + (zone.height - 1) * GAP;
  const x = zone.x * (CELL_SIZE + GAP);
  const y = zone.y * (CELL_SIZE + GAP);

  const baseColor = zone.color || DEFAULT_COLORS[colorIndex % DEFAULT_COLORS.length];

  return (
    <div
      style={{ width, height, left: x, top: y }}
      className={cn(
        "absolute rounded-lg border-2 border-dashed",
        "flex flex-col items-center justify-center gap-1 p-2",
        "transition-all duration-200",
        isOccupied
          ? "border-green-500 bg-green-500/10"
          : `border-gray-400/50 ${baseColor.replace("/80", "/10")}`
      )}
    >
      {isOccupied ? (
        <CheckCircle2 className="w-5 h-5 text-green-500" />
      ) : (
        <>
          <Layers className="w-4 h-4 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground text-center">
            {zone.label}
          </span>
        </>
      )}
    </div>
  );
}

export function UIArrangeQuestion({
  questionId,
  questionText,
  description,
  boxes,
  dropZones,
  gridSize = { cols: 6, rows: 4 },
  value,
  onChange,
  disabled = false,
  freeform = false,
  showGrid = true,
  expectedArrangement,
  variant = "layout",
}: UIArrangeQuestionProps) {
  // Initialize positions
  const getInitialPositions = useCallback(() => {
    if (value?.boxPlacements) {
      const positions: Record<string, { x: number; y: number }> = {};
      value.boxPlacements.forEach((p) => {
        positions[p.boxId] = p.position;
      });
      return positions;
    }

    // Default: stack boxes on the left
    const positions: Record<string, { x: number; y: number }> = {};
    boxes.forEach((box, idx) => {
      if (box.initialPosition) {
        positions[box.id] = box.initialPosition;
      } else {
        // Stack in staging area
        positions[box.id] = {
          x: 0,
          y: idx * (CELL_SIZE + GAP * 2),
        };
      }
    });
    return positions;
  }, [boxes, value]);

  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(
    getInitialPositions
  );
  const [startTime] = useState(() => Date.now());

  const containerWidth = gridSize.cols * CELL_SIZE + (gridSize.cols - 1) * GAP;
  const containerHeight = gridSize.rows * CELL_SIZE + (gridSize.rows - 1) * GAP;

  const handleBoxMove = useCallback(
    (boxId: string, newPosition: { x: number; y: number }) => {
      const newPositions = { ...positions, [boxId]: newPosition };
      setPositions(newPositions);

      // Build result
      const placements = Object.entries(newPositions).map(([id, pos]) => {
        // Find which zone this box is in (if any)
        let zoneId: string | null = null;
        if (dropZones) {
          for (const zone of dropZones) {
            const zoneX = zone.x * (CELL_SIZE + GAP);
            const zoneY = zone.y * (CELL_SIZE + GAP);
            const zoneWidth = zone.width * CELL_SIZE;
            const zoneHeight = zone.height * CELL_SIZE;

            if (
              pos.x >= zoneX &&
              pos.x < zoneX + zoneWidth &&
              pos.y >= zoneY &&
              pos.y < zoneY + zoneHeight
            ) {
              // Check if zone accepts this box
              if (!zone.acceptedBoxIds || zone.acceptedBoxIds.includes(id)) {
                zoneId = zone.id;
                break;
              }
            }
          }
        }

        return { boxId: id, zoneId, position: pos };
      });

      // Calculate accuracy if expected arrangement is provided
      let accuracy: number | undefined;
      if (expectedArrangement) {
        const correct = placements.filter((p) => {
          const expected = expectedArrangement.find((e) => e.boxId === p.boxId);
          return expected && expected.zoneId === p.zoneId;
        }).length;
        accuracy = (correct / expectedArrangement.length) * 100;
      }

      onChange({
        boxPlacements: placements,
        completionTime: Date.now() - startTime,
        accuracy,
      });
    },
    [positions, dropZones, onChange, expectedArrangement, startTime]
  );

  const handleReset = useCallback(() => {
    const initial = getInitialPositions();
    setPositions(initial);
    onChange({
      boxPlacements: Object.entries(initial).map(([id, pos]) => ({
        boxId: id,
        zoneId: null,
        position: pos,
      })),
    });
  }, [getInitialPositions, onChange]);

  // Check which zones are occupied
  const occupiedZones = new Set<string>();
  if (dropZones) {
    Object.entries(positions).forEach(([boxId, pos]) => {
      for (const zone of dropZones) {
        const zoneX = zone.x * (CELL_SIZE + GAP);
        const zoneY = zone.y * (CELL_SIZE + GAP);
        const zoneWidth = zone.width * CELL_SIZE;
        const zoneHeight = zone.height * CELL_SIZE;

        if (
          pos.x >= zoneX &&
          pos.x < zoneX + zoneWidth &&
          pos.y >= zoneY &&
          pos.y < zoneY + zoneHeight
        ) {
          if (!zone.acceptedBoxIds || zone.acceptedBoxIds.includes(boxId)) {
            occupiedZones.add(zone.id);
            break;
          }
        }
      }
    });
  }

  // Completion status
  const allZonesFilled = dropZones
    ? dropZones.every((z) => occupiedZones.has(z.id))
    : false;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          {variant === "dashboard" && <LayoutGrid className="w-5 h-5" />}
          {variant === "layout" && <Grid className="w-5 h-5" />}
          {variant === "spatial" && <Layers className="w-5 h-5" />}
          {questionText}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Move className="w-3 h-3" />
          Drag boxes to arrange them on the grid
        </p>
      </div>

      {/* Arrange area */}
      <div className="relative bg-muted/30 rounded-xl p-4 overflow-hidden">
        {/* Grid background */}
        {showGrid && (
          <div
            className="absolute inset-4 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgb(200 200 200 / 0.1) 1px, transparent 1px),
                linear-gradient(to bottom, rgb(200 200 200 / 0.1) 1px, transparent 1px)
              `,
              backgroundSize: `${CELL_SIZE + GAP}px ${CELL_SIZE + GAP}px`,
            }}
          />
        )}

        {/* Drop zones */}
        <div
          className="relative"
          style={{ width: containerWidth, height: containerHeight }}
        >
          {dropZones?.map((zone, idx) => (
            <DropZoneElement
              key={zone.id}
              zone={zone}
              isOccupied={occupiedZones.has(zone.id)}
              colorIndex={idx}
            />
          ))}

          {/* Draggable boxes */}
          {boxes.map((box, idx) => (
            <DraggableBox
              key={box.id}
              box={box}
              position={positions[box.id] || { x: 0, y: 0 }}
              onDragEnd={(pos) => handleBoxMove(box.id, pos)}
              disabled={disabled}
              gridSize={gridSize}
              colorIndex={idx}
              freeform={freeform}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={disabled}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>

        {dropZones && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              Zones filled: {occupiedZones.size}/{dropZones.length}
            </span>
            {allZonesFilled && (
              <span className="text-green-500 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Complete
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESETS
// ─────────────────────────────────────────────────────────────────────────────

export const UI_ARRANGE_PRESETS = {
  dashboardLayout: {
    gridSize: { cols: 6, rows: 4 },
    boxes: [
      { id: "nav", label: "Navigation", icon: "🧭", width: 1, height: 4 },
      { id: "header", label: "Header", icon: "📰", width: 5, height: 1 },
      { id: "main", label: "Main Content", icon: "📄", width: 3, height: 2 },
      { id: "sidebar", label: "Sidebar", icon: "📋", width: 2, height: 3 },
      { id: "footer", label: "Footer", icon: "📎", width: 5, height: 1 },
    ],
    dropZones: [
      { id: "left", label: "Left Panel", x: 0, y: 0, width: 1, height: 4 },
      { id: "top", label: "Top Bar", x: 1, y: 0, width: 5, height: 1 },
      { id: "center", label: "Main Area", x: 1, y: 1, width: 3, height: 2 },
      { id: "right", label: "Right Panel", x: 4, y: 1, width: 2, height: 3 },
      { id: "bottom", label: "Bottom Bar", x: 1, y: 3, width: 5, height: 1 },
    ],
  },

  priorityMatrix: {
    gridSize: { cols: 4, rows: 4 },
    boxes: [
      { id: "task1", label: "Email", icon: "📧", width: 1, height: 1 },
      { id: "task2", label: "Meeting", icon: "📅", width: 1, height: 1 },
      { id: "task3", label: "Report", icon: "📊", width: 1, height: 1 },
      { id: "task4", label: "Review", icon: "👁️", width: 1, height: 1 },
    ],
    dropZones: [
      { id: "urgent-important", label: "Do First", x: 0, y: 0, width: 2, height: 2, color: "bg-red-500/80" },
      { id: "not-urgent-important", label: "Schedule", x: 2, y: 0, width: 2, height: 2, color: "bg-blue-500/80" },
      { id: "urgent-not-important", label: "Delegate", x: 0, y: 2, width: 2, height: 2, color: "bg-yellow-500/80" },
      { id: "not-urgent-not-important", label: "Don't Do", x: 2, y: 2, width: 2, height: 2, color: "bg-gray-500/80" },
    ],
  },

  spatialTest: {
    gridSize: { cols: 5, rows: 5 },
    boxes: [
      { id: "a", label: "A", width: 1, height: 1, color: "bg-red-500/80" },
      { id: "b", label: "B", width: 2, height: 1, color: "bg-blue-500/80" },
      { id: "c", label: "C", width: 1, height: 2, color: "bg-green-500/80" },
      { id: "d", label: "D", width: 2, height: 2, color: "bg-purple-500/80" },
    ],
    dropZones: [
      { id: "z1", label: "Zone A", x: 0, y: 0, width: 1, height: 1, acceptedBoxIds: ["a"], color: "bg-red-500/80" },
      { id: "z2", label: "Zone B", x: 1, y: 0, width: 2, height: 1, acceptedBoxIds: ["b"], color: "bg-blue-500/80" },
      { id: "z3", label: "Zone C", x: 3, y: 0, width: 1, height: 2, acceptedBoxIds: ["c"], color: "bg-green-500/80" },
      { id: "z4", label: "Zone D", x: 0, y: 2, width: 2, height: 2, acceptedBoxIds: ["d"], color: "bg-purple-500/80" },
    ],
    expectedArrangement: [
      { boxId: "a", zoneId: "z1" },
      { boxId: "b", zoneId: "z2" },
      { boxId: "c", zoneId: "z3" },
      { boxId: "d", zoneId: "z4" },
    ],
  },
} as const;

export default UIArrangeQuestion;
