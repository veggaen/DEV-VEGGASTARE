"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  X, Plus, Trash2, Move, Eye, RotateCcw, Target, Shapes,
  Circle, Square, Triangle, Star, Hexagon, Diamond,
  GripVertical, Copy, Link2, Unlink2, Save
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// SHAPE MATCH VISUAL BUILDER
// Professional visual editor for creating shape match quiz questions
// ─────────────────────────────────────────────────────────────────────────────

export type ShapeType = "circle" | "square" | "triangle" | "star" | "hexagon" | "diamond";
export type ColorType = "red" | "green" | "blue" | "yellow" | "purple" | "orange" | "black" | "white";

export interface BuilderDraggableShape {
  id: string;
  shape: ShapeType;
  color: ColorType;
  label?: string;
  x: number; // % position on canvas
  y: number; // % position on canvas
}

export interface BuilderDropZone {
  id: string;
  shape: ShapeType;
  color: ColorType;
  label?: string;
  x: number; // % position on canvas
  y: number; // % position on canvas
  width: number;  // px
  height: number; // px
}

export interface ShapeMatchBuilderConfig {
  mode: "shape-only" | "color-only" | "shape-and-color" | "shape-to-color";
  background?: { type: "color" | "image"; value: string };
  draggableItems: BuilderDraggableShape[];
  dropZones: BuilderDropZone[];
  correctMatches: Record<string, string>; // shapeId -> zoneId
  snapToGrid: boolean;
  timeLimit?: number;
  instructions?: string;
}

interface ShapeMatchVisualBuilderProps {
  config?: ShapeMatchBuilderConfig;
  onSave: (config: ShapeMatchBuilderConfig) => void;
  onClose: () => void;
}

// Color palette
const COLORS: { value: ColorType; label: string; bg: string; ring: string }[] = [
  { value: "red", label: "Red", bg: "bg-red-500", ring: "ring-red-500" },
  { value: "green", label: "Green", bg: "bg-emerald-500", ring: "ring-emerald-500" },
  { value: "blue", label: "Blue", bg: "bg-blue-500", ring: "ring-blue-500" },
  { value: "yellow", label: "Yellow", bg: "bg-yellow-400", ring: "ring-yellow-400" },
  { value: "purple", label: "Purple", bg: "bg-purple-500", ring: "ring-purple-500" },
  { value: "orange", label: "Orange", bg: "bg-orange-500", ring: "ring-orange-500" },
  { value: "black", label: "Black", bg: "bg-neutral-800", ring: "ring-neutral-800" },
  { value: "white", label: "White", bg: "bg-white", ring: "ring-neutral-300" },
];

// Shape options
const SHAPES: { value: ShapeType; label: string; icon: typeof Circle }[] = [
  { value: "circle", label: "Circle", icon: Circle },
  { value: "square", label: "Square", icon: Square },
  { value: "triangle", label: "Triangle", icon: Triangle },
  { value: "star", label: "Star", icon: Star },
  { value: "hexagon", label: "Hexagon", icon: Hexagon },
  { value: "diamond", label: "Diamond", icon: Diamond },
];

const MODE_OPTIONS = [
  { value: "shape-only", label: "Match by Shape", desc: "Drag shape to matching outline" },
  { value: "color-only", label: "Match by Color", desc: "Drag to zone with same color" },
  { value: "shape-and-color", label: "Shape + Color", desc: "Both shape AND color must match" },
  { value: "shape-to-color", label: "Shape to Color", desc: "Match shapes to colored zones" },
] as const;

