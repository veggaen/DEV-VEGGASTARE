"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Home,
  RotateCcw,
  GripVertical,
  Layers,
  Menu,
  X,
  Share2,
  Copy,
  Check,
  BarChart3,
  Settings,
  Maximize2,
  Minimize2,
  MoveHorizontal,
  MoveVertical,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BarPosition = "top" | "bottom" | "left" | "right";

interface Section {
  id: string;
  title: string;
  questionCount: number;
  answeredCount: number;
}

interface PollNavigationBarProps {
  // Navigation state
  currentSection: number;
  currentQuestion: number;
  totalSections: number;
  totalQuestions: number;
  sections: Section[];
  
  // Navigation handlers
  onPrevQuestion: () => void;
  onNextQuestion: () => void;
  onPrevSection: () => void;
  onNextSection: () => void;
  onGoToSection: (sectionIndex: number) => void;
  onGoToQuestion: (sectionIndex: number, questionIndex: number) => void;
  onRestart: () => void;
  onHome: () => void;
  onViewResults?: () => void;
  
  // URL sharing
  shareableUrl?: string;
  onCopyUrl?: () => void;
  
  // Progress
  answeredCount: number;
  progressPercent: number;
  
  // Position management
  defaultPosition?: BarPosition;
  onPositionChange?: (position: BarPosition) => void;
  
  // Additional options
  canGoBack: boolean;
  canGoForward: boolean;
  isComplete?: boolean;
  pollTitle?: string;
}

// ─── Storage Key ──────────────────────────────────────────────────────────────

const NAV_BAR_POSITION_KEY = "veggastare:poll-nav-bar-position";

function loadBarPosition(): BarPosition {
  if (typeof window === "undefined") return "bottom";
  try {
    const saved = localStorage.getItem(NAV_BAR_POSITION_KEY);
    if (saved && ["top", "bottom", "left", "right"].includes(saved)) {
      return saved as BarPosition;
    }
  } catch {}
  return "bottom";
}

function saveBarPosition(position: BarPosition): void {
  try {
    localStorage.setItem(NAV_BAR_POSITION_KEY, position);
  } catch {}
}

// ─── Drop Zone Component ──────────────────────────────────────────────────────

