"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Plus,
  MessageSquare,
  X,
  Check,
  Sparkles,
  Send,
  Pencil,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionCommentButtonProps {
  questionId: string;
  comment?: string;
  onCommentChange: (comment: string) => void;
  placeholder?: string;
  maxLength?: number;
  position?: "inline" | "corner" | "floating";
  size?: "sm" | "md" | "lg";
  variant?: "default" | "minimal" | "prominent";
  disabled?: boolean;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function QuestionCommentButton({
  questionId,
  comment = "",
  onCommentChange,
  placeholder = "Add your thoughts, feedback, or suggestions...",
  maxLength = 500,
  position = "inline",
  size = "md",
  variant = "default",
  disabled = false,
}: QuestionCommentButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localComment, setLocalComment] = useState(comment);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync with external comment
  useEffect(() => {
    setLocalComment(comment);
  }, [comment]);

  // Focus textarea when expanded
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        if (isExpanded && localComment === comment) {
          setIsExpanded(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isExpanded, localComment, comment]);

  const handleSave = useCallback(() => {
    onCommentChange(localComment);
    setIsExpanded(false);
  }, [localComment, onCommentChange]);

  const handleCancel = useCallback(() => {
    setLocalComment(comment);
    setIsExpanded(false);
  }, [comment]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
      } else if (e.key === "Enter" && e.metaKey) {
        handleSave();
      }
    },
    [handleCancel, handleSave]
  );

  const hasComment = comment.trim().length > 0;
  const hasUnsavedChanges = localComment !== comment;

  // Size variants
  const sizeClasses = {
    sm: {
      button: "h-6 w-6",
      icon: "w-3 h-3",
      expandedWidth: "w-64",
    },
    md: {
      button: "h-8 w-8",
      icon: "w-4 h-4",
      expandedWidth: "w-80",
    },
    lg: {
      button: "h-10 w-10",
      icon: "w-5 h-5",
      expandedWidth: "w-96",
    },
  };

  const currentSize = sizeClasses[size];

  // Position variants
  const positionClasses = {
    inline: "",
    corner: "absolute top-2 right-2",
    floating: "fixed bottom-4 right-4 z-50",
  };

  // Variant styles
  const getButtonStyles = () => {
    if (variant === "minimal") {
      return cn(
        "rounded-full transition-all",
        hasComment
          ? "text-primary bg-primary/10 hover:bg-primary/20"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      );
    }

    if (variant === "prominent") {
      return cn(
        "rounded-full transition-all shadow-md",
        hasComment
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:opacity-90"
      );
    }

    // Default
    return cn(
      "rounded-full border-2 transition-all",
      hasComment
        ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
        : "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5"
    );
  };

  return (
    <TooltipProvider>
      <div
        ref={containerRef}
        className={cn("relative", positionClasses[position])}
      >
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            /* Collapsed state - Button */
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  key="collapsed"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => !disabled && setIsExpanded(true)}
                  disabled={disabled}
                  className={cn(
                    "flex items-center justify-center",
                    currentSize.button,
                    getButtonStyles(),
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {hasComment ? (
                    <MessageSquare className={currentSize.icon} />
                  ) : (
                    <Plus className={currentSize.icon} />
                  )}
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px]">
                {hasComment ? (
                  <div className="space-y-1">
                    <p className="font-medium text-xs flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Edit comment
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {comment}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-primary" />
                    Add a comment
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          ) : (
            /* Expanded state - Comment input */
            <motion.div
              key="expanded"
              initial={{ scale: 0.95, opacity: 0, width: 40 }}
              animate={{
                scale: 1,
                opacity: 1,
                width: "auto",
              }}
              exit={{ scale: 0.95, opacity: 0, width: 40 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={cn(
                "bg-card border border-border rounded-xl shadow-xl overflow-hidden",
                currentSize.expandedWidth
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/50">
                <span className="text-xs font-medium flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  {hasComment ? "Edit Comment" : "Add Comment"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleCancel}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Input */}
              <div className="p-3 space-y-3">
                <Textarea
                  ref={textareaRef}
                  value={localComment}
                  onChange={(e) => setLocalComment(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  maxLength={maxLength}
                  className="min-h-[80px] text-sm resize-none bg-background/50"
                />

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {localComment.length}/{maxLength}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancel}
                      className="h-7 px-2 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={!hasUnsavedChanges && !localComment.trim()}
                      className="h-7 px-3 text-xs gap-1"
                    >
                      {hasUnsavedChanges ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Save
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          Done
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Keyboard hint */}
                <p className="text-[10px] text-muted-foreground/60 text-center">
                  Press <kbd className="px-1 bg-muted rounded">⌘↵</kbd> to save,{" "}
                  <kbd className="px-1 bg-muted rounded">Esc</kbd> to cancel
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}

// ─── Compact inline variant ───────────────────────────────────────────────────

export function InlineCommentButton({
  questionId,
  comment = "",
  onCommentChange,
  disabled = false,
}: {
  questionId: string;
  comment?: string;
  onCommentChange: (comment: string) => void;
  disabled?: boolean;
}) {
  return (
    <QuestionCommentButton
      questionId={questionId}
      comment={comment}
      onCommentChange={onCommentChange}
      size="sm"
      variant="minimal"
      position="inline"
      disabled={disabled}
    />
  );
}

// ─── Prominent floating variant ───────────────────────────────────────────────

export function FloatingCommentButton({
  questionId,
  comment = "",
  onCommentChange,
  disabled = false,
}: {
  questionId: string;
  comment?: string;
  onCommentChange: (comment: string) => void;
  disabled?: boolean;
}) {
  return (
    <QuestionCommentButton
      questionId={questionId}
      comment={comment}
      onCommentChange={onCommentChange}
      size="lg"
      variant="prominent"
      position="floating"
      disabled={disabled}
    />
  );
}

export default QuestionCommentButton;