// SVG shape components for canvas
function CanvasShape({ shape, color, size = 48 }: { shape: ShapeType; color: ColorType; size?: number }) {
  const colorMap: Record<ColorType, string> = {
    red: "#ef4444", green: "#10b981", blue: "#3b82f6",
    yellow: "#facc15", purple: "#a855f7", orange: "#f97316",
    black: "#262626", white: "#f5f5f5",
  };
  const fill = colorMap[color] || "#6b7280";

  switch (shape) {
    case "circle":
      return <svg width={size} height={size} viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill={fill} stroke="rgba(255,255,255,0.3)" strokeWidth="2" /></svg>;
    case "square":
      return <svg width={size} height={size} viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="4" fill={fill} stroke="rgba(255,255,255,0.3)" strokeWidth="2" /></svg>;
    case "triangle":
      return <svg width={size} height={size} viewBox="0 0 48 48"><polygon points="24,4 44,44 4,44" fill={fill} stroke="rgba(255,255,255,0.3)" strokeWidth="2" /></svg>;
    case "star":
      return <svg width={size} height={size} viewBox="0 0 48 48"><polygon points="24,2 30,18 48,18 34,28 38,46 24,36 10,46 14,28 0,18 18,18" fill={fill} stroke="rgba(255,255,255,0.3)" strokeWidth="2" /></svg>;
    case "hexagon":
      return <svg width={size} height={size} viewBox="0 0 48 48"><polygon points="24,2 44,14 44,34 24,46 4,34 4,14" fill={fill} stroke="rgba(255,255,255,0.3)" strokeWidth="2" /></svg>;
    case "diamond":
      return <svg width={size} height={size} viewBox="0 0 48 48"><polygon points="24,2 46,24 24,46 2,24" fill={fill} stroke="rgba(255,255,255,0.3)" strokeWidth="2" /></svg>;
  }
}

function CanvasDropZone({ shape, color, width, height }: { shape: ShapeType; color: ColorType; width: number; height: number }) {
  const colorMap: Record<ColorType, string> = {
    red: "#ef4444", green: "#10b981", blue: "#3b82f6",
    yellow: "#facc15", purple: "#a855f7", orange: "#f97316",
    black: "#525252", white: "#d4d4d4",
  };
  const stroke = colorMap[color] || "#6b7280";

  switch (shape) {
    case "circle":
      return <svg width={width} height={height} viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" fill="none" stroke={stroke} strokeWidth="3" strokeDasharray="8 4" opacity="0.6" /></svg>;
    case "square":
      return <svg width={width} height={height} viewBox="0 0 120 120"><rect x="10" y="10" width="100" height="100" rx="8" fill="none" stroke={stroke} strokeWidth="3" strokeDasharray="8 4" opacity="0.6" /></svg>;
    case "triangle":
      return <svg width={width} height={height} viewBox="0 0 120 120"><polygon points="60,10 110,110 10,110" fill="none" stroke={stroke} strokeWidth="3" strokeDasharray="8 4" opacity="0.6" /></svg>;
    case "star":
      return <svg width={width} height={height} viewBox="0 0 120 120"><polygon points="60,5 75,45 120,45 85,70 95,115 60,90 25,115 35,70 0,45 45,45" fill="none" stroke={stroke} strokeWidth="3" strokeDasharray="8 4" opacity="0.6" /></svg>;
    case "hexagon":
      return <svg width={width} height={height} viewBox="0 0 120 120"><polygon points="60,5 110,35 110,85 60,115 10,85 10,35" fill="none" stroke={stroke} strokeWidth="3" strokeDasharray="8 4" opacity="0.6" /></svg>;
    case "diamond":
      return <svg width={width} height={height} viewBox="0 0 120 120"><polygon points="60,5 115,60 60,115 5,60" fill="none" stroke={stroke} strokeWidth="3" strokeDasharray="8 4" opacity="0.6" /></svg>;
  }
}

let shapeIdCounter = 0;
function genId(prefix: string) {
  shapeIdCounter++;
  return `${prefix}_${Date.now()}_${shapeIdCounter}`;
}

// ─── DEFAULT CONFIG ───
function defaultConfig(): ShapeMatchBuilderConfig {
  return {
    mode: "shape-only",
    background: { type: "color", value: "#18181b" },
    draggableItems: [],
    dropZones: [],
    correctMatches: {},
    snapToGrid: true,
    instructions: "Drag each shape to its matching zone",
  };
}

