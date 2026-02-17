"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, Undo } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChoiceOption {
  id: string;
  text: string;
  icon?: string;
  description?: string;
  followUp?: BranchQuestion;
}

interface BranchQuestion {
  id: string;
  question: string;
  subtitle?: string;
  options: ChoiceOption[];
}

interface BranchingChoiceProps {
  question: BranchQuestion;
  value?: { path: string[]; answers: Record<string, string> };
  onChange: (value: { path: string[]; answers: Record<string, string> }) => void;
  maxDepth?: number;
  instruction?: string;
}

function QuestionLevel({
  question,
  depth,
  value,
  onSelect,
  isActive,
}: {
  question: BranchQuestion;
  depth: number;
  value?: string;
  onSelect: (optionId: string, followUp?: BranchQuestion) => void;
  isActive: boolean;
}) {
  return (
    <motion.div
      className={cn(
        "relative",
        depth > 0 && "ml-4 pl-4 border-l-2 border-primary/30"
      )}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: isActive ? 1 : 0.5, x: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Question */}
      <motion.div
        className="mb-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {depth > 0 && (
          <motion.div
            className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary/20 border-2 border-primary"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          />
        )}
        <h3 className={cn(
          "font-semibold",
          depth === 0 ? "text-xl" : "text-lg",
          !isActive && "text-muted-foreground"
        )}>
          {question.question}
        </h3>
        {question.subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{question.subtitle}</p>
        )}
      </motion.div>

      {/* Options */}
      <div className="space-y-2">
        {question.options.map((option, idx) => {
          const isSelected = value === option.id;
          const hasFollowUp = !!option.followUp;

          return (
            <motion.button
              key={option.id}
              onClick={() => onSelect(option.id, option.followUp)}
              disabled={!isActive}
              className={cn(
                "w-full flex items-center gap-3 p-4 rounded-2xl text-left",
                "border-2 transition-all duration-200",
                isSelected
                  ? "border-primary bg-primary/10 shadow-lg"
                  : isActive
                  ? "border-border hover:border-primary/50 bg-white/50 dark:bg-white/5"
                  : "border-muted bg-muted/50 opacity-50",
                !isActive && "cursor-not-allowed"
              )}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 + 0.2 }}
              whileHover={isActive ? { scale: 1.01, x: 4 } : {}}
              whileTap={isActive ? { scale: 0.99 } : {}}
            >
              {/* Selection indicator */}
              <motion.div
                className={cn(
                  "shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center",
                  isSelected
                    ? "border-primary bg-primary text-white"
                    : "border-muted-foreground/30"
                )}
                animate={{ scale: isSelected ? 1 : 0.9 }}
              >
                {isSelected && <Check className="w-4 h-4" />}
              </motion.div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {option.icon && <span className="text-xl">{option.icon}</span>}
                  <span className="font-medium">{option.text}</span>
                </div>
                {option.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">{option.description}</p>
                )}
              </div>

              {/* Follow-up indicator */}
              {hasFollowUp && (
                <motion.div
                  className="shrink-0"
                  animate={{ x: isSelected ? [0, 4, 0] : 0 }}
                  transition={{ repeat: isSelected ? Infinity : 0, duration: 1.5 }}
                >
                  <ChevronRight className={cn(
                    "w-5 h-5",
                    isSelected ? "text-primary" : "text-muted-foreground/50"
                  )} />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

export function BranchingChoice({
  question,
  value = { path: [], answers: {} },
  onChange,
  maxDepth = 3,
  instruction,
}: BranchingChoiceProps) {
  const [currentPath, setCurrentPath] = useState<BranchQuestion[]>([question]);

  const handleSelect = useCallback(
    (depth: number, optionId: string, followUp?: BranchQuestion) => {
      const newPath = [...value.path.slice(0, depth), optionId];
      const newAnswers = { ...value.answers };
      
      // Clear answers for deeper levels
      currentPath.slice(depth + 1).forEach((q) => {
        delete newAnswers[q.id];
      });
      
      // Set the new answer
      newAnswers[currentPath[depth].id] = optionId;
      
      onChange({ path: newPath, answers: newAnswers });

      // Update the visible path
      if (followUp && depth + 1 < maxDepth) {
        setCurrentPath([...currentPath.slice(0, depth + 1), followUp]);
      } else {
        setCurrentPath(currentPath.slice(0, depth + 1));
      }
    },
    [value, onChange, currentPath, maxDepth]
  );

  const goBack = useCallback(() => {
    if (currentPath.length > 1) {
      const newPath = currentPath.slice(0, -1);
      const newAnswers = { ...value.answers };
      delete newAnswers[currentPath[currentPath.length - 1].id];
      const newPathIds = value.path.slice(0, -1);
      
      setCurrentPath(newPath);
      onChange({ path: newPathIds, answers: newAnswers });
    }
  }, [currentPath, value, onChange]);

  return (
    <div className="space-y-6">
      {/* Instruction */}
      {instruction && (
        <motion.p
          className="text-center text-sm text-muted-foreground"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {instruction}
        </motion.p>
      )}

      {/* Breadcrumb path */}
      {value.path.length > 0 && (
        <motion.div
          className="flex items-center gap-2 flex-wrap"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
        >
          <button
            onClick={goBack}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Undo className="w-4 h-4" />
            Go back
          </button>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            {value.path.map((optionId, idx) => {
              const q = idx === 0 ? question : currentPath[idx];
              const option = q?.options.find((o) => o.id === optionId);
              return (
                <span key={idx} className="flex items-center gap-1">
                  {idx > 0 && <ChevronRight className="w-3 h-3" />}
                  <span>{option?.icon} {option?.text}</span>
                </span>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Question levels */}
      <AnimatePresence mode="wait">
        {currentPath.map((q, depth) => {
          const isActive = depth === currentPath.length - 1;
          const selectedOption = value.answers[q.id];

          return (
            <QuestionLevel
              key={`${q.id}-${depth}`}
              question={q}
              depth={depth}
              value={selectedOption}
              onSelect={(optionId, followUp) => handleSelect(depth, optionId, followUp)}
              isActive={isActive}
            />
          );
        })}
      </AnimatePresence>

      {/* Completion indicator */}
      <motion.div
        className="flex justify-center gap-2 mt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {currentPath.map((_, idx) => (
          <motion.div
            key={idx}
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              idx < value.path.length
                ? "bg-emerald-500"
                : idx === value.path.length
                ? "bg-primary animate-pulse"
                : "bg-muted"
            )}
            animate={{
              scale: idx === value.path.length ? [1, 1.2, 1] : 1,
            }}
            transition={{
              repeat: idx === value.path.length ? Infinity : 0,
              duration: 1.5,
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}

export default BranchingChoice;