function DropZone({
  position,
  isActive,
  isHovered,
  onDrop,
}: {
  position: BarPosition;
  isActive: boolean;
  isHovered: boolean;
  onDrop: () => void;
}) {
  const positionStyles: Record<BarPosition, string> = {
    top: "top-0 left-0 right-0 h-16",
    bottom: "bottom-0 left-0 right-0 h-16",
    left: "top-0 left-0 bottom-0 w-16",
    right: "top-0 right-0 bottom-0 w-16",
  };

  const icons: Record<BarPosition, React.ReactNode> = {
    top: <ChevronUp className="w-5 h-5" />,
    bottom: <ChevronDown className="w-5 h-5" />,
    left: <ChevronLeft className="w-5 h-5" />,
    right: <ChevronRight className="w-5 h-5" />,
  };

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            "fixed z-9998 flex items-center justify-center",
            "border-2 border-dashed transition-colors duration-200",
            positionStyles[position],
            isHovered
              ? "bg-primary/20 border-primary"
              : "bg-primary/5 border-primary/30"
          )}
          onMouseUp={onDrop}
          onTouchEnd={onDrop}
        >
          <motion.div
            animate={{
              scale: isHovered ? 1.2 : 1,
              opacity: isHovered ? 1 : 0.5,
            }}
            className={cn(
              "p-2 rounded-full",
              isHovered ? "bg-primary text-primary-foreground" : "bg-muted"
            )}
          >
            {icons[position]}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PollNavigationBar({
  currentSection,
  currentQuestion,
  totalSections,
  totalQuestions,
  sections,
  onPrevQuestion,
  onNextQuestion,
  onPrevSection,
  onNextSection,
  onGoToSection,
  onGoToQuestion,
  onRestart,
  onHome,
  onViewResults,
  shareableUrl,
  onCopyUrl,
  answeredCount,
  progressPercent,
  defaultPosition = "bottom",
  onPositionChange,
  canGoBack,
  canGoForward,
  isComplete,
  pollTitle,
}: PollNavigationBarProps) {
  const [position, setPosition] = useState<BarPosition>(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredDropZone, setHoveredDropZone] = useState<BarPosition | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Load position from localStorage on mount
  useEffect(() => {
    const savedPosition = loadBarPosition();
    const timeoutId = window.setTimeout(() => setPosition(savedPosition), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  // Handle position change
  const handlePositionChange = useCallback(
    (newPosition: BarPosition) => {
      setPosition(newPosition);
      saveBarPosition(newPosition);
      onPositionChange?.(newPosition);
      setIsDragging(false);
      setHoveredDropZone(null);
    },
    [onPositionChange]
  );

  // Determine which drop zone is being hovered based on mouse position
  const handleDrag = useCallback((event: MouseEvent | TouchEvent | PointerEvent) => {
    const clientX = "touches" in event ? event.touches[0].clientX : (event as MouseEvent).clientX;
    const clientY = "touches" in event ? event.touches[0].clientY : (event as MouseEvent).clientY;
    
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const threshold = 80;

    if (clientY < threshold) {
      setHoveredDropZone("top");
    } else if (clientY > windowHeight - threshold) {
      setHoveredDropZone("bottom");
    } else if (clientX < threshold) {
      setHoveredDropZone("left");
    } else if (clientX > windowWidth - threshold) {
      setHoveredDropZone("right");
    } else {
      setHoveredDropZone(null);
    }
  }, []);

  // Handle copy URL
  const handleCopyUrl = useCallback(() => {
    if (shareableUrl) {
      navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      onCopyUrl?.();
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareableUrl, onCopyUrl]);

  // Get position-specific styles
  const isVertical = position === "left" || position === "right";
  
  const positionStyles: Record<BarPosition, string> = {
    top: "top-0 left-0 right-0 h-auto",
    bottom: "bottom-0 left-0 right-0 h-auto",
    left: "top-0 left-0 bottom-0 w-auto",
    right: "top-0 right-0 bottom-0 w-auto",
  };

  const containerClasses = cn(
    "fixed z-9999 transition-all duration-300",
    positionStyles[position],
    isDragging && "cursor-grabbing"
  );

  const barClasses = cn(
    "flex items-center gap-1.5 p-2 m-2",
    "bg-background/95 backdrop-blur-xl",
    "border border-border/50 rounded-xl",
    "shadow-lg shadow-black/20",
    isVertical ? "flex-col" : "flex-row justify-between"
  );

  // Current section info
  const currentSectionData = sections[currentSection];

  return (
    <TooltipProvider delayDuration={300}>
      {/* Drop Zones - shown when dragging */}
      {["top", "bottom", "left", "right"].map((pos) => (
        <DropZone
          key={pos}
          position={pos as BarPosition}
          isActive={isDragging}
          isHovered={hoveredDropZone === pos}
          onDrop={() => handlePositionChange(pos as BarPosition)}
        />
      ))}

      {/* Navigation Bar */}
      <motion.div
        ref={barRef}
        className={containerClasses}
        drag
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
        dragElastic={0.1}
        onDragStart={() => setIsDragging(true)}
        onDrag={(_, info) => handleDrag(info.point as unknown as MouseEvent)}
        onDragEnd={() => {
          if (hoveredDropZone) {
            handlePositionChange(hoveredDropZone);
          }
          setIsDragging(false);
          setHoveredDropZone(null);
        }}
        animate={{
          scale: isDragging ? 1.02 : 1,
          opacity: isDragging ? 0.9 : 1,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        <div className={barClasses}>
          {/* Drag Handle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                className={cn(
                  "p-1.5 rounded-lg cursor-grab active:cursor-grabbing",
                  "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  "transition-colors",
                  isDragging && "text-primary bg-primary/10"
                )}
                onPointerDown={(e) => dragControls.start(e)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                {isVertical ? (
                  <MoveVertical className="w-4 h-4" />
                ) : (
                  <MoveHorizontal className="w-4 h-4" />
                )}
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side={position === "bottom" ? "top" : position === "top" ? "bottom" : position === "left" ? "right" : "left"}>
              <p className="text-xs">Drag to reposition bar</p>
            </TooltipContent>
          </Tooltip>

          {/* Collapse/Expand Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{isExpanded ? "Collapse" : "Expand"}</p>
            </TooltipContent>
          </Tooltip>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className={cn(
                  "flex items-center gap-1.5 overflow-hidden",
                  isVertical ? "flex-col" : "flex-row"
                )}
              >
                {/* Menu */}
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Menu className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Menu</p>
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{pollTitle || "Poll Navigation"}</p>
                        <p className="text-xs text-muted-foreground">
                          {answeredCount}/{totalQuestions} answered ({progressPercent}%)
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onHome}>
                      <Home className="mr-2 h-4 w-4" />
                      Home / Welcome
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onRestart}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Restart Poll
                    </DropdownMenuItem>
                    {onViewResults && (
                      <DropdownMenuItem onClick={onViewResults}>
                        <BarChart3 className="mr-2 h-4 w-4" />
                        View Results
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Sections
                    </DropdownMenuLabel>
                    {sections.map((section, idx) => (
                      <DropdownMenuItem
                        key={section.id}
                        onClick={() => onGoToSection(idx)}
                        className={cn(
                          idx === currentSection && "bg-primary/10 text-primary"
                        )}
                      >
                        <span className="flex items-center justify-between w-full">
                          <span className="truncate">{idx + 1}. {section.title}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {section.answeredCount}/{section.questionCount}
                          </span>
                        </span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Bar Position
                    </DropdownMenuLabel>
                    {(["top", "bottom", "left", "right"] as BarPosition[]).map((pos) => (
                      <DropdownMenuItem
                        key={pos}
                        onClick={() => handlePositionChange(pos)}
                        className={cn(position === pos && "bg-primary/10 text-primary")}
                      >
                        {pos.charAt(0).toUpperCase() + pos.slice(1)}
                        {position === pos && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Home */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onHome}>
                      <Home className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Home / Start</p>
                  </TooltipContent>
                </Tooltip>

                {/* Section Selector */}
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 max-w-[120px]">
                          <Layers className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate text-xs">
                            {currentSection + 1}/{totalSections}
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Section {currentSection + 1}: {currentSectionData?.title}</p>
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent>
                    {sections.map((section, idx) => (
                      <DropdownMenuItem
                        key={section.id}
                        onClick={() => onGoToSection(idx)}
                        className={cn(idx === currentSection && "bg-primary/10")}
                      >
                        <div className="flex items-center justify-between w-full gap-4">
                          <span className="truncate">{idx + 1}. {section.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {section.answeredCount}/{section.questionCount}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Divider */}
                <div className={cn(
                  "bg-border",
                  isVertical ? "h-px w-6" : "w-px h-6"
                )} />

                {/* Back/Forward Navigation */}
                <div className={cn(
                  "flex items-center gap-0.5",
                  isVertical ? "flex-col" : "flex-row"
                )}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onPrevQuestion}
                        disabled={!canGoBack}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Previous Question</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Question indicator */}
                  <span className="text-xs text-muted-foreground px-1 min-w-[60px] text-center">
                    Q{currentQuestion + 1}/{currentSectionData?.questionCount || 0}
                  </span>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onNextQuestion}
                        disabled={!canGoForward}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Next Question</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Divider */}
                <div className={cn(
                  "bg-border",
                  isVertical ? "h-px w-6" : "w-px h-6"
                )} />

                {/* Progress Indicator */}
                <div className={cn(
                  "flex items-center gap-2",
                  isVertical ? "flex-col" : "flex-row"
                )}>
                  <div className={cn(
                    "bg-muted rounded-full overflow-hidden",
                    isVertical ? "w-1.5 h-12" : "h-1.5 w-16"
                  )}>
                    <motion.div
                      className="bg-primary rounded-full"
                      style={isVertical ? { width: "100%" } : { height: "100%" }}
                      initial={false}
                      animate={isVertical 
                        ? { height: `${progressPercent}%` }
                        : { width: `${progressPercent}%` }
                      }
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {progressPercent}%
                  </span>
                </div>

                {/* Share URL */}
                {shareableUrl && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleCopyUrl}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Share2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{copied ? "Copied!" : "Copy shareable link"}</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Results Button */}
                {onViewResults && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isComplete ? "default" : "ghost"}
                        size="icon"
                        className={cn("h-8 w-8", isComplete && "bg-primary")}
                        onClick={onViewResults}
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">View Results</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}

export default PollNavigationBar;
