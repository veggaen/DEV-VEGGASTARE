"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

interface WeightItem {
  id: string;
  label: string;
  icon?: string;
  color: string;
  defaultWeight: number;
}

interface WeightAdjusterProps {
  items: WeightItem[];
  value?: Record<string, number>;
  onChange: (weights: Record<string, number>) => void;
  totalWeight?: number;
  instruction?: string;
}

// Individual slider component with pointer events for smooth tracking
function WeightSlider({
  item,
  weight,
  index,
  onWeightChange,
}: {
  item: WeightItem;
  weight: number;
  index: number;
  onWeightChange: (itemId: string, newWeight: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localWeight, setLocalWeight] = useState<number | null>(null);
  
  const currentWeight = localWeight ?? weight;
  const percentage = (currentWeight / 60) * 100; // Max is 60%

  const calculateWeightFromPointer = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return weight;
      const rect = trackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      const rawWeight = 5 + pct * 55; // Range 5-60
      return Math.round(rawWeight);
    },
    [weight]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      const newWeight = calculateWeightFromPointer(e.clientX);
      setLocalWeight(newWeight);
      onWeightChange(item.id, newWeight);
    },
    [calculateWeightFromPointer, onWeightChange, item.id]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const newWeight = calculateWeightFromPointer(e.clientX);
      setLocalWeight(newWeight);
      onWeightChange(item.id, newWeight);
    },
    [isDragging, calculateWeightFromPointer, onWeightChange, item.id]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setLocalWeight(null);
  }, []);

  return (
    <motion.div
      className="space-y-2"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      {/* Label row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{item.icon}</span>
          <span className="text-sm font-medium">{item.label}</span>
        </div>
        <motion.span
          className="text-lg font-bold tabular-nums"
          style={{ color: item.color }}
          key={currentWeight}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
        >
          {Math.round(currentWeight)}%
        </motion.span>
      </div>

      {/* Slider track with pointer events */}
      <div
        ref={trackRef}
        className="relative h-4 rounded-full bg-muted cursor-pointer touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Filled track */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full pointer-events-none"
          style={{ 
            backgroundColor: item.color,
            width: `${Math.min(100, percentage)}%`,
          }}
          initial={false}
          animate={{ width: `${Math.min(100, percentage)}%` }}
          transition={{ type: "spring", stiffness: 400, damping: 40 }}
        />

        {/* Thumb - purely visual */}
        <motion.div
          className="absolute top-1/2 w-6 h-6 rounded-full bg-white shadow-lg border-2 pointer-events-none"
          style={{
            left: `calc(${Math.min(100, percentage)}% - 12px)`,
            borderColor: item.color,
            y: "-50%",
          }}
          initial={false}
          animate={{
            scale: isDragging ? 1.2 : 1,
            boxShadow: isDragging
              ? `0 0 15px 3px ${item.color}40`
              : "0 2px 8px rgba(0,0,0,0.15)",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      </div>
    </motion.div>
  );
}

export function WeightAdjuster({
  items,
  value,
  onChange,
  totalWeight = 100,
  instruction = "Drag the sliders to adjust how much each factor matters",
}: WeightAdjusterProps) {
  // Initialize weights from value or defaults
  const weights = useMemo(() => {
    if (value && Object.keys(value).length > 0) return value;
    return Object.fromEntries(items.map((item) => [item.id, item.defaultWeight]));
  }, [value, items]);

  // Normalize weights to sum to totalWeight
  const normalizedWeights = useMemo(() => {
    const normalized = { ...weights };
    const sum = Object.values(normalized).reduce((a, b) => a + b, 0);
    if (sum !== totalWeight && sum > 0) {
      const factor = totalWeight / sum;
      Object.keys(normalized).forEach((key) => {
        normalized[key] = Math.round(normalized[key] * factor);
      });
    }
    return normalized;
  }, [weights, totalWeight]);

  const handleWeightChange = useCallback(
    (itemId: string, newWeight: number) => {
      const newWeights = { ...normalizedWeights };
      const oldWeight = newWeights[itemId];
      const diff = newWeight - oldWeight;
      
      const otherItems = items.filter((i) => i.id !== itemId);
      const otherSum = otherItems.reduce((sum, i) => sum + newWeights[i.id], 0);
      
      if (otherSum > 0 && diff !== 0) {
        otherItems.forEach((i) => {
          const share = newWeights[i.id] / otherSum;
          newWeights[i.id] = Math.max(5, Math.round(newWeights[i.id] - diff * share));
        });
      }
      
      newWeights[itemId] = newWeight;
      
      // Final normalization
      const finalSum = Object.values(newWeights).reduce((a, b) => a + b, 0);
      if (finalSum !== totalWeight) {
        const adjustment = totalWeight - finalSum;
        if (newWeights[itemId] + adjustment >= 5 && newWeights[itemId] + adjustment <= 60) {
          newWeights[itemId] += adjustment;
        }
      }
      
      onChange(newWeights);
    },
    [normalizedWeights, items, totalWeight, onChange]
  );

  return (
    <div className="space-y-6">
      {/* Instruction */}
      <motion.p
        className="text-center text-sm text-muted-foreground"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {instruction}
      </motion.p>

      {/* Weight Sliders */}
      <div className="space-y-5 px-2">
        {items.map((item, index) => {
          const weight = normalizedWeights[item.id] || item.defaultWeight;
          return (
            <WeightSlider
              key={item.id}
              item={item}
              weight={weight}
              index={index}
              onWeightChange={handleWeightChange}
            />
          );
        })}
      </div>

      {/* Visual summary bar */}
      <motion.div
        className="h-6 rounded-full overflow-hidden flex"
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.3 }}
      >
        {items.map((item) => {
          const weight = normalizedWeights[item.id] || 0;
          return (
            <motion.div
              key={item.id}
              className="h-full flex items-center justify-center text-xs font-bold text-white overflow-hidden"
              style={{ backgroundColor: item.color }}
              initial={{ width: 0 }}
              animate={{ width: `${weight}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
            >
              {weight >= 10 && <span>{Math.round(weight)}%</span>}
            </motion.div>
          );
        })}
      </motion.div>

      {/* Legend */}
      <motion.div
        className="flex flex-wrap justify-center gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-1 text-xs">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export default WeightAdjuster;