// ─── MAIN COMPONENT ───
export function ShapeMatchVisualBuilder({ config: initialConfig, onSave, onClose }: ShapeMatchVisualBuilderProps) {
  const [config, setConfig] = useState<ShapeMatchBuilderConfig>(initialConfig || defaultConfig());
  const [selectedItem, setSelectedItem] = useState<{ type: "shape" | "zone"; id: string } | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null); // shapeId for linking mode
  const [previewMode, setPreviewMode] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // ─── SHAPE MANAGEMENT ───
  const addShape = useCallback((shape: ShapeType, color: ColorType) => {
    const newShape: BuilderDraggableShape = {
      id: genId("shape"),
      shape,
      color,
      x: 10 + Math.random() * 20,
      y: 20 + Math.random() * 60,
    };
    setConfig(prev => ({
      ...prev,
      draggableItems: [...prev.draggableItems, newShape],
    }));
    setSelectedItem({ type: "shape", id: newShape.id });
  }, []);

  const addDropZone = useCallback((shape: ShapeType, color: ColorType) => {
    const newZone: BuilderDropZone = {
      id: genId("zone"),
      shape,
      color,
      x: 60 + Math.random() * 20,
      y: 20 + Math.random() * 60,
      width: 100,
      height: 100,
    };
    setConfig(prev => ({
      ...prev,
      dropZones: [...prev.dropZones, newZone],
    }));
    setSelectedItem({ type: "zone", id: newZone.id });
  }, []);

  const removeItem = useCallback((type: "shape" | "zone", id: string) => {
    setConfig(prev => {
      const newMatches = { ...prev.correctMatches };
      if (type === "shape") {
        delete newMatches[id];
        return {
          ...prev,
          draggableItems: prev.draggableItems.filter(s => s.id !== id),
          correctMatches: newMatches,
        };
      } else {
        // Remove any matches pointing to this zone
        Object.entries(newMatches).forEach(([k, v]) => {
          if (v === id) delete newMatches[k];
        });
        return {
          ...prev,
          dropZones: prev.dropZones.filter(z => z.id !== id),
          correctMatches: newMatches,
        };
      }
    });
    setSelectedItem(null);
  }, []);

  const updateShapePosition = useCallback((id: string, x: number, y: number) => {
    setConfig(prev => ({
      ...prev,
      draggableItems: prev.draggableItems.map(s =>
        s.id === id ? { ...s, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } : s
      ),
    }));
  }, []);

  const updateZonePosition = useCallback((id: string, x: number, y: number) => {
    setConfig(prev => ({
      ...prev,
      dropZones: prev.dropZones.map(z =>
        z.id === id ? { ...z, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } : z
      ),
    }));
  }, []);

  const updateShapeProps = useCallback((id: string, updates: Partial<BuilderDraggableShape>) => {
    setConfig(prev => ({
      ...prev,
      draggableItems: prev.draggableItems.map(s => s.id === id ? { ...s, ...updates } : s),
    }));
  }, []);

  const updateZoneProps = useCallback((id: string, updates: Partial<BuilderDropZone>) => {
    setConfig(prev => ({
      ...prev,
      dropZones: prev.dropZones.map(z => z.id === id ? { ...z, ...updates } : z),
    }));
  }, []);

  // ─── LINKING (correct matches) ───
  const startLink = useCallback((shapeId: string) => {
    setLinkingFrom(shapeId);
  }, []);

  const completeLink = useCallback((zoneId: string) => {
    if (!linkingFrom) return;
    setConfig(prev => ({
      ...prev,
      correctMatches: { ...prev.correctMatches, [linkingFrom]: zoneId },
    }));
    setLinkingFrom(null);
  }, [linkingFrom]);

  const removeLink = useCallback((shapeId: string) => {
    setConfig(prev => {
      const newMatches = { ...prev.correctMatches };
      delete newMatches[shapeId];
      return { ...prev, correctMatches: newMatches };
    });
  }, []);

  // ─── CANVAS DRAG ───
  const handleCanvasDrag = useCallback((type: "shape" | "zone", id: string, info: { point: { x: number; y: number } }) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const xPct = ((info.point.x - rect.left) / rect.width) * 100;
    const yPct = ((info.point.y - rect.top) / rect.height) * 100;
    const snapped = config.snapToGrid
      ? { x: Math.round(xPct / 5) * 5, y: Math.round(yPct / 5) * 5 }
      : { x: xPct, y: yPct };
    if (type === "shape") {
      updateShapePosition(id, snapped.x, snapped.y);
    } else {
      updateZonePosition(id, snapped.x, snapped.y);
    }
  }, [config.snapToGrid, updateShapePosition, updateZonePosition]);

  // ─── SELECTED ITEM DATA ───
  const selectedShape = selectedItem?.type === "shape"
    ? config.draggableItems.find(s => s.id === selectedItem.id)
    : null;
  const selectedZone = selectedItem?.type === "zone"
    ? config.dropZones.find(z => z.id === selectedItem.id)
    : null;

  // ─── VALIDATION ───
  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (config.draggableItems.length === 0) issues.push("Add at least one draggable shape");
    if (config.dropZones.length === 0) issues.push("Add at least one drop zone");
    const unmatchedShapes = config.draggableItems.filter(s => !config.correctMatches[s.id]);
    if (unmatchedShapes.length > 0) issues.push(`${unmatchedShapes.length} shape(s) not linked to a zone`);
    return issues;
  }, [config]);

  const handleSave = useCallback(() => {
    onSave(config);
  }, [config, onSave]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden"
      >
        {/* ─── HEADER ─── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <Shapes className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-zinc-100">Shape Match Visual Builder</h2>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
              {config.draggableItems.length} shapes · {config.dropZones.length} zones
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewMode(!previewMode)}
              className={cn("gap-1.5", previewMode && "text-primary")}
            >
              <Eye className="w-4 h-4" />
              {previewMode ? "Exit Preview" : "Preview"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ─── BODY ─── */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT SIDEBAR: Library + Settings */}
          {!previewMode && (
            <div className="w-64 border-r border-zinc-800 flex flex-col overflow-y-auto shrink-0">
              {/* Mode Selection */}
              <div className="p-3 border-b border-zinc-800 space-y-2">
                <Label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Match Mode</Label>
                <Select
                  value={config.mode}
                  onValueChange={(v) => setConfig(prev => ({ ...prev, mode: v as ShapeMatchBuilderConfig["mode"] }))}
                >
                  <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700 z-[250]">
                    {MODE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="text-xs">{opt.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-zinc-500">
                  {MODE_OPTIONS.find(o => o.value === config.mode)?.desc}
                </p>
              </div>

              {/* Shape Library */}
              <div className="p-3 border-b border-zinc-800 space-y-2">
                <Label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Add Shape (Draggable)</Label>
                <div className="grid grid-cols-3 gap-1">
                  {SHAPES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => addShape(s.value, "blue")}
                      className="flex flex-col items-center gap-1 p-2 rounded hover:bg-zinc-800 transition-colors"
                      title={`Add ${s.label}`}
                    >
                      <CanvasShape shape={s.value} color="blue" size={28} />
                      <span className="text-[9px] text-zinc-500">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Drop Zone Library */}
              <div className="p-3 border-b border-zinc-800 space-y-2">
                <Label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Add Drop Zone</Label>
                <div className="grid grid-cols-3 gap-1">
                  {SHAPES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => addDropZone(s.value, "blue")}
                      className="flex flex-col items-center gap-1 p-2 rounded hover:bg-zinc-800 transition-colors"
                      title={`Add ${s.label} zone`}
                    >
                      <CanvasDropZone shape={s.value} color="blue" width={28} height={28} />
                      <span className="text-[9px] text-zinc-500">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Settings */}
              <div className="p-3 space-y-3">
                <Label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Settings</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="snap-grid"
                    checked={config.snapToGrid}
                    onCheckedChange={(v) => setConfig(prev => ({ ...prev, snapToGrid: v }))}
                  />
                  <Label htmlFor="snap-grid" className="text-xs text-zinc-400">Snap to grid</Label>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-zinc-500">Time Limit (seconds)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={300}
                    value={config.timeLimit || ""}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      timeLimit: e.target.value ? parseInt(e.target.value) : undefined,
                    }))}
                    placeholder="No limit"
                    className="bg-zinc-800/50 border-zinc-700/50 h-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-zinc-500">Instructions</Label>
                  <Input
                    value={config.instructions || ""}
                    onChange={(e) => setConfig(prev => ({ ...prev, instructions: e.target.value }))}
                    placeholder="Drag each shape..."
                    className="bg-zinc-800/50 border-zinc-700/50 h-7 text-xs"
                  />
                </div>

                {/* Validation */}
                {validationIssues.length > 0 && (
                  <div className="space-y-1 pt-2">
                    {validationIssues.map((issue, i) => (
                      <p key={i} className="text-[10px] text-amber-400 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                        {issue}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── CANVAS ─── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Canvas toolbar */}
            {!previewMode && (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 text-xs shrink-0">
                {linkingFrom ? (
                  <div className="flex items-center gap-2 text-primary">
                    <Link2 className="w-3.5 h-3.5 animate-pulse" />
                    <span>Click a drop zone to link shape → zone</span>
                    <Button variant="ghost" size="sm" onClick={() => setLinkingFrom(null)} className="h-6 text-xs text-zinc-400">
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="text-zinc-500">Click an item to select · Drag to reposition · </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfig(defaultConfig())}
                      className="h-6 text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Reset
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Canvas area */}
            <div className="flex-1 relative p-4 overflow-hidden">
              <div
                ref={canvasRef}
                className={cn(
                  "relative w-full h-full rounded-xl border-2 border-dashed overflow-hidden",
                  config.snapToGrid && "bg-[radial-gradient(circle,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:5%_5%]",
                  previewMode ? "border-zinc-700 bg-zinc-950" : "border-zinc-700/50 bg-zinc-950/80"
                )}
              >
                {/* Drop Zones (rendered behind shapes) */}
                {config.dropZones.map(zone => {
                  const isLinked = Object.values(config.correctMatches).includes(zone.id);
                  const linkedShape = Object.entries(config.correctMatches).find(([, v]) => v === zone.id)?.[0];
                  const isSelected = selectedItem?.type === "zone" && selectedItem.id === zone.id;

                  return (
                    <motion.div
                      key={zone.id}
                      className={cn(
                        "absolute cursor-pointer flex flex-col items-center justify-center",
                        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-zinc-950 rounded-lg",
                        linkingFrom && "cursor-crosshair hover:ring-2 hover:ring-primary/50 rounded-lg"
                      )}
                      style={{
                        left: `${zone.x}%`,
                        top: `${zone.y}%`,
                        width: zone.width,
                        height: zone.height,
                        transform: "translate(-50%, -50%)",
                      }}
                      drag={!previewMode && !linkingFrom}
                      dragMomentum={false}
                      dragSnapToOrigin
                      onDragEnd={(_, info) => handleCanvasDrag("zone", zone.id, info)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (linkingFrom) {
                          completeLink(zone.id);
                        } else {
                          setSelectedItem(isSelected ? null : { type: "zone", id: zone.id });
                        }
                      }}
                    >
                      <CanvasDropZone shape={zone.shape} color={zone.color} width={zone.width} height={zone.height} />
                      {zone.label && (
                        <span className="absolute -bottom-5 text-[9px] text-zinc-500 whitespace-nowrap">{zone.label}</span>
                      )}
                      {isLinked && !previewMode && (
                        <span className="absolute -top-3 right-0 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                          <Link2 className="w-2.5 h-2.5 text-white" />
                        </span>
                      )}
                    </motion.div>
                  );
                })}

                {/* Draggable Shapes (rendered above zones) */}
                {config.draggableItems.map(shape => {
                  const isLinked = !!config.correctMatches[shape.id];
                  const linkedZone = config.correctMatches[shape.id];
                  const isSelected = selectedItem?.type === "shape" && selectedItem.id === shape.id;
                  const isLinking = linkingFrom === shape.id;

                  return (
                    <motion.div
                      key={shape.id}
                      className={cn(
                        "absolute cursor-grab active:cursor-grabbing z-10 flex flex-col items-center",
                        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-zinc-950 rounded-full",
                        isLinking && "ring-2 ring-primary animate-pulse rounded-full"
                      )}
                      style={{
                        left: `${shape.x}%`,
                        top: `${shape.y}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                      drag={!previewMode}
                      dragMomentum={false}
                      dragSnapToOrigin
                      onDragEnd={(_, info) => handleCanvasDrag("shape", shape.id, info)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (linkingFrom && linkingFrom !== shape.id) return;
                        setSelectedItem(isSelected ? null : { type: "shape", id: shape.id });
                      }}
                      whileHover={{ scale: 1.1 }}
                      whileDrag={{ scale: 1.15, zIndex: 50 }}
                    >
                      <CanvasShape shape={shape.shape} color={shape.color} size={48} />
                      {shape.label && (
                        <span className="absolute -bottom-5 text-[9px] text-zinc-400 whitespace-nowrap">{shape.label}</span>
                      )}
                      {isLinked && !previewMode && (
                        <span className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                          <Link2 className="w-2.5 h-2.5 text-white" />
                        </span>
                      )}
                    </motion.div>
                  );
                })}

                {/* Link lines — draw SVG lines between linked shapes and zones */}
                {!previewMode && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                    {Object.entries(config.correctMatches).map(([shapeId, zoneId]) => {
                      const shape = config.draggableItems.find(s => s.id === shapeId);
                      const zone = config.dropZones.find(z => z.id === zoneId);
                      if (!shape || !zone) return null;
                      return (
                        <line
                          key={`${shapeId}-${zoneId}`}
                          x1={`${shape.x}%`}
                          y1={`${shape.y}%`}
                          x2={`${zone.x}%`}
                          y2={`${zone.y}%`}
                          stroke="rgba(168, 85, 247, 0.4)"
                          strokeWidth="2"
                          strokeDasharray="6 4"
                        />
                      );
                    })}
                  </svg>
                )}

                {/* Empty state */}
                {config.draggableItems.length === 0 && config.dropZones.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600">
                    <Target className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm font-medium">Empty Canvas</p>
                    <p className="text-xs mt-1">Add shapes and drop zones from the left panel</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR: Properties */}
          {!previewMode && (selectedShape || selectedZone) && (
            <div className="w-56 border-l border-zinc-800 overflow-y-auto shrink-0">
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                    {selectedShape ? "Shape Properties" : "Zone Properties"}
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedItem(null)}
                    className="h-5 w-5 p-0 text-zinc-500"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>

                {/* Shape type */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-zinc-500">Shape</Label>
                  <Select
                    value={selectedShape?.shape || selectedZone?.shape || "circle"}
                    onValueChange={(v) => {
                      if (selectedShape) updateShapeProps(selectedShape.id, { shape: v as ShapeType });
                      if (selectedZone) updateZoneProps(selectedZone.id, { shape: v as ShapeType });
                    }}
                  >
                    <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700 z-[250]">
                      {SHAPES.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          <span className="text-xs">{s.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Color */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-zinc-500">Color</Label>
                  <div className="flex flex-wrap gap-1">
                    {COLORS.map(c => {
                      const isActive = (selectedShape?.color || selectedZone?.color) === c.value;
                      return (
                        <button
                          key={c.value}
                          onClick={() => {
                            if (selectedShape) updateShapeProps(selectedShape.id, { color: c.value });
                            if (selectedZone) updateZoneProps(selectedZone.id, { color: c.value });
                          }}
                          className={cn(
                            "w-6 h-6 rounded-full border-2 transition-all",
                            c.bg,
                            isActive ? `${c.ring} ring-2 ring-offset-1 ring-offset-zinc-900 border-white` : "border-zinc-700 hover:border-zinc-500"
                          )}
                          title={c.label}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Label */}
                <div className="space-y-1">
                  <Label className="text-[10px] text-zinc-500">Label (optional)</Label>
                  <Input
                    value={selectedShape?.label || selectedZone?.label || ""}
                    onChange={(e) => {
                      if (selectedShape) updateShapeProps(selectedShape.id, { label: e.target.value || undefined });
                      if (selectedZone) updateZoneProps(selectedZone.id, { label: e.target.value || undefined });
                    }}
                    placeholder="e.g. Red circle"
                    className="bg-zinc-800/50 border-zinc-700/50 h-7 text-xs"
                  />
                </div>

                {/* Zone size */}
                {selectedZone && (
                  <div className="space-y-1">
                    <Label className="text-[10px] text-zinc-500">Size</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[9px] text-zinc-600">W</Label>
                        <Input
                          type="number"
                          min={40}
                          max={200}
                          value={selectedZone.width}
                          onChange={(e) => updateZoneProps(selectedZone.id, { width: parseInt(e.target.value) || 100 })}
                          className="bg-zinc-800/50 border-zinc-700/50 h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[9px] text-zinc-600">H</Label>
                        <Input
                          type="number"
                          min={40}
                          max={200}
                          value={selectedZone.height}
                          onChange={(e) => updateZoneProps(selectedZone.id, { height: parseInt(e.target.value) || 100 })}
                          className="bg-zinc-800/50 border-zinc-700/50 h-7 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Linking */}
                {selectedShape && (
                  <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                    <Label className="text-[10px] text-zinc-500">Correct Match</Label>
                    {config.correctMatches[selectedShape.id] ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                          Linked to {config.dropZones.find(z => z.id === config.correctMatches[selectedShape.id])?.label || "zone"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLink(selectedShape.id)}
                          className="h-5 text-[10px] text-zinc-500 hover:text-destructive"
                        >
                          <Unlink2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startLink(selectedShape.id)}
                        className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10 w-full"
                      >
                        <Link2 className="w-3 h-3 mr-1" />
                        Link to drop zone
                      </Button>
                    )}
                  </div>
                )}

                {/* Delete */}
                <div className="pt-2 border-t border-zinc-800">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(selectedItem!.type, selectedItem!.id)}
                    className="h-7 text-xs text-destructive hover:text-destructive w-full"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete {selectedShape ? "Shape" : "Zone"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── FOOTER ─── */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 shrink-0">
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            {validationIssues.length > 0 && (
              <span className="text-amber-400">{validationIssues.length} issue(s)</span>
            )}
            <span>{Object.keys(config.correctMatches).length} link(s) set</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} className="text-zinc-400">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={config.draggableItems.length === 0 || config.dropZones.length === 0}
              className="gap-1.5"
            >
              <Save className="w-4 h-4" />
              Save Configuration
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── CONVERTER: Builder config → Runtime ShapeMatchConfig ───
// Converts the visual builder's output into the format expected by ShapeMatchQuestion
export function builderConfigToRuntime(builderConfig: ShapeMatchBuilderConfig) {
  return {
    mode: builderConfig.mode,
    shapes: builderConfig.draggableItems.map(item => ({
      id: item.id,
      shape: item.shape,
      color: item.color,
      targetId: builderConfig.correctMatches[item.id] || "",
    })),
    targets: builderConfig.dropZones.map(zone => ({
      id: zone.id,
      shape: zone.shape,
      color: zone.color,
      label: zone.label,
    })),
    timeLimit: builderConfig.timeLimit,
    showFeedback: true,
    allowRetry: true,
    instructions: builderConfig.instructions,
  };
}
