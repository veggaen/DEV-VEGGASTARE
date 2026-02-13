"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Save,
  Eye,
  X,
  Settings,
  Sliders,
  List,
  Type,
  Image as ImageIcon,
  Hash,
  Upload,
  Download,
  Shapes,
  GitBranch,
  LayoutGrid,
  Copy,
  Check,
  Sparkles,
  FolderPlus,
  FolderOpen,
  ChevronRight,
  Smile,
  Layers,
  ArrowUpDown,
  Undo2,
  Redo2,
  RotateCcw,
  FlaskConical,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PollImportModal, ImportedPoll, ImportedQuestion } from "@/components/uicustom/polls/PollImportModal";
import { generateREACHTemplate } from "@/components/uicustom/polls/reach-poll-template";
import { generateVerifyPollDemoTemplate } from "@/components/uicustom/polls/verify-poll-demo-template";
import { generateFeatureExplorerTemplate } from "@/components/uicustom/polls/feature-explorer-quiz-template";
import { generateCannaCocoQuizTemplate } from "@/components/uicustom/polls/canna-coco-quiz-template";
import { ShapeMatchVisualBuilder, ShapeMatchBuilderConfig, builderConfigToRuntime } from "@/components/uicustom/polls/ShapeMatchVisualBuilder";

// Max nesting depth for sections (3 levels: section → subsection → sub-subsection)
const MAX_SECTION_DEPTH = 3;

// Types
type QuestionType = "SINGLE_CHOICE" | "MULTI_CHOICE" | "SLIDER" | "SCALE" | "TEXT" | "RANKING" | "SHAPE_MATCH" | "UI_ARRANGE" | "NESTED";
export type PollType = "SIMPLE" | "SURVEY" | "QUIZ" | "FEEDBACK" | "REACH_ASSESSMENT";

// Flow-based ordering - each flow item points to a question or section by ID
export interface FlowItem {
  type: 'QUESTION' | 'SECTION';
  id: string;
}

interface SliderConfig {
  min?: number;  // Unified as 'min' for consistency
  max?: number;  // Unified as 'max' for consistency
  minValue?: number;  // Legacy support
  maxValue?: number;  // Legacy support
  step: number;
  minLabel: string;
  maxLabel: string;
  stepLabels?: string[];
  showValue?: boolean;
}

interface QuestionOption {
  id: string;
  text: string;
  description?: string;
  value?: number;
  imageUrl?: string;
}

// Section support for grouping questions
export interface PollSection {
  id: string;
  title: string;
  description?: string;
  flow: FlowItem[]; // Ordered list of questions and nested sections
  isCollapsed?: boolean;
  icon?: string; // Emoji or icon name
}

export interface PollQuestion {
  id: string;
  type: QuestionType;
  questionText: string;
  description?: string;
  required: boolean;
  allowImages: boolean;
  sliderConfig?: SliderConfig;
  shapeMatchPreset?: "basicShapes" | "outlineMatch" | "colorMatch" | "antiBot" | "advanced"; // SHAPE_MATCH preset name
  shapeMatchConfig?: ShapeMatchBuilderConfig | null; // Custom visual builder config (replaces preset)
  options: QuestionOption[];
  order?: number;
  // Quiz/assessment mode fields
  correctAnswer?: string | string[] | null;  // optionId(s) for correct answer
  explanation?: string | null;               // Why this is correct (shown after commit)
  wrongExplanation?: string | null;          // Why they got it wrong (shown when incorrect)
  deepExplanation?: string | null;           // Optional second-layer clarification shown on demand
  commitRequired?: boolean;                  // Whether user must "commit" before seeing feedback
  trickQuestion?: boolean;                   // Marks as trick question; shows extra feedback after lock-in
}

export interface PollBuilderData {
  title: string;
  description: string;
  type: PollType;
  allowPartialSubmission: boolean;
  showProgressBar: boolean;
  randomizeQuestions: boolean;
  expiresAt?: string;
  flow: FlowItem[]; // Top-level flow - the "playlist" order
  sections: PollSection[]; // Storage for all sections (lookup by id)
  questions: PollQuestion[]; // Storage for all questions (lookup by id)
}

// History entry for undo/redo with full UI state
interface HistoryEntry {
  data: PollBuilderData;
  expandedQuestions: string[]; // Set stored as array for serialization
  selectedElementId: string | null;
  multiSelectedIds: string[]; // Set stored as array
  description: string; // Human-readable description of what changed
  timestamp: number;
}

interface PollBuilderProps {
  initialData?: Partial<PollBuilderData>;
  onSave: (data: PollBuilderData) => Promise<void>;
  onPreview?: (data: PollBuilderData) => void;
  className?: string;
}

// Default values
const DEFAULT_SLIDER_CONFIG: SliderConfig = {
  min: 1,
  max: 7,
  minValue: 1,  // Legacy
  maxValue: 7,  // Legacy
  step: 1,
  minLabel: "Low",
  maxLabel: "High",
  stepLabels: ["A", "B", "C", "D", "E", "F", "G"],
  showValue: true,
};

// Empty starter data â€” builder starts empty, user adds questions or loads example
function generateEmptyPollData(): Partial<PollBuilderData> {
  return {
    flow: [],
    sections: [],
    questions: [],
  };
}

const QUESTION_TYPE_ICONS = {
  SINGLE_CHOICE: List,
  MULTI_CHOICE: List,
  SLIDER: Sliders,
  SCALE: Hash,
  TEXT: Type,
  RANKING: GripVertical,
  SHAPE_MATCH: Shapes,
  UI_ARRANGE: LayoutGrid,
  NESTED: GitBranch,
};

// Extended emoji options for section icons with categories for search
const SECTION_EMOJI_OPTIONS: { emoji: string; keywords: string[] }[] = [
  // Business & Charts
  { emoji: "ðŸ“Š", keywords: ["chart", "graph", "analytics", "data", "business"] },
  { emoji: "ðŸ“ˆ", keywords: ["chart", "growth", "increase", "trending", "up"] },
  { emoji: "ðŸ“‰", keywords: ["chart", "decline", "decrease", "down", "loss"] },
  { emoji: "ðŸ’¹", keywords: ["chart", "stock", "money", "business"] },
  { emoji: "ðŸ“", keywords: ["folder", "file", "document", "organize"] },
  { emoji: "ðŸ“‚", keywords: ["folder", "open", "file", "document"] },
  { emoji: "ðŸ“‹", keywords: ["clipboard", "list", "checklist", "task"] },
  { emoji: "ðŸ“", keywords: ["memo", "note", "write", "document"] },
  { emoji: "âœï¸", keywords: ["pencil", "write", "edit", "draw"] },
  { emoji: "ðŸ—‚ï¸", keywords: ["folder", "index", "organize", "dividers"] },
  { emoji: "ðŸ“‘", keywords: ["bookmark", "tabs", "document"] },
  { emoji: "ðŸ—ƒï¸", keywords: ["cabinet", "file", "storage", "archive"] },
  // Goals & Achievement
  { emoji: "ðŸŽ¯", keywords: ["target", "goal", "aim", "focus", "bullseye"] },
  { emoji: "ðŸš€", keywords: ["rocket", "launch", "startup", "growth", "speed"] },
  { emoji: "âš¡", keywords: ["lightning", "fast", "energy", "power", "velocity"] },
  { emoji: "ðŸ”¥", keywords: ["fire", "hot", "trending", "popular"] },
  { emoji: "ðŸ’¡", keywords: ["idea", "light", "bulb", "innovation", "think"] },
  { emoji: "ðŸŒŸ", keywords: ["star", "glow", "special", "feature"] },
  { emoji: "â­", keywords: ["star", "favorite", "rating", "best"] },
  { emoji: "âœ¨", keywords: ["sparkle", "magic", "new", "shine"] },
  { emoji: "ðŸ†", keywords: ["trophy", "winner", "champion", "award"] },
  { emoji: "ðŸ¥‡", keywords: ["gold", "first", "winner", "medal"] },
  { emoji: "ðŸ¥ˆ", keywords: ["silver", "second", "medal"] },
  { emoji: "ðŸ¥‰", keywords: ["bronze", "third", "medal"] },
  { emoji: "ðŸŽ–ï¸", keywords: ["medal", "military", "honor", "award"] },
  { emoji: "ðŸ…", keywords: ["medal", "sports", "winner", "award"] },
  // Security & Privacy
  { emoji: "ðŸ”", keywords: ["lock", "key", "secure", "private", "password"] },
  { emoji: "ðŸ›¡ï¸", keywords: ["shield", "protect", "security", "defense"] },
  { emoji: "ðŸ”’", keywords: ["lock", "closed", "secure", "private"] },
  { emoji: "ðŸ”“", keywords: ["unlock", "open", "public"] },
  { emoji: "ðŸ”‘", keywords: ["key", "access", "unlock", "password"] },
  { emoji: "ðŸ—ï¸", keywords: ["key", "old", "vintage", "unlock"] },
  // People & Community
  { emoji: "ðŸ‘¤", keywords: ["person", "user", "profile", "account"] },
  { emoji: "ðŸ‘¥", keywords: ["people", "group", "team", "users", "community"] },
  { emoji: "ðŸ¤", keywords: ["handshake", "deal", "partnership", "agreement"] },
  { emoji: "ðŸ’¬", keywords: ["chat", "message", "comment", "speech", "talk"] },
  { emoji: "ðŸ‘‹", keywords: ["wave", "hello", "hi", "welcome", "greeting"] },
  { emoji: "ðŸ™‹", keywords: ["raise", "hand", "question", "vote"] },
  { emoji: "ðŸ‘", keywords: ["thumbs", "up", "like", "approve", "good"] },
  { emoji: "ðŸ‘Ž", keywords: ["thumbs", "down", "dislike", "bad"] },
  { emoji: "ðŸ§‘â€ðŸ’»", keywords: ["developer", "coder", "programmer", "tech"] },
  { emoji: "ðŸ‘¨â€ðŸ’¼", keywords: ["business", "man", "office", "professional"] },
  { emoji: "ðŸ‘©â€ðŸ’¼", keywords: ["business", "woman", "office", "professional"] },
  // Creative & Design
  { emoji: "ðŸŽ¨", keywords: ["art", "palette", "design", "creative", "color"] },
  { emoji: "ðŸ–¼ï¸", keywords: ["picture", "frame", "image", "photo", "art"] },
  { emoji: "ðŸŽ­", keywords: ["theater", "drama", "masks", "performance"] },
  { emoji: "ðŸŽª", keywords: ["circus", "tent", "event", "show"] },
  { emoji: "âœï¸", keywords: ["write", "hand", "signature", "author"] },
  { emoji: "ðŸ–Œï¸", keywords: ["brush", "paint", "art", "design"] },
  { emoji: "ðŸ–ï¸", keywords: ["crayon", "draw", "color", "kids"] },
  // Money & Finance
  { emoji: "ðŸ’°", keywords: ["money", "bag", "cash", "rich", "profit"] },
  { emoji: "ðŸ’Ž", keywords: ["diamond", "gem", "premium", "value", "luxury"] },
  { emoji: "ðŸ’µ", keywords: ["dollar", "money", "cash", "bill"] },
  { emoji: "ðŸ’³", keywords: ["card", "credit", "payment", "finance"] },
  { emoji: "ðŸ¦", keywords: ["bank", "finance", "money", "institution"] },
  { emoji: "ðŸ’¸", keywords: ["money", "fly", "spending", "expense"] },
  // Tech & Devices
  { emoji: "ðŸŒ", keywords: ["globe", "web", "internet", "world", "global"] },
  { emoji: "ðŸ”—", keywords: ["link", "chain", "connect", "url"] },
  { emoji: "ðŸ“±", keywords: ["phone", "mobile", "smartphone", "app"] },
  { emoji: "ðŸ’»", keywords: ["laptop", "computer", "device", "work"] },
  { emoji: "ðŸ–¥ï¸", keywords: ["desktop", "computer", "monitor", "screen"] },
  { emoji: "âŒ¨ï¸", keywords: ["keyboard", "type", "input", "computer"] },
  { emoji: "ðŸ–±ï¸", keywords: ["mouse", "click", "computer", "pointer"] },
  { emoji: "ðŸ”Œ", keywords: ["plug", "electric", "power", "connect"] },
  { emoji: "ðŸ“¡", keywords: ["satellite", "signal", "broadcast", "antenna"] },
  { emoji: "ðŸ¤–", keywords: ["robot", "ai", "bot", "automation"] },
  // Colors & Hearts
  { emoji: "â¤ï¸", keywords: ["heart", "red", "love", "favorite"] },
  { emoji: "ðŸ’™", keywords: ["heart", "blue", "love"] },
  { emoji: "ðŸ’š", keywords: ["heart", "green", "love", "eco"] },
  { emoji: "ðŸ’œ", keywords: ["heart", "purple", "love"] },
  { emoji: "ðŸ§¡", keywords: ["heart", "orange", "love"] },
  { emoji: "ðŸ’›", keywords: ["heart", "yellow", "love"] },
  { emoji: "ðŸ¤", keywords: ["heart", "white", "love", "pure"] },
  { emoji: "ðŸ–¤", keywords: ["heart", "black", "love", "dark"] },
  { emoji: "ðŸ’—", keywords: ["heart", "growing", "love"] },
  { emoji: "ðŸ’–", keywords: ["heart", "sparkle", "love"] },
  // Status & Indicators
  { emoji: "âœ…", keywords: ["check", "done", "complete", "yes", "success"] },
  { emoji: "âŒ", keywords: ["cross", "no", "wrong", "delete", "error"] },
  { emoji: "âš ï¸", keywords: ["warning", "alert", "caution", "danger"] },
  { emoji: "â„¹ï¸", keywords: ["info", "information", "help", "about"] },
  { emoji: "â“", keywords: ["question", "help", "ask", "unknown"] },
  { emoji: "â—", keywords: ["exclamation", "important", "alert"] },
  { emoji: "ðŸ””", keywords: ["bell", "notification", "alert", "ring"] },
  { emoji: "ðŸ“£", keywords: ["megaphone", "announce", "loud", "broadcast"] },
  { emoji: "ðŸš¨", keywords: ["siren", "alert", "emergency", "warning"] },
  { emoji: "ðŸ”´", keywords: ["red", "circle", "stop", "off"] },
  { emoji: "ðŸŸ¢", keywords: ["green", "circle", "go", "on", "active"] },
  { emoji: "ðŸŸ¡", keywords: ["yellow", "circle", "pending", "wait"] },
  { emoji: "ðŸ”µ", keywords: ["blue", "circle"] },
  { emoji: "âšª", keywords: ["white", "circle", "neutral"] },
  { emoji: "âš«", keywords: ["black", "circle"] },
  // Nature & Weather
  { emoji: "ðŸŒ±", keywords: ["plant", "grow", "new", "seedling", "eco"] },
  { emoji: "ðŸŒ¿", keywords: ["herb", "plant", "nature", "green"] },
  { emoji: "ðŸŒ³", keywords: ["tree", "nature", "environment", "forest"] },
  { emoji: "ðŸŒ", keywords: ["earth", "globe", "world", "planet", "europe"] },
  { emoji: "ðŸŒž", keywords: ["sun", "sunny", "bright", "day"] },
  { emoji: "ðŸŒ™", keywords: ["moon", "night", "dark", "sleep"] },
  { emoji: "â˜ï¸", keywords: ["cloud", "weather", "sky"] },
  { emoji: "â›ˆï¸", keywords: ["storm", "thunder", "rain", "weather"] },
  { emoji: "â„ï¸", keywords: ["snow", "cold", "winter", "freeze"] },
  // Numbers & Symbols
  { emoji: "1ï¸âƒ£", keywords: ["one", "first", "number", "1"] },
  { emoji: "2ï¸âƒ£", keywords: ["two", "second", "number", "2"] },
  { emoji: "3ï¸âƒ£", keywords: ["three", "third", "number", "3"] },
  { emoji: "4ï¸âƒ£", keywords: ["four", "number", "4"] },
  { emoji: "5ï¸âƒ£", keywords: ["five", "number", "5"] },
  { emoji: "ðŸ”¢", keywords: ["number", "input", "123", "digit"] },
  { emoji: "ðŸ”¤", keywords: ["abc", "alphabet", "letter", "text"] },
  { emoji: "ðŸ” ", keywords: ["uppercase", "capital", "letter"] },
  // Misc & Objects
  { emoji: "ðŸ“¦", keywords: ["box", "package", "delivery", "product"] },
  { emoji: "ðŸŽ", keywords: ["gift", "present", "box", "surprise"] },
  { emoji: "ðŸ§©", keywords: ["puzzle", "piece", "game", "fit"] },
  { emoji: "ðŸ”§", keywords: ["wrench", "tool", "fix", "settings"] },
  { emoji: "âš™ï¸", keywords: ["gear", "settings", "config", "cog"] },
  { emoji: "ðŸ› ï¸", keywords: ["tools", "build", "construct", "hammer"] },
  { emoji: "ðŸ§ª", keywords: ["test", "lab", "experiment", "science"] },
  { emoji: "ðŸ”¬", keywords: ["microscope", "science", "research", "analyze"] },
  { emoji: "ðŸ“", keywords: ["ruler", "measure", "angle", "math"] },
  { emoji: "ðŸ“", keywords: ["ruler", "straight", "measure"] },
  { emoji: "ðŸ ", keywords: ["house", "home", "building"] },
  { emoji: "ðŸ¢", keywords: ["building", "office", "business", "company"] },
  { emoji: "ðŸ­", keywords: ["factory", "industry", "manufacture"] },
  { emoji: "ðŸŽ“", keywords: ["graduation", "education", "learn", "school"] },
  { emoji: "ðŸ“š", keywords: ["books", "library", "study", "read"] },
  { emoji: "ðŸ“–", keywords: ["book", "open", "read", "story"] },
  { emoji: "ðŸ—“ï¸", keywords: ["calendar", "date", "schedule", "plan"] },
  { emoji: "ðŸ“…", keywords: ["calendar", "date", "event"] },
  { emoji: "â°", keywords: ["clock", "alarm", "time", "reminder"] },
  { emoji: "â³", keywords: ["hourglass", "time", "wait", "loading"] },
  { emoji: "ðŸ“", keywords: ["pin", "location", "map", "place"] },
  { emoji: "ðŸ—ºï¸", keywords: ["map", "world", "location", "travel"] },
  // Arrows & Direction
  { emoji: "âž¡ï¸", keywords: ["arrow", "right", "next", "forward"] },
  { emoji: "â¬…ï¸", keywords: ["arrow", "left", "back", "previous"] },
  { emoji: "â¬†ï¸", keywords: ["arrow", "up", "increase"] },
  { emoji: "â¬‡ï¸", keywords: ["arrow", "down", "decrease"] },
  { emoji: "â†”ï¸", keywords: ["arrow", "horizontal", "left", "right"] },
  { emoji: "â†•ï¸", keywords: ["arrow", "vertical", "up", "down"] },
  { emoji: "ðŸ”„", keywords: ["refresh", "reload", "sync", "cycle"] },
  { emoji: "ðŸ”ƒ", keywords: ["clockwise", "repeat", "cycle"] },
];

// Generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15);

// ===== SECTION ITEM COMPONENT =====
interface SectionItemProps {
  section: PollSection;
  sections: PollSection[];
  questions: PollQuestion[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<Omit<PollSection, "id">>) => void;
  onRemove: (removeQuestions: boolean) => void;
  onMove: (direction: "up" | "down") => void;
  onAddSubsection: () => void;
  onAssignQuestion: (questionId: string, sectionId: string | null) => void;
  onReorderQuestions: (sectionId: string, newOrder: string[]) => void;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  depth: number;
  // For recursive rendering
  expandedSections: Set<string>;
  toggleSectionExpand: (sectionId: string) => void;
  updateSection: (sectionId: string, updates: Partial<Omit<PollSection, "id">>) => void;
  removeSection: (sectionId: string, removeQuestions: boolean) => void;
  moveSection: (sectionId: string, direction: "up" | "down") => void;
  addSection: (parentSectionId?: string | null) => void;
  removeSectionFromFlow: (sectionId: string) => void;
  // Drop zone for dragging questions into sections (shared state for all sections)
  draggingQuestionId: string | null;
  setDraggingQuestionId: (id: string | null) => void;
  setDraggingFromSectionId: (id: string | null) => void;
  dropTargetSectionId: string | null;
  setDropTargetSectionId: (id: string | null) => void;
  onDropOnSection: (sectionId: string) => void;
  // Drop mode: 'into' = add to section, 'alongside' = place after section
  dropMode: 'into' | 'alongside';
  // Question editing callbacks
  updateQuestion: (questionId: string, updates: Partial<PollQuestion>) => void;
  removeQuestion: (questionId: string) => void;
  addOption: (questionId: string) => void;
  removeOption: (questionId: string, optionId: string) => void;
  updateOption: (questionId: string, optionId: string, updates: Partial<QuestionOption>) => void;
  // Expanded questions state - supports multiple
  expandedQuestions: Set<string>;
  setExpandedQuestion: (questionId: string | null) => void;
  // Lookup maps for flow-based rendering
  sectionsById: Map<string, PollSection>;
  questionsById: Map<string, PollQuestion>;
  // Drop zone detection for section questions
  checkDropZoneForSectionQuestion: (x: number, y: number) => { sectionId: string | null; topLevel: boolean };
  onSectionQuestionDropComplete: (questionId: string, targetSectionId: string | null, isTopLevel: boolean) => void;
  // Selection state
  selectedElementId: string | null;
  multiSelectedIds: Set<string>;
  onElementSelect: (elementId: string, elementType: 'section' | 'question', event: React.MouseEvent) => void;
  // Unparent nested sections
  onMoveToTopLevel: (sectionId: string) => void;
  // Multi-input selection for synced typing
  multiSelectedInputs: Set<string>;
  syncedInputValue: string;
  onInputMultiSelect: (inputId: string, currentValue: string, event: React.MouseEvent) => boolean;
  onSyncedInputChange: (newValue: string) => void;
}

function SectionItem({
  section,
  sections,
  questions,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
  onMove,
  onAddSubsection,
  onAssignQuestion,
  onReorderQuestions,
  index,
  isFirst,
  isLast,
  depth,
  expandedSections,
  toggleSectionExpand,
  updateSection,
  removeSection,
  moveSection,
  addSection,
  removeSectionFromFlow,
  draggingQuestionId,
  setDraggingQuestionId,
  setDraggingFromSectionId,
  dropTargetSectionId,
  setDropTargetSectionId,
  onDropOnSection,
  dropMode,
  updateQuestion,
  removeQuestion,
  addOption,
  removeOption,
  updateOption,
  expandedQuestions,
  setExpandedQuestion,
  sectionsById,
  questionsById,
  checkDropZoneForSectionQuestion,
  onSectionQuestionDropComplete,
  selectedElementId,
  multiSelectedIds,
  onElementSelect,
  onMoveToTopLevel,
  multiSelectedInputs,
  syncedInputValue,
  onInputMultiSelect,
  onSyncedInputChange,
}: SectionItemProps) {
  const dragControls = useDragControls();
  const [emojiSearch, setEmojiSearch] = useState("");
  
  // Check if this section is selected
  const isSelected = selectedElementId === section.id || multiSelectedIds.has(section.id);
  
  // Get flow items for this section
  const sectionFlow = section.flow || [];
  const childSections = sectionFlow
    .filter(f => f.type === 'SECTION')
    .map(f => sectionsById.get(f.id))
    .filter(Boolean) as PollSection[];
  const sectionQuestions = sectionFlow
    .filter(f => f.type === 'QUESTION')
    .map(f => questionsById.get(f.id))
    .filter(Boolean) as PollQuestion[];
  
  // Derive question order directly from flow
  const questionOrder = sectionQuestions.map(q => q.id);
  
  // Derive local drop state from shared state
  const isDraggingQuestion = !!draggingQuestionId;
  const isDropTarget = dropTargetSectionId === section.id;
  
  // Filter emojis based on search
  const filteredEmojis = emojiSearch.trim()
    ? SECTION_EMOJI_OPTIONS.filter(opt => 
        opt.emoji.includes(emojiSearch) || 
        opt.keywords.some(kw => kw.toLowerCase().includes(emojiSearch.toLowerCase()))
      )
    : SECTION_EMOJI_OPTIONS;
  
  const handleQuestionReorder = (newOrder: string[]) => {
    onReorderQuestions(section.id, newOrder);
  };

  // When depth === 0, SectionItem is inside parent's Reorder.Item â€” use div to avoid <li> inside <li>
  // When depth > 0, SectionItem is direct child of Reorder.Group â€” use Reorder.Item
  const Wrapper = depth === 0 ? "div" : Reorder.Item;
  const wrapperProps = depth > 0 ? {
    value: section.id,
    "data-section-drop-target": section.id,
    dragListener: false as const,
    dragControls,
    whileDrag: { scale: 1.02, boxShadow: "0 12px 32px rgba(0,0,0,0.5)", zIndex: 50 },
    transition: { type: "spring" as const, damping: 25, stiffness: 300 },
    onClick: (e: React.MouseEvent) => onElementSelect(section.id, "section", e),
  } : { value: section.id, onClick: (e: React.MouseEvent) => onElementSelect(section.id, "section", e) };

  return (
    <Wrapper
      {...(wrapperProps as any)}
      className={cn(
        "rounded-lg overflow-hidden relative border-l-4 border-l-primary/50",
        depth === 0 ? "bg-zinc-900/70" : "bg-zinc-800/50 ml-4 border-l-2 border-l-primary/30",
        isDropTarget && dropMode === "into" && "ring-2 ring-dashed ring-primary/70",
        isDropTarget && dropMode === "alongside" && "ring-2 ring-dashed ring-amber-500/70",
        isSelected && !isDraggingQuestion && "ring-2 ring-amber-500/70 bg-amber-500/5"
      )}
    >
      {/* Drop zone overlay when dragging a question */}
      {isDraggingQuestion && (
        <div 
          className={cn(
            "absolute inset-0 z-20 flex items-center justify-center transition-all duration-200 pointer-events-none",
            isDropTarget && dropMode === 'into'
              ? "bg-primary/30 border-2 border-dashed border-primary" 
              : isDropTarget && dropMode === 'alongside'
              ? "bg-amber-500/20 border-2 border-dashed border-amber-500"
              : "bg-zinc-800/40 border-2 border-dashed border-zinc-600"
          )}
        >
          <div className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium shadow-lg transition-all flex items-center gap-2",
            isDropTarget && dropMode === 'into'
              ? "bg-primary/90 text-primary-foreground scale-110" 
              : isDropTarget && dropMode === 'alongside'
              ? "bg-amber-500/90 text-amber-950 scale-110"
              : "bg-zinc-700/90 text-zinc-300"
          )}>
            {isDropTarget 
              ? dropMode === 'alongside' 
                ? "Place after section" 
                : "Add to section" 
              : "Drop question here"
            }
            {isDropTarget && dropMode === 'into' && (
              <span className="text-[10px] opacity-70">(hold to place after)</span>
            )}
          </div>
        </div>
      )}
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        <div className="flex items-center gap-2 p-3 hover:bg-zinc-800/50 transition-colors group/section">
          {/* Larger drag handle area - entire left side is draggable */}
          <div
            className="shrink-0 touch-none cursor-grab active:cursor-grabbing p-2 -m-2 rounded-lg hover:bg-zinc-700/30 transition-colors select-none"
            onPointerDown={(e) => {
              e.preventDefault();
              dragControls.start(e);
            }}
          >
            <div className="flex flex-col items-center gap-0.5">
              <GripVertical className="h-5 w-5 text-zinc-600 group-hover/section:text-zinc-400 transition-colors" />
              <span className="text-[8px] text-zinc-600 group-hover/section:text-zinc-500 uppercase tracking-wider">drag</span>
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-0 h-auto hover:bg-transparent">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              )}
            </Button>
          </CollapsibleTrigger>
          {section.icon ? (
            <span className="text-base">{section.icon}</span>
          ) : (
            <FolderOpen className="h-4 w-4 text-primary" />
          )}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-zinc-200 truncate">
              {section.title || "Untitled Section"}
            </span>
          </div>
          <span className="text-xs text-zinc-500 hidden sm:block">
            {sectionQuestions.length} Q{childSections.length > 0 && ` â€¢ ${childSections.length} sub`}
          </span>
          {/* Selection indicator */}
          {isSelected && (
            <span className="text-[10px] text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded-full font-medium">
              Selected
            </span>
          )}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
              onClick={() => onMove("up")}
              disabled={isFirst}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
              onClick={() => onMove("down")}
              disabled={isLast}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            {/* Move to top-level button - only for nested sections */}
            {depth > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-zinc-500 hover:text-amber-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveToTopLevel(section.id);
                    }}
                  >
                    <Layers className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">Move to top-level</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-zinc-500 hover:text-destructive"
              onClick={() => onRemove(false)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3 border-t border-zinc-800/50 pt-3">
            {/* Icon & Title Row */}
            <div className="flex items-end gap-3">
              {/* Compact Icon Picker */}
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Icon</Label>
                <Popover onOpenChange={(open) => !open && setEmojiSearch("")}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-700/50"
                    >
                      {section.icon ? (
                        <span className="text-lg">{section.icon}</span>
                      ) : (
                        <Smile className="h-4 w-4 text-zinc-500" />
                      )}
                    </Button>
                  </PopoverTrigger>
                <PopoverContent 
                  className="w-72 p-2 bg-zinc-900 border-zinc-700 z-[100]" 
                  sideOffset={5}
                  onWheel={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                >
                  <div className="mb-2">
                    <Input
                      type="text"
                      placeholder="Search icons... (e.g. chart, money, star)"
                      value={emojiSearch}
                      onChange={(e) => setEmojiSearch(e.target.value)}
                      className="h-8 text-xs bg-zinc-800/50 border-zinc-700/50 focus:border-zinc-600 placeholder:text-zinc-500"
                    />
                  </div>
                  <div 
                    className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto overscroll-contain"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {filteredEmojis.length > 0 ? (
                      filteredEmojis.map((opt) => (
                        <button
                          key={opt.emoji}
                          type="button"
                          onClick={() => onUpdate({ icon: opt.emoji })}
                          className={cn(
                            "w-7 h-7 text-lg rounded hover:bg-zinc-700 transition-colors flex items-center justify-center",
                            section.icon === opt.emoji && "bg-primary/20 ring-1 ring-primary"
                          )}
                        >
                          {opt.emoji}
                        </button>
                      ))
                    ) : (
                      <div className="col-span-8 py-4 text-center text-xs text-zinc-500">
                        No icons found for &quot;{emojiSearch}&quot;
                      </div>
                    )}
                  </div>
                  {section.icon && (
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="w-full mt-2 text-xs text-zinc-500"
                      onClick={() => onUpdate({ icon: "" })}
                    >
                      Clear icon
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
              </div>

              {/* Title Input */}
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-zinc-400">Section Title</Label>
                <Input
                  value={section.title}
                  onChange={(e) => onUpdate({ title: e.target.value })}
                  placeholder="Enter section title..."
                  className="h-9 text-sm bg-zinc-800/50 border-zinc-700/50 focus:border-zinc-600"
                />
              </div>
            </div>

            {/* Description - Full Width */}
            <div className="space-y-1">
              <Label className="text-xs text-zinc-400">Description</Label>
              <Textarea
                value={section.description || ""}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="Optional section description..."
                className="min-h-[60px] text-sm bg-zinc-800/50 border-zinc-700/50 focus:border-zinc-600 resize-none"
              />
            </div>

            {/* Nested Sections */}
            {childSections.length > 0 && (
              <div className="space-y-2 pt-2">
                <Label className="text-xs text-zinc-500">Nested Sections</Label>
                <Reorder.Group
                  axis="y"
                  values={childSections.map(s => s.id)}
                  onReorder={(newOrder) => {
                    // Reorder section's flow for nested sections
                    onReorderQuestions(section.id, newOrder);
                  }}
                  className="space-y-1"
                >
                  {childSections.map((child, childIndex) => (
                    <SectionItem
                      key={child.id}
                      section={child}
                      sections={sections}
                      questions={questions}
                      isExpanded={expandedSections.has(child.id)}
                      onToggleExpand={() => toggleSectionExpand(child.id)}
                      onUpdate={(updates) => updateSection(child.id, updates)}
                      onRemove={(removeQ) => removeSection(child.id, removeQ)}
                      onMove={(direction) => moveSection(child.id, direction)}
                      onAddSubsection={() => addSection(child.id)}
                      onAssignQuestion={onAssignQuestion}
                      onReorderQuestions={onReorderQuestions}
                      index={childIndex}
                      isFirst={childIndex === 0}
                      isLast={childIndex === childSections.length - 1}
                      depth={depth + 1}
                      expandedSections={expandedSections}
                      toggleSectionExpand={toggleSectionExpand}
                      updateSection={updateSection}
                      removeSection={removeSection}
                      moveSection={moveSection}
                      addSection={addSection}
                      removeSectionFromFlow={removeSectionFromFlow}
                      draggingQuestionId={draggingQuestionId}
                      setDraggingQuestionId={setDraggingQuestionId}
                      setDraggingFromSectionId={setDraggingFromSectionId}
                      dropTargetSectionId={dropTargetSectionId}
                      setDropTargetSectionId={setDropTargetSectionId}
                      onDropOnSection={onDropOnSection}
                      dropMode={dropMode}
                      updateQuestion={updateQuestion}
                      removeQuestion={removeQuestion}
                      addOption={addOption}
                      removeOption={removeOption}
                      updateOption={updateOption}
                      expandedQuestions={expandedQuestions}
                      setExpandedQuestion={setExpandedQuestion}
                      sectionsById={sectionsById}
                      questionsById={questionsById}
                      checkDropZoneForSectionQuestion={checkDropZoneForSectionQuestion}
                      onSectionQuestionDropComplete={onSectionQuestionDropComplete}
                      selectedElementId={selectedElementId}
                      multiSelectedIds={multiSelectedIds}
                      onElementSelect={onElementSelect}
                      onMoveToTopLevel={onMoveToTopLevel}
                      multiSelectedInputs={multiSelectedInputs}
                      syncedInputValue={syncedInputValue}
                      onInputMultiSelect={onInputMultiSelect}
                      onSyncedInputChange={onSyncedInputChange}
                    />
                  ))}
                </Reorder.Group>
              </div>
            )}

            {/* Add Subsection Button */}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-zinc-500 hover:text-zinc-300"
              onClick={onAddSubsection}
            >
              <FolderPlus className="h-3 w-3" />
              Add Subsection
            </Button>

            {/* Questions in this section - full editors */}
            {sectionQuestions.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-zinc-800/50 mt-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-zinc-500">
                    Questions ({sectionQuestions.length})
                  </Label>
                  <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                    <GripVertical className="h-2.5 w-2.5" />
                    Drag to reorder
                  </span>
                </div>
                <div className="space-y-2">
                  {sectionQuestions.map((q, qIndex) => (
                    <SectionQuestionEditor
                      key={q.id}
                      question={q}
                      index={qIndex}
                      isExpanded={expandedQuestions.has(q.id)}
                      onToggleExpand={() => setExpandedQuestion(q.id)}
                      onUpdate={(updates) => updateQuestion(q.id, updates)}
                      onRemove={() => removeQuestion(q.id)}
                      onAddOption={() => addOption(q.id)}
                      onRemoveOption={(optionId) => removeOption(q.id, optionId)}
                      onUpdateOption={(optionId, updates) => updateOption(q.id, optionId, updates)}
                      onRemoveFromSection={() => onAssignQuestion(q.id, null)}
                      sections={sections}
                      setDraggingQuestionId={setDraggingQuestionId}
                      setDraggingFromSectionId={setDraggingFromSectionId}
                      sectionId={section.id}
                      checkDropZone={checkDropZoneForSectionQuestion}
                      onDropComplete={(targetSectionId, isTopLevel) => 
                        onSectionQuestionDropComplete(q.id, targetSectionId, isTopLevel)
                      }
                      multiSelectedInputs={multiSelectedInputs}
                      syncedInputValue={syncedInputValue}
                      onInputMultiSelect={onInputMultiSelect}
                      onSyncedInputChange={onSyncedInputChange}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Wrapper>
  );
}

// Draggable question item within a section
function QuestionDragItem({ 
  question, 
  onRemove 
}: { 
  question: PollQuestion; 
  onRemove: () => void;
}) {
  const dragControls = useDragControls();
  
  return (
    <Reorder.Item
      value={question.id}
      dragListener={false}
      dragControls={dragControls}
      className="flex items-center gap-2 text-sm bg-zinc-800/30 rounded hover:bg-zinc-800/50 transition-colors group"
      whileDrag={{
        scale: 1.03,
        boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
        zIndex: 50,
      }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
    >
      {/* Larger drag handle - left side of question */}
      <div
        className="shrink-0 touch-none cursor-grab active:cursor-grabbing py-2 pl-2 pr-1 rounded-l hover:bg-zinc-700/40 transition-colors select-none flex items-center"
        onPointerDown={(e) => {
          e.preventDefault();
          dragControls.start(e);
        }}
      >
        <GripVertical className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
      </div>
      <span className="truncate flex-1 text-zinc-300 py-2">
        {question.questionText || "Untitled question"}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 px-2 mr-2 text-[10px] text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onRemove}
      >
        Remove
      </Button>
    </Reorder.Item>
  );
}

// Top-level question in flow - uses drag handle only (no drag on inputs)
function TopLevelQuestionReorderItem({
  question,
  index,
  draggingSectionId,
  isThisExpanded,
  onToggleExpand,
  onDragStart,
  onDragEnd,
  updateQuestion,
  removeQuestion,
  addOption,
  removeOption,
  updateOption,
  assignQuestionToSection,
  sections,
  multiSelectedInputs,
  syncedInputValue,
  handleInputMultiSelect,
  handleSyncedInputChange,
}: {
  question: PollQuestion;
  index: number;
  draggingSectionId: string | null;
  isThisExpanded: boolean;
  onToggleExpand: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  updateQuestion: (id: string, u: Partial<PollQuestion>) => void;
  removeQuestion: (id: string) => void;
  addOption: (questionId: string) => void;
  removeOption: (questionId: string, optionId: string) => void;
  updateOption: (questionId: string, optionId: string, u: Partial<QuestionOption>) => void;
  assignQuestionToSection: (questionId: string, sectionId: string) => void;
  sections: PollSection[];
  multiSelectedInputs: Set<string>;
  syncedInputValue: string;
  handleInputMultiSelect: (inputId: string, currentValue: string, e: React.MouseEvent) => boolean;
  handleSyncedInputChange: (newValue: string) => void;
}) {
  const dragControls = useDragControls();
  return (
    <Reorder.Item
      value={question.id}
      dragListener={false}
      dragControls={dragControls}
      className={cn(
        "rounded-lg overflow-hidden relative",
        index % 2 === 0 ? "bg-zinc-800/70 border border-zinc-700/50" : "bg-zinc-900/70 border border-zinc-800/50",
        draggingSectionId && "opacity-50 pointer-events-none"
      )}
      animate={{ scale: 1 }}
      whileDrag={{ scale: 0.85, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", zIndex: 9999 }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <Collapsible open={isThisExpanded} onOpenChange={onToggleExpand}>
        <div className="flex items-center gap-2 p-3 hover:bg-zinc-700/30 transition-colors group/bq">
          <div
            className="shrink-0 p-2 -m-2 rounded-lg hover:bg-zinc-700/30 cursor-grab active:cursor-grabbing touch-none select-none"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <GripVertical className="h-4 w-4 text-zinc-600 group-hover/bq:text-zinc-400" />
          </div>
          <div className="p-1.5 bg-amber-500/20 rounded shrink-0">
            <FileText className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{question.questionText || "Untitled question"}</p>
            <p className="text-xs text-zinc-500">
              {question.type.replace("_", " ")} â€¢ {question.required ? "Required" : "Optional"}
            </p>
          </div>
          <span className="text-[10px] text-amber-400/70 px-1.5 py-0.5 bg-amber-500/10 rounded shrink-0">Top-level</span>
          <div className="flex items-center gap-0.5 shrink-0">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-300">
                {isThisExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </Button>
            </CollapsibleTrigger>
            <Button variant="ghost" size="icon" onClick={() => removeQuestion(question.id)} className="h-7 w-7 text-zinc-500 hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-4 border-t border-zinc-700/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Question Type</Label>
                <Select value={question.type} onValueChange={(v) => updateQuestion(question.id, { type: v as QuestionType })}>
                  <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SINGLE_CHOICE"><div className="flex items-center gap-2"><List className="w-3 h-3" />Single Choice</div></SelectItem>
                    <SelectItem value="MULTI_CHOICE"><div className="flex items-center gap-2"><List className="w-3 h-3" />Multiple Choice</div></SelectItem>
                    <SelectItem value="SLIDER"><div className="flex items-center gap-2"><Sliders className="w-3 h-3" />Slider</div></SelectItem>
                    <SelectItem value="SCALE"><div className="flex items-center gap-2"><Hash className="w-3 h-3" />Scale</div></SelectItem>
                    <SelectItem value="TEXT"><div className="flex items-center gap-2"><Type className="w-3 h-3" />Text</div></SelectItem>
                    <SelectItem value="RANKING"><div className="flex items-center gap-2"><GripVertical className="w-3 h-3" />Ranking</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Move to Section</Label>
                <Select
                  value="_toplevel"
                  onValueChange={(v) => {
                    if (v !== "_toplevel") {
                      assignQuestionToSection(question.id, v);
                      toast.success("Question moved to section!");
                    }
                  }}
                >
                  <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700 z-[100]">
                    <SelectItem value="_toplevel"><span className="text-zinc-500">Keep at top-level</span></SelectItem>
                    {sections.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-zinc-500 italic">Add sections to move questions</div>
                    ) : (
                      sections.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            {s.icon && <span>{s.icon}</span>}
                            <FolderOpen className="w-3 h-3 text-primary" />
                            <span>{s.title || "Untitled Section"}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-4">
                <div className="flex items-center space-x-2">
                  <Switch id={`builder-required-${question.id}`} checked={question.required} onCheckedChange={(checked) => updateQuestion(question.id, { required: checked })} />
                  <Label htmlFor={`builder-required-${question.id}`} className="text-sm text-zinc-300">Required</Label>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Question Text *</Label>
              <Input
                value={question.questionText}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => updateQuestion(question.id, { questionText: e.target.value })}
                placeholder="Enter your question..."
                className="bg-zinc-800/50 border-zinc-700/50"
              />
            </div>
            {(question.type === "SINGLE_CHOICE" || question.type === "MULTI_CHOICE") && (
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Options</Label>
                <div className="space-y-2">
                  {question.options.map((opt, optIdx) => {
                    const inputId = `${question.id}:${opt.id}`;
                    const isMultiSelected = multiSelectedInputs.has(inputId);
                    const letter = String.fromCharCode(65 + optIdx);
                    return (
                      <Tooltip key={opt.id}>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-400">{letter}</span>
                            <Input
                              value={isMultiSelected ? syncedInputValue : opt.text}
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => { if (handleInputMultiSelect(inputId, opt.text, e)) e.stopPropagation(); }}
                              onChange={(e) => { isMultiSelected ? handleSyncedInputChange(e.target.value) : updateOption(question.id, opt.id, { text: e.target.value }); }}
                              placeholder={`Option ${optIdx + 1}`}
                              className={cn("flex-1 bg-zinc-800/50 border-zinc-700/50 h-8 text-sm", isMultiSelected && "ring-2 ring-amber-500 border-amber-500")}
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-400" onClick={() => removeOption(question.id, opt.id)} disabled={question.options.length <= 2}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p>Option {letter}: {opt.text || "Enter option text"}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  <Button variant="ghost" size="sm" onClick={() => addOption(question.id)} className="text-xs text-zinc-500 hover:text-zinc-300">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Option
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Reorder.Item>
  );
}

// ===== QUESTION EDITOR FOR QUESTIONS INSIDE SECTIONS =====
interface SectionQuestionEditorProps {
  question: PollQuestion;
  index: number;
  isExpanded: boolean;
  onToggleExpand: (open: boolean) => void;
  onUpdate: (updates: Partial<PollQuestion>) => void;
  onRemove: () => void;
  onAddOption: () => void;
  onRemoveOption: (optionId: string) => void;
  onUpdateOption: (optionId: string, updates: Partial<QuestionOption>) => void;
  onRemoveFromSection: () => void;
  sections: PollSection[];
  // Drag out capability
  setDraggingQuestionId: (id: string | null) => void;
  setDraggingFromSectionId: (id: string | null) => void;
  sectionId: string;
  // Drop zone detection
  checkDropZone: (x: number, y: number) => { sectionId: string | null; topLevel: boolean };
  onDropComplete: (targetSectionId: string | null, isTopLevel: boolean) => void;
  // Multi-input selection
  multiSelectedInputs: Set<string>;
  syncedInputValue: string;
  onInputMultiSelect: (inputId: string, currentValue: string, e: React.MouseEvent) => boolean;
  onSyncedInputChange: (value: string) => void;
}

function SectionQuestionEditor({
  question,
  index,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
  onAddOption,
  onRemoveOption,
  onUpdateOption,
  onRemoveFromSection,
  sections,
  setDraggingQuestionId,
  setDraggingFromSectionId,
  sectionId,
  checkDropZone,
  onDropComplete,
  multiSelectedInputs,
  syncedInputValue,
  onInputMultiSelect,
  onSyncedInputChange,
}: SectionQuestionEditorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dropTargetRef = useRef<{ sectionId: string | null; topLevel: boolean }>({ sectionId: null, topLevel: false });
  
  return (
    <motion.div
      data-question-id={question.id}
      data-source-section={sectionId}
      className={cn(
        "rounded-lg bg-zinc-800/30 overflow-hidden relative",
        isDragging && "opacity-50"
      )}
      drag
      dragSnapToOrigin
      dragMomentum={false}
      animate={{ scale: 1, opacity: 1 }}
      whileDrag={{
        scale: 0.85,
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        zIndex: 9999,
        opacity: 1,
        cursor: "grabbing",
      }}
      onDragStart={() => {
        setIsDragging(true);
        setDraggingQuestionId(question.id);
        setDraggingFromSectionId(sectionId);
        dropTargetRef.current = { sectionId: null, topLevel: false };
      }}
      onDrag={(e, info) => {
        // Use framer-motion's drag info to detect drop zones
        const result = checkDropZone(info.point.x, info.point.y);
        dropTargetRef.current = result;
      }}
      onDragEnd={() => {
        setIsDragging(false);
        // Check if we have a valid drop target
        const { sectionId: targetSection, topLevel } = dropTargetRef.current;
        if (topLevel || (targetSection && targetSection !== sectionId)) {
          onDropComplete(targetSection, topLevel);
        }
        setDraggingQuestionId(null);
        setDraggingFromSectionId(null);
      }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
    >
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        {/* Question Header - entire card is draggable, click grip area to drag */}
        <div className="flex items-center gap-2 p-2 hover:bg-zinc-700/30 transition-colors group/q cursor-grab active:cursor-grabbing">
          {/* Drag indicator */}
          <div className="shrink-0 p-1">
            <GripVertical className="h-4 w-4 text-zinc-600 group-hover/q:text-zinc-400 transition-colors" />
          </div>
          
          {/* Question info - clickable to expand */}
          <CollapsibleTrigger asChild>
            <div 
              className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
              onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking to expand
            >
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-zinc-200">
                  {question.questionText || "(Untitled question)"}
                </p>
                <p className="text-xs text-zinc-500">
                  {question.type.replace("_", " ")} {question.required && "â€¢ Required"}
                </p>
              </div>
              <ChevronDown className={cn(
                "h-4 w-4 text-zinc-500 transition-transform",
                isExpanded && "rotate-180"
            )} />
          </div>
        </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="p-3 pt-0 space-y-3 border-t border-zinc-700/50">
            {/* Question Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Question Type</Label>
                <Select
                  value={question.type}
                  onValueChange={(value) => onUpdate({ type: value as PollQuestion["type"] })}
                >
                  <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SINGLE_CHOICE"><div className="flex items-center gap-2"><List className="w-3 h-3" />Single Choice</div></SelectItem>
                    <SelectItem value="MULTIPLE_CHOICE"><div className="flex items-center gap-2"><List className="w-3 h-3" />Multiple Choice</div></SelectItem>
                    <SelectItem value="SLIDER"><div className="flex items-center gap-2"><Sliders className="w-3 h-3" />Slider (A-G)</div></SelectItem>
                    <SelectItem value="SCALE"><div className="flex items-center gap-2"><Hash className="w-3 h-3" />Scale (1-10)</div></SelectItem>
                    <SelectItem value="TEXT"><div className="flex items-center gap-2"><Type className="w-3 h-3" />Text</div></SelectItem>
                    <SelectItem value="RANKING"><div className="flex items-center gap-2"><GripVertical className="w-3 h-3" />Ranking</div></SelectItem>
                    <SelectItem value="SHAPE_SELECTION"><div className="flex items-center gap-2"><Shapes className="w-3 h-3" />Shape</div></SelectItem>
                    <SelectItem value="GRID"><div className="flex items-center gap-2"><LayoutGrid className="w-3 h-3" />Grid</div></SelectItem>
                    <SelectItem value="NESTED_QUESTION"><div className="flex items-center gap-2"><GitBranch className="w-3 h-3" />Nested</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`required-${question.id}`}
                    checked={question.required}
                    onCheckedChange={(checked) => onUpdate({ required: checked })}
                  />
                  <Label htmlFor={`required-${question.id}`} className="text-xs text-zinc-400">Required</Label>
                </div>
              </div>
            </div>

            {/* Question Text */}
            <div className="space-y-1">
              <Label className="text-xs text-zinc-400">Question Text *</Label>
              <Input
                placeholder="Enter your question..."
                value={question.questionText}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => onUpdate({ questionText: e.target.value })}
                className="bg-zinc-800/50 border-zinc-700/50 h-9 text-sm"
              />
            </div>

            {/* Options for choice questions */}
            {(question.type === "SINGLE_CHOICE" || question.type === "MULTI_CHOICE" || question.type === "RANKING") && (
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Options</Label>
                <div className="space-y-1">
                  {question.options?.map((option, optIndex) => {
                    const inputId = `${question.id}:${option.id}`;
                    const isMultiSelected = multiSelectedInputs.has(inputId);
                    const letter = String.fromCharCode(65 + optIndex);
                    return (
                      <Tooltip key={option.id}>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-zinc-700 text-[10px] flex items-center justify-center text-zinc-400 shrink-0">
                              {letter}
                            </span>
                            <Input
                              placeholder={`Option ${letter}`}
                              value={isMultiSelected ? syncedInputValue : option.text}
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                if (onInputMultiSelect(inputId, option.text, e)) {
                                  e.stopPropagation();
                                }
                              }}
                              onChange={(e) => {
                                if (isMultiSelected) {
                                  onSyncedInputChange(e.target.value);
                                } else {
                                  onUpdateOption(option.id, { text: e.target.value });
                                }
                              }}
                              className={cn(
                                "flex-1 bg-zinc-800/50 border-zinc-700/50 h-8 text-sm",
                                isMultiSelected && "ring-2 ring-amber-500 border-amber-500"
                              )}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 text-zinc-500 hover:text-destructive"
                              onClick={() => onRemoveOption(option.id)}
                              disabled={question.options!.length <= 2}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p>Option {letter}: {option.text || "Enter option text"}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-zinc-400 hover:text-zinc-200 h-8 text-xs"
                  onClick={onAddOption}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Option
                </Button>
              </div>
            )}

            {/* â”€â”€â”€ Answer (correct answer, explanation, lock-in) â”€â”€â”€ */}
            <div className="space-y-2 p-2 bg-violet-500/5 border border-violet-500/20 rounded-lg">
              <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">Answer</span>
              
              {/* Single choice: dropdown */}
              {question.type === "SINGLE_CHOICE" && question.options?.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-zinc-400">Correct Answer</Label>
                  <Select
                    value={(question.correctAnswer as string) || "_none"}
                    onValueChange={(v) => onUpdate({ correctAnswer: v === "_none" ? null : v })}
                  >
                    <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50 h-7 text-xs">
                      <SelectValue placeholder="No correct answer" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700 z-[100]">
                      <SelectItem value="_none"><span className="text-zinc-500">None (opinion)</span></SelectItem>
                      {question.options?.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>{opt.text || "(empty)"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Multi choice: checkboxes for multiple correct answers */}
              {question.type === "MULTI_CHOICE" && question.options?.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-zinc-400">Correct Answers (select all that apply)</Label>
                  <div className="space-y-1 bg-zinc-800/30 rounded-md p-2">
                    {question.options?.map((opt) => {
                      const correctArr = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
                      const isChecked = correctArr.includes(opt.id);
                      return (
                        <label key={opt.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-zinc-700/30 rounded px-1 py-0.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const prev = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
                              const newArr = e.target.checked
                                ? [...prev, opt.id]
                                : prev.filter((id) => id !== opt.id);
                              onUpdate({ correctAnswer: newArr.length > 0 ? newArr : null });
                            }}
                            className="rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-violet-500"
                          />
                          <span className={isChecked ? "text-violet-300" : "text-zinc-400"}>{opt.text || "(empty)"}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-[10px] text-zinc-400">Write why this is the correct answer</Label>
                <Textarea
                  value={question.explanation || ""}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => onUpdate({ explanation: e.target.value || null })}
                  placeholder="Explain why this answer is correct..."
                  className="bg-zinc-800/50 border-zinc-700/50 min-h-[40px] text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-zinc-400">Write an explanation for when they got it wrong (optional)</Label>
                <Textarea
                  value={question.wrongExplanation || ""}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => onUpdate({ wrongExplanation: e.target.value || null })}
                  placeholder="Explain why they got it wrong..."
                  className="bg-zinc-800/50 border-zinc-700/50 min-h-[40px] text-xs"
                />
              </div>
              {/* Deep Explanation — second-layer clarification */}
              <div className="space-y-1">
                <Label className="text-[10px] text-zinc-400">Deep Explanation (optional — shown on &quot;Still don&apos;t understand?&quot;)</Label>
                <Textarea
                  value={question.deepExplanation || ""}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => onUpdate({ deepExplanation: e.target.value || null })}
                  placeholder="Provide a deeper explanation for students who need more help..."
                  className="bg-zinc-800/50 border-zinc-700/50 min-h-[40px] text-xs"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id={`commit-sec-${question.id}`}
                  checked={question.commitRequired !== false}
                  onCheckedChange={(v) => onUpdate({ commitRequired: v })}
                />
                <Label htmlFor={`commit-sec-${question.id}`} className="text-[10px] text-zinc-400">Require Lock In</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id={`trick-sec-${question.id}`}
                  checked={question.trickQuestion === true}
                  onCheckedChange={(v) => onUpdate({ trickQuestion: v })}
                />
                <Label htmlFor={`trick-sec-${question.id}`} className="text-[10px] text-zinc-400">Trick question</Label>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-zinc-700/50">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-amber-500 hover:text-amber-400 h-7"
                onClick={onRemoveFromSection}
              >
                <ChevronUp className="w-3 h-3 mr-1" />
                Move to top-level
              </Button>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:text-destructive h-7"
                onClick={onRemove}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  );
}

// ===== DRAGGABLE QUESTION ITEM FOR MAIN QUESTIONS LIST =====
interface QuestionItemProps {
  question: PollQuestion;
  index: number;
  isLast: boolean;
  isExpanded: boolean;
  onToggleExpand: (open: boolean) => void;
  onUpdate: (updates: Partial<PollQuestion>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddOption: () => void;
  onRemoveOption: (optionId: string) => void;
  onUpdateOption: (optionId: string, updates: Partial<QuestionOption>) => void;
  onAssignToSection: (sectionId: string | null) => void;
  sections: PollSection[];
  // Free drag support for dropping into sections
  onCheckDropZone: (x: number, y: number) => string | null;
  onDropIntoSection: (sectionId: string) => void;
  onDropAlongsideSection: (sectionId: string) => void; // Place after section as standalone
  setHoveredSection: (sectionId: string | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  dropMode: 'into' | 'alongside';
  onHoverSectionChange: (sectionId: string | null, resetTimer: boolean) => void;
  // Multi-input selection
  multiSelectedInputs: Set<string>;
  syncedInputValue: string;
  onInputMultiSelect: (inputId: string, currentValue: string, e: React.MouseEvent) => boolean;
  onSyncedInputChange: (value: string) => void;
}

function QuestionItem({
  question,
  index,
  isLast,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onAddOption,
  onRemoveOption,
  onUpdateOption,
  onAssignToSection,
  sections,
  onCheckDropZone,
  onDropIntoSection,
  onDropAlongsideSection,
  setHoveredSection,
  onDragStart,
  onDragEnd,
  dropMode,
  onHoverSectionChange,
  multiSelectedInputs,
  syncedInputValue,
  onInputMultiSelect,
  onSyncedInputChange,
}: QuestionItemProps) {
  const [isDragging, setIsDragging] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const [placeholderHeight, setPlaceholderHeight] = useState<number>(0);
  const dragControls = useDragControls();
  const lastHoveredSectionRef = useRef<string | null>(null);

  return (
    <div 
      ref={itemRef}
      className="relative"
      style={{ 
        // Keep the height during drag to prevent layout shift
        minHeight: isDragging ? placeholderHeight : undefined 
      }}
    >
      {/* Placeholder shown during drag */}
      {isDragging && (
        <div 
          className="absolute inset-0 rounded-lg border-2 border-dashed border-zinc-700/50 bg-zinc-800/20"
        />
      )}

      {/* The draggable question card */}
      <motion.div
        className={cn(
          "rounded-lg overflow-hidden transition-colors",
          isDragging 
            ? "bg-zinc-800 border border-zinc-600/50 shadow-2xl fixed pointer-events-none" 
            : index % 2 === 0 
              ? "bg-zinc-900/60 border border-zinc-800/50" 
              : "bg-zinc-800/40 border border-zinc-700/30"
        )}
        style={{
          // When dragging, make it compact and fixed width
          width: isDragging ? 280 : "100%",
          zIndex: isDragging ? 9999 : undefined,
        }}
        drag
        dragControls={dragControls}
        dragListener={false}  // Only drag from handle
        dragSnapToOrigin  // Always snap back to origin - we handle the actual move in onDragEnd
        dragMomentum={false}  // No sliding after release
        dragElastic={0}  // No rubberband effect outside constraints
        whileDrag={{
          scale: 1.05,
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
        }}
        onDragStart={() => {
          // Capture height before starting drag
          if (itemRef.current) {
            setPlaceholderHeight(itemRef.current.offsetHeight);
          }
          setIsDragging(true);
          lastHoveredSectionRef.current = null;
          onDragStart();
        }}
        onDrag={(e, info) => {
          const zoneId = onCheckDropZone(info.point.x, info.point.y);
          setHoveredSection(zoneId);
          
          // Track section changes for hold timer
          if (zoneId !== lastHoveredSectionRef.current) {
            // Section changed - notify parent to reset timer and start new one
            onHoverSectionChange(zoneId, true);
            lastHoveredSectionRef.current = zoneId;
          }
        }}
        onDragEnd={(e, info) => {
          const dropZoneId = onCheckDropZone(info.point.x, info.point.y);
          if (dropZoneId) {
            // Gap drops always use onDropIntoSection (which handles gap-X)
            if (dropZoneId.startsWith('gap-')) {
              onDropIntoSection(dropZoneId);
            } else if (dropMode === 'alongside') {
              // Section drop with alongside mode
              onDropAlongsideSection(dropZoneId);
            } else {
              // Section drop with into mode
              onDropIntoSection(dropZoneId);
            }
          }
          setIsDragging(false);
          setPlaceholderHeight(0);
          setHoveredSection(null);
          lastHoveredSectionRef.current = null;
          onDragEnd();
        }}
      >
        {/* Compact drag view - only shown when dragging */}
        {isDragging ? (
          <div className="flex items-center gap-3 p-3">
            <GripVertical className="h-4 w-4 text-primary shrink-0" />
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0">
              {index + 1}
            </span>
            <span className="text-sm font-medium text-zinc-200 truncate">
              {question.questionText || "(Untitled question)"}
            </span>
            {/* Show current drop mode indicator */}
            <span className={cn(
              "ml-auto text-[10px] px-2 py-0.5 rounded-full",
              dropMode === 'alongside' ? "bg-amber-500/20 text-amber-400" : "bg-primary/20 text-primary"
            )}>
              {dropMode === 'alongside' ? 'Place after' : 'Add to'}
            </span>
          </div>
        ) : (
          /* Full question editor - shown when not dragging */
          <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
            {/* Question Header */}
            <div className="flex items-center gap-2 p-3 transition-colors group/question hover:bg-zinc-800/50">
              {/* Drag handle - only this initiates drag */}
              <div 
                className="shrink-0 p-2 -m-1 rounded-lg hover:bg-zinc-700/30 transition-colors cursor-grab active:cursor-grabbing touch-none select-none"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <GripVertical className="h-5 w-5 text-zinc-600 group-hover/question:text-zinc-400 transition-all" />
              </div>
          
              {/* Question info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="w-7 h-7 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center shrink-0">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-zinc-200">
                    {question.questionText || "(Untitled question)"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {question.type.replace("_", " ")} â€¢{" "}
                    {question.required ? "Required" : "Optional"}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-0.5 shrink-0">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </Button>
                </CollapsibleTrigger>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
                  onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                  disabled={index === 0}
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
                  onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                  disabled={isLast}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-zinc-500 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onRemove(); }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Question Body */}
            <CollapsibleContent>
              <div className="p-4 pt-0 space-y-4 border-t border-zinc-700/50">
                {/* Row 1: Question Type and Section - side by side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  {/* Question Type */}
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Question Type</Label>
                    <Select
                      value={question.type}
                      onValueChange={(v) =>
                        onUpdate({
                          type: v as QuestionType,
                          options:
                            v === "SINGLE_CHOICE" || v === "MULTI_CHOICE"
                              ? question.options.length > 0
                                ? question.options
                                : [
                                    { id: generateId(), text: "" },
                                    { id: generateId(), text: "" },
                                  ]
                              : [],
                          sliderConfig:
                            v === "SLIDER"
                              ? question.sliderConfig || { ...DEFAULT_SLIDER_CONFIG }
                              : undefined,
                        })
                      }
                    >
                      <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700 z-[100]">
                        <SelectItem value="SINGLE_CHOICE">
                          <div className="flex items-center gap-2">
                            <List className="w-4 h-4" />
                            Single Choice
                          </div>
                        </SelectItem>
                        <SelectItem value="MULTI_CHOICE">
                          <div className="flex items-center gap-2">
                            <List className="w-4 h-4" />
                            Multiple Choice
                          </div>
                        </SelectItem>
                        <SelectItem value="SLIDER">
                          <div className="flex items-center gap-2">
                            <Sliders className="w-4 h-4" />
                            Slider (A-G)
                          </div>
                        </SelectItem>
                        <SelectItem value="SCALE">
                          <div className="flex items-center gap-2">
                            <Hash className="w-4 h-4" />
                            Scale (1-10)
                          </div>
                        </SelectItem>
                        <SelectItem value="TEXT">
                          <div className="flex items-center gap-2">
                            <Type className="w-4 h-4" />
                            Text Response
                          </div>
                        </SelectItem>
                        <SelectItem value="RANKING">
                          <div className="flex items-center gap-2">
                            <GripVertical className="w-4 h-4" />
                            Ranking
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Section Assignment */}
                  <div className="space-y-2">
                    <Label className="text-zinc-400 flex items-center gap-1">
                      Section
                      <span className="text-[10px] text-zinc-600">(drag question into section or select here)</span>
                    </Label>
                    <Select
                      value="_none"
                      onValueChange={(v) => onAssignToSection(v === "_none" ? null : v)}
                    >
                      <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50">
                        <SelectValue placeholder="No section" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700 z-[100]">
                        <SelectItem value="_none">
                          <span className="text-zinc-500">No section (top-level)</span>
                        </SelectItem>
                        {sections.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-zinc-500 italic">
                            Create sections above first
                          </div>
                        ) : (
                          sections.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              <div className="flex items-center gap-2">
                                {s.icon && <span>{s.icon}</span>}
                                <span>{s.title || "Untitled Section"}</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 2: Toggles */}
                <div className="flex items-center gap-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`required-${question.id}`}
                      checked={question.required}
                      onCheckedChange={(v) => onUpdate({ required: v })}
                    />
                    <Label htmlFor={`required-${question.id}`} className="text-zinc-400">Required</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`images-${question.id}`}
                      checked={question.allowImages}
                      onCheckedChange={(v) => onUpdate({ allowImages: v })}
                    />
                    <Label htmlFor={`images-${question.id}`} className="text-zinc-400">Allow Images</Label>
                  </div>
                </div>

            {/* Question Text */}
            <div className="space-y-2">
              <Label className="text-zinc-400">Question Text *</Label>
              <Input
                value={question.questionText}
                onChange={(e) => onUpdate({ questionText: e.target.value })}
                placeholder="Enter your question..."
                className="bg-zinc-800/50 border-zinc-700/50"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400">Description (optional)</Label>
              <Input
                value={question.description || ""}
                onChange={(e) => onUpdate({ description: e.target.value || undefined })}
                placeholder="Additional context..."
                className="bg-zinc-800/50 border-zinc-700/50"
              />
            </div>

            {/* Choice Options */}
            {(question.type === "SINGLE_CHOICE" || question.type === "MULTI_CHOICE") && (
              <div className="space-y-2">
                <Label className="text-zinc-400">Options</Label>
                <div className="space-y-2">
                  {question.options.map((option, optIndex) => {
                    const inputId = `${question.id}:${option.id}`;
                    const isMultiSelected = multiSelectedInputs.has(inputId);
                    const letter = String.fromCharCode(65 + optIndex);
                    return (
                      <Tooltip key={option.id}>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded bg-zinc-800 text-xs flex items-center justify-center text-zinc-400 shrink-0">
                              {letter}
                            </span>
                            <Input
                              value={isMultiSelected ? syncedInputValue : option.text}
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                if (onInputMultiSelect(inputId, option.text, e)) {
                                  e.stopPropagation();
                                }
                              }}
                              onChange={(e) => {
                                if (isMultiSelected) {
                                  onSyncedInputChange(e.target.value);
                                } else {
                                  onUpdateOption(option.id, { text: e.target.value });
                                }
                              }}
                              placeholder={`Option ${letter}`}
                              className={cn(
                                "flex-1 bg-zinc-800/50 border-zinc-700/50",
                                isMultiSelected && "ring-2 ring-amber-500 border-amber-500"
                              )}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-zinc-500 hover:text-destructive"
                              onClick={() => onRemoveOption(option.id)}
                              disabled={question.options.length <= 2}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p>Option {letter}: {option.text || "Enter option text"}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-zinc-400 hover:text-zinc-200"
                  onClick={onAddOption}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Option
                </Button>
              </div>
            )}

            {/* Slider Config */}
            {question.type === "SLIDER" && question.sliderConfig && (
              <div className="space-y-4 p-3 bg-zinc-800/30 rounded-lg">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-500">Min</Label>
                    <Input
                      type="number"
                      value={question.sliderConfig.min ?? question.sliderConfig.minValue ?? 1}
                      onChange={(e) =>
                        onUpdate({
                          sliderConfig: {
                            ...question.sliderConfig!,
                            min: parseInt(e.target.value) || 1,
                            minValue: parseInt(e.target.value) || 1,
                          },
                        })
                      }
                      className="bg-zinc-800/50 border-zinc-700/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-500">Max</Label>
                    <Input
                      type="number"
                      value={question.sliderConfig.max ?? question.sliderConfig.maxValue ?? 7}
                      onChange={(e) =>
                        onUpdate({
                          sliderConfig: {
                            ...question.sliderConfig!,
                            max: parseInt(e.target.value) || 7,
                            maxValue: parseInt(e.target.value) || 7,
                          },
                        })
                      }
                      className="bg-zinc-800/50 border-zinc-700/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-500">Step</Label>
                    <Input
                      type="number"
                      value={question.sliderConfig.step}
                      onChange={(e) =>
                        onUpdate({
                          sliderConfig: {
                            ...question.sliderConfig!,
                            step: parseInt(e.target.value) || 1,
                          },
                        })
                      }
                      className="bg-zinc-800/50 border-zinc-700/50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-500">Min Label</Label>
                    <Input
                      value={question.sliderConfig.minLabel}
                      onChange={(e) =>
                        onUpdate({
                          sliderConfig: {
                            ...question.sliderConfig!,
                            minLabel: e.target.value,
                          },
                        })
                      }
                      placeholder="Low"
                      className="bg-zinc-800/50 border-zinc-700/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-500">Max Label</Label>
                    <Input
                      value={question.sliderConfig.maxLabel}
                      onChange={(e) =>
                        onUpdate({
                          sliderConfig: {
                            ...question.sliderConfig!,
                            maxLabel: e.target.value,
                          },
                        })
                      }
                      placeholder="High"
                      className="bg-zinc-800/50 border-zinc-700/50"
                    />
                  </div>
                </div>
              </div>
            )}



            {/* â”€â”€â”€ Shape Match Configuration â”€â”€â”€ */}

            {question.type === "SHAPE_MATCH" && (

              <div className="space-y-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">

                <Label className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Shape Match Setup</Label>

                <div className="space-y-1">

                  <Label className="text-xs text-zinc-400">Preset (quick start)</Label>

                  <Select

                    value={question.shapeMatchPreset || "_none"}

                    onValueChange={(v) => onUpdate({ 

                      shapeMatchPreset: v === "_none" ? undefined : v as PollQuestion["shapeMatchPreset"],

                      ...(v !== "_none" && { shapeMatchConfig: null }),

                    })}

                  >

                    <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50">

                      <SelectValue placeholder="Choose a preset or build custom" />

                    </SelectTrigger>

                    <SelectContent className="bg-zinc-900 border-zinc-700 z-[100]">

                      <SelectItem value="_none"><span className="text-zinc-500">Custom (Visual Builder)</span></SelectItem>

                      <SelectItem value="basicShapes">Basic Shapes</SelectItem>

                      <SelectItem value="outlineMatch">Outline Match</SelectItem>

                      <SelectItem value="colorMatch">Color Match</SelectItem>

                      <SelectItem value="antiBot">Anti-Bot</SelectItem>

                      <SelectItem value="advanced">Advanced</SelectItem>

                    </SelectContent>

                  </Select>

                </div>

                <Button

                  variant="outline"

                  size="sm"

                  className="w-full gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"

                  onClick={() => onUpdate({ _openVisualBuilder: true } as any)}

                >

                  <Shapes className="w-4 h-4" />

                  Open Visual Builder

                </Button>

                {question.shapeMatchConfig && (

                  <p className="text-[10px] text-emerald-400">

                    Custom: {question.shapeMatchConfig.draggableItems?.length || 0} shapes, {question.shapeMatchConfig.dropZones?.length || 0} zones

                  </p>

                )}

              </div>

            )}


            {/* â”€â”€â”€ Quiz / Assessment Mode â”€â”€â”€ */}
            <div className="space-y-3 p-3 bg-violet-500/5 border border-violet-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Answer</span>
                <span className="text-[10px] text-zinc-500">(optional â€” leave blank for opinion-based questions)</span>
              </div>

              {/* Correct Answer â€” for choice questions */}
              {(question.type === "SINGLE_CHOICE" || question.type === "MULTI_CHOICE") && question.options.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-zinc-400">Correct Answer</Label>
                  {question.type === "SINGLE_CHOICE" ? (
                    <Select
                      value={(question.correctAnswer as string) || "_none"}
                      onValueChange={(v) => onUpdate({ correctAnswer: v === "_none" ? null : v })}
                    >
                      <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50">
                        <SelectValue placeholder="No correct answer" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700 z-[100]">
                        <SelectItem value="_none">
                          <span className="text-zinc-500">No correct answer (opinion)</span>
                        </SelectItem>
                        {question.options.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.text || "(empty option)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-500">Select all correct options:</p>
                      {question.options.map((opt) => {
                        const selected = Array.isArray(question.correctAnswer) && question.correctAnswer.includes(opt.id);
                        return (
                          <label key={opt.id} className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {
                                const current = Array.isArray(question.correctAnswer) ? [...question.correctAnswer] : [];
                                if (selected) {
                                  onUpdate({ correctAnswer: current.filter(id => id !== opt.id) });
                                } else {
                                  onUpdate({ correctAnswer: [...current, opt.id] });
                                }
                              }}
                              className="rounded border-zinc-600"
                            />
                            <span className="text-zinc-300">{opt.text || "(empty option)"}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Correct Order â€” for ranking questions */}
              {question.type === "RANKING" && question.options.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-zinc-400">Correct Order (drag to reorder, or leave as-is)</Label>
                  <p className="text-[10px] text-zinc-500">
                    The current option order (A, B, C...) is used as the correct ranking. Rearrange options above to set the correct order.
                    {question.correctAnswer 
                      ? " âœ“ Correct order is set." 
                      : " Click below to set current order as correct."}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                    onClick={() => onUpdate({ correctAnswer: question.options.map(o => o.id) })}
                  >
                    {question.correctAnswer ? "Update Correct Order" : "Set Current Order as Correct"}
                  </Button>
                  {question.correctAnswer && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-zinc-500 hover:text-destructive ml-2"
                      onClick={() => onUpdate({ correctAnswer: null })}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              )}

              {/* Correct answer explanation */}
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Write why this is the correct answer</Label>
                <Textarea
                  value={question.explanation || ""}
                  onChange={(e) => onUpdate({ explanation: e.target.value || null })}
                  placeholder="Explain why this answer is correct (shown when user clicks &quot;Why?&quot;)"
                  className="bg-zinc-800/50 border-zinc-700/50 min-h-[60px] text-sm"
                />
              </div>
              {/* Wrong answer explanation */}
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Write an explanation for when they got it wrong (optional)</Label>
                <Textarea
                  value={question.wrongExplanation || ""}
                  onChange={(e) => onUpdate({ wrongExplanation: e.target.value || null })}
                  placeholder="Explain why they got it wrong (shown when incorrect)"
                  className="bg-zinc-800/50 border-zinc-700/50 min-h-[60px] text-sm"
                />
              </div>
              {/* Deep explanation — second-layer clarification */}
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Deep Explanation (optional — shown on &quot;Still don&apos;t understand?&quot;)</Label>
                <Textarea
                  value={question.deepExplanation || ""}
                  onChange={(e) => onUpdate({ deepExplanation: e.target.value || null })}
                  placeholder="Provide a deeper explanation for students who need more help..."
                  className="bg-zinc-800/50 border-zinc-700/50 min-h-[60px] text-sm"
                />
              </div>

              {/* Commit Required toggle */}
              <div className="flex items-center space-x-2">
                <Switch
                  id={`commit-${question.id}`}
                  checked={question.commitRequired !== false}
                  onCheckedChange={(v) => onUpdate({ commitRequired: v })}
                />
                <Label htmlFor={`commit-${question.id}`} className="text-xs text-zinc-400">
                  Require &quot;Lock In&quot; before showing feedback
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id={`trick-${question.id}`}
                  checked={question.trickQuestion === true}
                  onCheckedChange={(v) => onUpdate({ trickQuestion: v })}
                />
                <Label htmlFor={`trick-${question.id}`} className="text-xs text-zinc-400">Trick question</Label>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
        )}
    </motion.div>
    </div>
  );
}

export function PollBuilder({
  initialData,
  onSave,
  onPreview,
  className,
}: PollBuilderProps) {
  // Start empty unless initialData provided
  const emptyData = useMemo(() => generateEmptyPollData(), []);
  
  const [data, setData] = useState<PollBuilderData>({
    title: initialData?.title || "",
    description: initialData?.description || "",
    type: initialData?.type || "SURVEY",
    allowPartialSubmission: initialData?.allowPartialSubmission ?? true,
    showProgressBar: initialData?.showProgressBar ?? true,
    randomizeQuestions: initialData?.randomizeQuestions ?? false,
    expiresAt: initialData?.expiresAt,
    flow: initialData?.flow || emptyData?.flow || [],
    sections: initialData?.sections || emptyData?.sections || [],
    questions: initialData?.questions || emptyData?.questions || [],
  });

  // History for undo/redo with full UI state (max 50 states)
  const MAX_HISTORY = 50;
  const DEBOUNCE_MS = 400; // Debounce time for rapid changes (typing)
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoRef = useRef(false);
  const historyIndexRef = useRef(historyIndex);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDescriptionRef = useRef<string>("Initial state");
  const lastDataJsonRef = useRef<string>("");
  
  // Keep ref in sync
  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  // NOTE: History push effect is defined AFTER UI state (expandedQuestions, selectedElementId, etc.)
  // See the pushToHistory callback and history effects below

  // NOTE: undo, redo, clearBuilder, canUndo, canRedo, and keyboard shortcuts
  // are defined AFTER UI state (expandedQuestions, selectedElementId, etc.)
  // to allow full UI state tracking in history

  // Helper lookups for questions and sections by ID
  const questionsById = useMemo(() => {
    const map = new Map<string, PollQuestion>();
    data.questions.forEach(q => map.set(q.id, q));
    return map;
  }, [data.questions]);

  const sectionsById = useMemo(() => {
    const map = new Map<string, PollSection>();
    (data.sections || []).forEach(s => map.set(s.id, s));
    return map;
  }, [data.sections]);

  // Get all question IDs that are in any flow (top-level or section)
  const questionsInFlow = useMemo(() => {
    const inFlow = new Set<string>();
    // Check top-level flow
    (data.flow || []).forEach(f => {
      if (f.type === 'QUESTION') inFlow.add(f.id);
    });
    // Check section flows
    (data.sections || []).forEach(s => {
      (s.flow || []).forEach(f => {
        if (f.type === 'QUESTION') inFlow.add(f.id);
      });
    });
    return inFlow;
  }, [data.flow, data.sections]);

  // Get all section IDs that are in any flow (top-level or nested in another section)
  const sectionsInFlow = useMemo(() => {
    const inFlow = new Set<string>();
    // Check top-level flow
    (data.flow || []).forEach(f => {
      if (f.type === 'SECTION') inFlow.add(f.id);
    });
    // Check section flows (nested sections)
    (data.sections || []).forEach(s => {
      (s.flow || []).forEach(f => {
        if (f.type === 'SECTION') inFlow.add(f.id);
      });
    });
    return inFlow;
  }, [data.flow, data.sections]);

  // Workbench questions = questions not in any flow
  const workbenchQuestions = useMemo(() => {
    return data.questions.filter(q => !questionsInFlow.has(q.id));
  }, [data.questions, questionsInFlow]);

  // Workbench sections = sections not in any flow
  const workbenchSections = useMemo(() => {
    return data.sections.filter(s => !sectionsInFlow.has(s.id));
  }, [data.sections, sectionsInFlow]);

  const [isSaving, setIsSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  // Support multiple expanded questions at once
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  // Legacy single-question state - now derived from set
  const expandedQuestion = expandedQuestions.size === 1 ? Array.from(expandedQuestions)[0] : null;
  const setExpandedQuestion = useCallback((questionId: string | null) => {
    if (questionId === null) {
      // Don't clear all - just ignore
      return;
    }
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, []);
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  
  // Drag-and-drop state for dragging questions and sections
  const [draggingQuestionId, setDraggingQuestionId] = useState<string | null>(null);
  const [draggingFromSectionId, setDraggingFromSectionId] = useState<string | null>(null); // Track source section
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [mergeSectionTarget, setMergeSectionTarget] = useState<string | null>(null); // Target section for merging
  const [dragSource, setDragSource] = useState<'workbench' | 'builder' | null>(null);
  const [dropTargetSectionId, setDropTargetSectionId] = useState<string | null>(null);
  const [dropTargetTopLevel, setDropTargetTopLevel] = useState<boolean>(false);
  // Drop mode: 'into' = add to section's questions, 'alongside' = place after section as standalone
  const [dropMode, setDropMode] = useState<'into' | 'alongside'>('into');
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Active element selection - for adding items to the selected element
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedElementType, setSelectedElementType] = useState<'section' | 'question' | null>(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  
  // Multi-input selection for synced typing (ALT+click on inputs)
  // Each entry is a unique ID like "questionId:optionId" or "questionId:questionText"
  const [multiSelectedInputs, setMultiSelectedInputs] = useState<Set<string>>(new Set());
  const [syncedInputValue, setSyncedInputValue] = useState<string>("");
  
  // Shape Match Visual Builder state
  const [shapeBuilderQuestionId, setShapeBuilderQuestionId] = useState<string | null>(null);
  
  // ============================================================================
  // HISTORY SYSTEM - Full UI state tracking with debounce
  // ============================================================================
  
  // Create a history entry with current state
  const createHistoryEntry = useCallback((description: string): HistoryEntry => ({
    data: JSON.parse(JSON.stringify(data)),
    expandedQuestions: Array.from(expandedQuestions),
    selectedElementId,
    multiSelectedIds: Array.from(multiSelectedIds),
    description,
    timestamp: Date.now(),
  }), [data, expandedQuestions, selectedElementId, multiSelectedIds]);
  
  // Use refs to avoid circular dependencies in effects
  const createHistoryEntryRef = useRef(createHistoryEntry);
  useEffect(() => { createHistoryEntryRef.current = createHistoryEntry; }, [createHistoryEntry]);
  
  // Push to history with optional debounce (for rapid changes like typing)
  const pushToHistoryDebounced = useCallback((description: string, immediate = false) => {
    const currentData = JSON.stringify(data);
    
    // Skip if data hasn't actually changed (only UI state changed)
    // But allow immediate pushes to capture important actions
    if (!immediate && currentData === lastDataJsonRef.current) {
      return;
    }
    
    // Clear any pending debounced push
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    pendingDescriptionRef.current = description;
    
    if (immediate) {
      // Push immediately for important actions
      lastDataJsonRef.current = currentData;
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndexRef.current + 1);
        newHistory.push(createHistoryEntryRef.current(description));
        if (newHistory.length > MAX_HISTORY) newHistory.shift();
        return newHistory;
      });
      setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
    } else {
      // Debounce for rapid changes (typing)
      debounceTimerRef.current = setTimeout(() => {
        lastDataJsonRef.current = currentData;
        setHistory(prev => {
          const newHistory = prev.slice(0, historyIndexRef.current + 1);
          newHistory.push(createHistoryEntryRef.current(pendingDescriptionRef.current));
          if (newHistory.length > MAX_HISTORY) newHistory.shift();
          return newHistory;
        });
        setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
        debounceTimerRef.current = null;
      }, DEBOUNCE_MS);
    }
  }, [data]);
  
  // Push to history immediately (for significant actions like add/delete/drag)
  const pushToHistory = useCallback((description: string) => {
    pushToHistoryDebounced(description, true);
  }, [pushToHistoryDebounced]);
  
  // Use refs for auto-push effects
  const pushToHistoryDebouncedRef = useRef(pushToHistoryDebounced);
  const pushToHistoryRef = useRef(pushToHistory);
  useEffect(() => { pushToHistoryDebouncedRef.current = pushToHistoryDebounced; }, [pushToHistoryDebounced]);
  useEffect(() => { pushToHistoryRef.current = pushToHistory; }, [pushToHistory]);

  // Track data changes and auto-push to history
  useEffect(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    // Debounced push for general data changes (typing, options, etc.)
    pushToHistoryDebouncedRef.current("Edit");
  }, [data]);
  
  // Track UI state changes (expand/collapse)
  const prevExpandedRef = useRef<Set<string>>(expandedQuestions);
  useEffect(() => {
    if (isUndoRedoRef.current) return;
    
    const prevExpanded = prevExpandedRef.current;
    const added = Array.from(expandedQuestions).filter(id => !prevExpanded.has(id));
    const removed = Array.from(prevExpanded).filter(id => !expandedQuestions.has(id));
    
    if (added.length > 0 || removed.length > 0) {
      const desc = added.length > 0 ? "Expanded question" : "Collapsed question";
      pushToHistoryRef.current(desc);
    }
    prevExpandedRef.current = new Set(expandedQuestions);
  }, [expandedQuestions]);
  
  // Restore state from history entry
  const restoreFromHistory = useCallback((entry: HistoryEntry) => {
    setData(JSON.parse(JSON.stringify(entry.data)));
    setExpandedQuestions(new Set(entry.expandedQuestions));
    setSelectedElementId(entry.selectedElementId);
    setMultiSelectedIds(new Set(entry.multiSelectedIds));
  }, []);
  
  // Undo - go back one step with notification
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoRef.current = true;
      const newIndex = historyIndex - 1;
      const entry = history[newIndex];
      const currentEntry = history[historyIndex];
      setHistoryIndex(newIndex);
      restoreFromHistory(entry);
      toast.success(`â†© Undid: ${currentEntry?.description || "action"}`, {
        duration: 2000,
        icon: "âª",
      });
    }
  }, [historyIndex, history, restoreFromHistory]);
  
  // Redo - go forward one step with notification
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true;
      const newIndex = historyIndex + 1;
      const entry = history[newIndex];
      setHistoryIndex(newIndex);
      restoreFromHistory(entry);
      toast.success(`â†ª Redid: ${entry?.description || "action"}`, {
        duration: 2000,
        icon: "â©",
      });
    }
  }, [historyIndex, history, restoreFromHistory]);
  
  // Clear - reset to empty state
  const clearBuilder = useCallback(() => {
    const emptyData: PollBuilderData = {
      title: "",
      description: "",
      type: "SURVEY",
      allowPartialSubmission: true,
      showProgressBar: true,
      randomizeQuestions: false,
      flow: [],
      sections: [],
      questions: [],
    };
    setData(emptyData);
    setExpandedQuestions(new Set());
    setSelectedElementId(null);
    setMultiSelectedIds(new Set());
    pushToHistory("Cleared builder");
    toast.success("Builder cleared");
  }, [pushToHistory]);
  
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  
  // Keyboard shortcuts for undo/redo (now works in inputs too!)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow undo/redo even in inputs - our debounce handles text changes
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (historyIndex > 0) {
          isUndoRedoRef.current = true;
          const newIndex = historyIndex - 1;
          const entry = history[newIndex];
          const currentEntry = history[historyIndex];
          setHistoryIndex(newIndex);
          restoreFromHistory(entry);
          toast.success(`â†© Undid: ${currentEntry?.description || "action"}`, {
            duration: 2000,
            icon: "âª",
          });
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (historyIndex < history.length - 1) {
          isUndoRedoRef.current = true;
          const newIndex = historyIndex + 1;
          const entry = history[newIndex];
          setHistoryIndex(newIndex);
          restoreFromHistory(entry);
          toast.success(`â†ª Redid: ${entry?.description || "action"}`, {
            duration: 2000,
            icon: "â©",
          });
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history, restoreFromHistory]);
  
  // ============================================================================
  
  // Ref for drag constraints container
  const questionsContainerRef = useRef<HTMLDivElement>(null);
  
  // Check which section drop zone or gap drop zone is at the given coordinates
  // Improved detection that skips pointer-events-none elements (like the dragged item)
  const checkDropZone = useCallback((x: number, y: number): string | null => {
    const elements = document.elementsFromPoint(x, y);
    
    for (const el of elements) {
      const htmlEl = el as HTMLElement;
      
      // Skip elements with pointer-events: none (these are overlays/drag ghosts)
      const computedStyle = window.getComputedStyle(htmlEl);
      if (computedStyle.pointerEvents === 'none') continue;
      
      // Check for gap drop targets (between items)
      const gapTarget = htmlEl.getAttribute?.("data-gap-drop-target");
      if (gapTarget !== null && gapTarget !== undefined) {
        return `gap-${gapTarget}`;
      }
      
      // Check for section drop targets
      const sectionId = htmlEl.getAttribute?.("data-section-drop-target");
      if (sectionId) return sectionId;
      
      // Check parent chain for section drop target
      const parent = htmlEl.closest?.("[data-section-drop-target]");
      if (parent) {
        const parentId = parent.getAttribute("data-section-drop-target");
        if (parentId) return parentId;
      }
    }
    return null;
  }, []);

  // Check drop zone for section questions - returns both section and top-level status
  const checkDropZoneForSectionQuestion = useCallback((x: number, y: number): { sectionId: string | null; topLevel: boolean } => {
    const elements = document.elementsFromPoint(x, y);
    
    let foundSectionId: string | null = null;
    let foundTopLevel = false;
    
    for (const el of elements) {
      const htmlEl = el as HTMLElement;
      
      // Skip elements with pointer-events: none
      const computedStyle = window.getComputedStyle(htmlEl);
      if (computedStyle.pointerEvents === 'none') continue;
      
      // Check for top-level drop target first
      if (htmlEl.hasAttribute?.("data-toplevel-drop-target")) {
        foundTopLevel = true;
        break;
      }
      
      // Check for section drop targets
      const sectionId = htmlEl.getAttribute?.("data-section-drop-target");
      if (sectionId) {
        foundSectionId = sectionId;
        break;
      }
      
      // Check parent chain
      const parent = htmlEl.closest?.("[data-section-drop-target]");
      if (parent) {
        foundSectionId = parent.getAttribute("data-section-drop-target");
        break;
      }
      const topLevelParent = htmlEl.closest?.("[data-toplevel-drop-target]");
      if (topLevelParent) {
        foundTopLevel = true;
        break;
      }
    }
    
    // Update visual state
    setDropTargetSectionId(foundSectionId);
    setDropTargetTopLevel(foundTopLevel);
    
    return { sectionId: foundSectionId, topLevel: foundTopLevel };
  }, []);

  // Copy poll data as JSON
  const handleCopyJson = useCallback(async () => {
    const exportData = {
      _version: "2.0",
      _format: "veggastare-poll-flow",
      title: data.title,
      description: data.description,
      type: data.type,
      allowPartialSubmission: data.allowPartialSubmission,
      showProgressBar: data.showProgressBar,
      randomizeQuestions: data.randomizeQuestions,
      expiresAt: data.expiresAt,
      flow: data.flow,
      sections: data.sections.map(s => ({
        id: s.id,
        title: s.title,
        description: s.description,
        icon: s.icon,
        flow: s.flow,
      })),
      questions: data.questions.map(q => ({
        id: q.id,
        type: q.type,
        questionText: q.questionText,
        description: q.description,
        required: q.required,
        allowImages: q.allowImages,
        sliderConfig: q.sliderConfig,
        ...(q.shapeMatchPreset && { shapeMatchPreset: q.shapeMatchPreset }),
        ...(q.shapeMatchConfig && { shapeMatchConfig: q.shapeMatchConfig }),
        options: q.options.map(o => ({ 
          id: o.id,
          text: o.text,
          description: o.description,
          value: o.value,
        })),
        // Quiz mode fields
        ...(q.correctAnswer != null && { correctAnswer: q.correctAnswer }),
        ...(q.explanation && { explanation: q.explanation }),
        ...(q.wrongExplanation && { wrongExplanation: q.wrongExplanation }),
        ...(q.deepExplanation && { deepExplanation: q.deepExplanation }),
        ...(q.commitRequired === false && { commitRequired: false }),
        ...(q.trickQuestion && { trickQuestion: q.trickQuestion }),
      })),
    };
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      setJustCopied(true);
      toast.success("Poll JSON copied to clipboard!");
      setTimeout(() => setJustCopied(false), 2000);
    } catch (e) {
      toast.error("Failed to copy to clipboard");
    }
  }, [data]);

  // Load full REACH System Audit template (30 questions across 10 sections)
  const loadREACHTemplate = useCallback(() => {
    const template = generateREACHTemplate();
    setData(template);
    setTimeout(() => pushToHistoryRef.current("Loaded REACH Template"), 0);
    toast.success("Loaded Feedback & Discovery template (28 questions, 8 sections)!");
  }, []);

  // Export as human-readable text format
  const handleExportAsText = useCallback(async () => {
    let text = `# ${data.title || "Untitled Poll"}\n`;
    if (data.description) {
      text += `${data.description}\n`;
    }
    text += `\nType: ${data.type}\n\n`;
    
    // Build flow order for sections and questions
    let questionNumber = 1;
    for (const flowItem of data.flow) {
      if (flowItem.type === "SECTION") {
        const section = data.sections.find(s => s.id === flowItem.id);
        if (section) {
          text += `## ${section.icon || "📋"} ${section.title || "Untitled Section"}\n`;
          if (section.description) {
            text += `${section.description}\n`;
          }
          text += "\n";
          
          for (const sectionFlow of section.flow || []) {
            if (sectionFlow.type === "QUESTION") {
              const q = data.questions.find(qst => qst.id === sectionFlow.id);
              if (q) {
                text += formatQuestionAsText(q, questionNumber++);
              }
            }
          }
        }
      } else if (flowItem.type === "QUESTION") {
        const q = data.questions.find(qst => qst.id === flowItem.id);
        if (q) {
          text += formatQuestionAsText(q, questionNumber++);
        }
      }
    }
    
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Poll copied as readable text!");
    } catch (e) {
      toast.error("Failed to copy to clipboard");
    }
  }, [data]);

  // Helper function to format a single question as text
  const formatQuestionAsText = (q: PollQuestion, num: number): string => {
    let qText = `${num}. ${q.questionText}`;
    if (q.required) qText += " *";
    if (q.type === "SLIDER" || q.type === "SCALE") qText += ` [${q.type}]`;
    if (q.type === "TEXT") qText += " [TEXT]";
    if (q.type === "RANKING") qText += " [RANKING]";
    if (q.trickQuestion) qText += " 🎭";
    qText += "\n";
    
    if (q.description) {
      qText += `   ${q.description}\n`;
    }
    
    if (q.options && q.options.length > 0) {
      for (const opt of q.options) {
        const isCorrect = Array.isArray(q.correctAnswer) 
          ? q.correctAnswer.includes(opt.id) 
          : q.correctAnswer === opt.id;
        qText += `   ${isCorrect ? "✓" : "○"} ${opt.text || "(empty)"}\n`;
      }
    }
    
    if (q.sliderConfig) {
      qText += `   Range: ${q.sliderConfig.min ?? q.sliderConfig.minValue ?? 0} - ${q.sliderConfig.max ?? q.sliderConfig.maxValue ?? 100}`;
      if (q.sliderConfig.minLabel && q.sliderConfig.maxLabel) {
        qText += ` (${q.sliderConfig.minLabel} to ${q.sliderConfig.maxLabel})`;
      }
      qText += "\n";
    }
    
    qText += "\n";
    return qText;
  };

  // Download JSON file
  const handleDownloadJson = useCallback(() => {
    const exportData = {
      _version: "2.0",
      _format: "veggastare-poll-flow",
      title: data.title,
      description: data.description,
      type: data.type,
      allowPartialSubmission: data.allowPartialSubmission,
      showProgressBar: data.showProgressBar,
      randomizeQuestions: data.randomizeQuestions,
      expiresAt: data.expiresAt,
      flow: data.flow,
      sections: data.sections.map(s => ({ id: s.id, title: s.title, description: s.description, icon: s.icon, flow: s.flow })),
      questions: data.questions.map(q => ({
        id: q.id, type: q.type, questionText: q.questionText, description: q.description,
        required: q.required, allowImages: q.allowImages, sliderConfig: q.sliderConfig,
        ...(q.shapeMatchPreset && { shapeMatchPreset: q.shapeMatchPreset }),
        ...(q.shapeMatchConfig && { shapeMatchConfig: q.shapeMatchConfig }),
        options: q.options.map(o => ({ id: o.id, text: o.text, description: o.description, value: o.value })),
        ...(q.correctAnswer != null && { correctAnswer: q.correctAnswer }),
        ...(q.explanation && { explanation: q.explanation }),
        ...(q.wrongExplanation && { wrongExplanation: q.wrongExplanation }),
        ...(q.deepExplanation && { deepExplanation: q.deepExplanation }),
        ...(q.commitRequired === false && { commitRequired: false }),
        ...(q.trickQuestion && { trickQuestion: q.trickQuestion }),
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(data.title || "poll").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Poll downloaded as JSON file!");
  }, [data]);

  // Import from file
  const handleImportFromFile = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.txt";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        // Try parsing as JSON first
        try {
          const parsed = JSON.parse(text);
          // Check if it's a valid poll format
          if (parsed.questions || parsed._format === "veggastare-poll-flow") {
            // Use the import modal logic - for now just open the modal with the content
            setShowImportModal(true);
            // Store content for the modal to use - we'll need to handle this in the modal
            toast.info("File loaded - paste content in the import modal", { duration: 3000 });
          } else {
            toast.error("Invalid poll format - file must contain questions array");
          }
        } catch {
          // Not JSON, show import modal for text parsing
          setShowImportModal(true);
          toast.info("File loaded - paste content in the import modal", { duration: 3000 });
        }
      } catch (err) {
        toast.error("Failed to read file");
      }
    };
    input.click();
  }, []);

  // Load Verify Poll Demo â€” easy-to-verify test poll (slider=6, ranking, choice)
  const loadVerifyDemoTemplate = useCallback(() => {
    const template = generateVerifyPollDemoTemplate();
    setData(template);
    setTimeout(() => pushToHistoryRef.current("Loaded Verify Poll Demo"), 0);
    toast.success("Loaded Verify Poll Demo â€” slide to 6, rank 1st-4th, select me!");
  }, []);

  // Load Feature Explorer Quiz — scored quiz testing real VeggaStare knowledge
  const loadFeatureExplorerTemplate = useCallback(() => {
    const template = generateFeatureExplorerTemplate();
    setData(template);
    setTimeout(() => pushToHistoryRef.current("Loaded Feature Explorer Quiz"), 0);
    toast.success("Loaded Feature Explorer Quiz (18 questions, 5 sections)!");
  }, []);

  // Load Canna Coco A+B Mastery Quiz — detailed growing knowledge test
  const loadCannaCocoTemplate = useCallback(() => {
    const template = generateCannaCocoQuizTemplate();
    setData(template);
    setTimeout(() => pushToHistoryRef.current("Loaded Canna Coco Quiz"), 0);
    toast.success("Loaded Canna Coco A+B Mastery Test (22 questions, 6 sections)!");
  }, []);

  // Add a new question - adds to selected section if one is selected, otherwise top-level
  const addQuestion = useCallback((type: QuestionType = "SINGLE_CHOICE") => {
    // Generate auto-increment question text
    const getNextQuestionText = (): string => {
      const existingQuestions = data.questions;
      if (existingQuestions.length === 0) {
        return "Is this where I can type my question?";
      }
      // Find the highest "Question N" number
      let maxNum = 1;
      existingQuestions.forEach(q => {
        const match = q.questionText.match(/^Question (\d+)$/);
        if (match) {
          maxNum = Math.max(maxNum, parseInt(match[1], 10));
        }
      });
      // Also check if the first placeholder exists
      const hasFirstPlaceholder = existingQuestions.some(q => 
        q.questionText === "Is this where I can type my question?"
      );
      if (hasFirstPlaceholder) {
        return `Question ${maxNum + 1}`;
      }
      // Return next number (minimum 2 since first is the special placeholder)
      return `Question ${Math.max(2, maxNum + 1)}`;
    };

    const newQuestion: PollQuestion = {
      id: generateId(),
      type,
      questionText: getNextQuestionText(),
      required: true,
      allowImages: false,
      options:
        type === "SINGLE_CHOICE" || type === "MULTI_CHOICE"
          ? [
              { id: generateId(), text: "" },
              { id: generateId(), text: "" },
            ]
          : [],
      sliderConfig: type === "SLIDER" ? { ...DEFAULT_SLIDER_CONFIG } : undefined,
    };

    // Add to selected section if one is selected; otherwise top-level
    const targetSectionId = selectedElementType === 'section' ? selectedElementId : null;

    setData((prev) => {
      if (targetSectionId) {
        // Add question to selected section's flow
        return {
          ...prev,
          questions: [...prev.questions, newQuestion],
          sections: prev.sections.map(s => 
            s.id === targetSectionId 
              ? { ...s, flow: [...s.flow, { type: 'QUESTION' as const, id: newQuestion.id }] }
              : s
          ),
        };
      } else {
        // Add to top-level flow
        return {
          ...prev,
          flow: [...prev.flow, { type: 'QUESTION' as const, id: newQuestion.id }],
          questions: [...prev.questions, newQuestion],
        };
      }
    });
    setExpandedQuestions(prev => new Set(prev).add(newQuestion.id));
    
    // Push to history with specific description
    const typeNames: Record<QuestionType, string> = {
      SINGLE_CHOICE: "Choice",
      MULTI_CHOICE: "Multi-choice",
      SLIDER: "Slider",
      SCALE: "Scale",
      TEXT: "Text",
      RANKING: "Ranking",
      SHAPE_MATCH: "Shape Match",
      UI_ARRANGE: "UI Arrange",
      NESTED: "Nested",
    };
    setTimeout(() => pushToHistoryRef.current(`Added ${typeNames[type]} question`), 0);
    
    // Show feedback about where it was added
    if (targetSectionId) {
      const section = data.sections.find(s => s.id === targetSectionId);
      toast.success(`Question added to "${section?.title || 'section'}"`);
    }
  }, [data.questions, data.sections, selectedElementId, selectedElementType]);

  // Remove a question (from storage and all flows)
  const removeQuestion = useCallback((questionId: string) => {
    setData((prev) => {
      // Remove from all section flows
      const updatedSections = prev.sections.map(s => ({
        ...s,
        flow: s.flow.filter(f => !(f.type === 'QUESTION' && f.id === questionId))
      }));
      
      return {
        ...prev,
        // Remove from top-level flow
        flow: prev.flow.filter(f => !(f.type === 'QUESTION' && f.id === questionId)),
        sections: updatedSections,
        questions: prev.questions.filter((q) => q.id !== questionId),
      };
    });
    setTimeout(() => pushToHistoryRef.current("Deleted question"), 0);
  }, []);

  // Section state for expand/collapse
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  
  // Toggle section expand/collapse
  const toggleSectionExpand = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Add a new section - adds to selected section if one is selected, otherwise top-level
  // If parentSectionId is explicitly passed, use that (for "Add Subsection" buttons)
  const addSection = useCallback((explicitParentId?: string | null) => {
    // Determine target: explicit parent > selected section > top-level
    const targetParentId = explicitParentId !== undefined 
      ? explicitParentId 
      : (selectedElementType === 'section' ? selectedElementId : null);
    
    // ─── DEPTH LIMIT CHECK ───
    // Prevent nesting beyond MAX_SECTION_DEPTH levels
    if (targetParentId) {
      const getDepth = (sectionId: string, sections: PollSection[], currentDepth: number): number => {
        // Check if this section is nested inside another section
        for (const s of sections) {
          const childRef = s.flow.find(f => f.type === 'SECTION' && f.id === sectionId);
          if (childRef) {
            return getDepth(s.id, sections, currentDepth + 1);
          }
        }
        return currentDepth;
      };
      const parentDepth = getDepth(targetParentId, data.sections, 1);
      if (parentDepth >= MAX_SECTION_DEPTH) {
        toast.error(`Maximum nesting depth is ${MAX_SECTION_DEPTH} levels. Reorganize your sections to keep things clean.`);
        return;
      }
    }
    
    // Generate auto-increment section title
    const getNextSectionTitle = (): string => {
      const existingSections = data.sections;
      if (existingSections.length === 0) {
        return "Is this where I type my section title?";
      }
      // Find the highest "Section N" number
      let maxNum = 1;
      existingSections.forEach(s => {
        const match = s.title.match(/^Section (\d+)$/);
        if (match) {
          maxNum = Math.max(maxNum, parseInt(match[1], 10));
        }
      });
      // Also check if the first placeholder exists
      const hasFirstPlaceholder = existingSections.some(s => 
        s.title === "Is this where I type my section title?"
      );
      if (hasFirstPlaceholder) {
        return `Section ${maxNum + 1}`;
      }
      // Return next number (minimum 2 since first is the special placeholder)
      return `Section ${Math.max(2, maxNum + 1)}`;
    };

    const newSection: PollSection = {
      id: generateId(),
      title: getNextSectionTitle(),
      description: "",
      flow: [], // Empty flow - will contain questions and nested sections
      isCollapsed: false,
    };
    
    setData((prev) => {
      if (targetParentId) {
        // Add directly to parent section's flow
        const updatedSections = prev.sections.map(s => 
          s.id === targetParentId 
            ? { ...s, flow: [...s.flow, { type: 'SECTION' as const, id: newSection.id }] }
            : s
        );
        return {
          ...prev,
          sections: [...updatedSections, newSection],
        };
      } else {
        // Add to top-level flow (Builder)
        return {
          ...prev,
          flow: [...prev.flow, { type: 'SECTION', id: newSection.id }],
          sections: [...prev.sections, newSection],
        };
      }
    });
    setExpandedSections((prev) => new Set(prev).add(newSection.id));
    
    // Push to history with specific description
    setTimeout(() => pushToHistoryRef.current(targetParentId ? "Added subsection" : "Added section"), 0);
    
    // Show feedback about where it was added
    if (targetParentId) {
      const parentSection = data.sections.find(s => s.id === targetParentId);
      toast.success(`Section added to "${parentSection?.title || 'section'}"`);
    }
  }, [data.sections, selectedElementId, selectedElementType]);

  // Remove a section and all its nested content
  const removeSection = useCallback((sectionId: string, removeQuestions: boolean = false) => {
    setData((prev) => {
      // Get all nested section IDs recursively (sections inside this section's flow)
      const getNestedSectionIds = (sId: string): string[] => {
        const section = prev.sections.find(s => s.id === sId);
        if (!section) return [];
        const nestedSectionIds = section.flow
          .filter(f => f.type === 'SECTION')
          .map(f => f.id);
        return nestedSectionIds.flatMap(id => [id, ...getNestedSectionIds(id)]);
      };
      
      // Get all question IDs in this section and nested sections
      const getQuestionsInSection = (sId: string): string[] => {
        const section = prev.sections.find(s => s.id === sId);
        if (!section) return [];
        const questionIds = section.flow
          .filter(f => f.type === 'QUESTION')
          .map(f => f.id);
        const nestedSectionIds = section.flow
          .filter(f => f.type === 'SECTION')
          .map(f => f.id);
        return [...questionIds, ...nestedSectionIds.flatMap(id => getQuestionsInSection(id))];
      };
      
      const sectionIdsToRemove = [sectionId, ...getNestedSectionIds(sectionId)];
      const questionIdsToRemove = removeQuestions ? getQuestionsInSection(sectionId) : [];
      
      // Remove from top-level flow
      const newFlow = prev.flow.filter(f => !(f.type === 'SECTION' && sectionIdsToRemove.includes(f.id)));
      
      // Remove from all section flows
      const updatedSections = prev.sections
        .filter(s => !sectionIdsToRemove.includes(s.id))
        .map(s => ({
          ...s,
          flow: s.flow.filter(f => !(f.type === 'SECTION' && sectionIdsToRemove.includes(f.id)))
        }));

      return {
        ...prev,
        flow: newFlow,
        sections: updatedSections,
        questions: removeQuestions 
          ? prev.questions.filter(q => !questionIdsToRemove.includes(q.id))
          : prev.questions,
      };
    });
    setTimeout(() => pushToHistoryRef.current("Deleted section"), 0);
  }, []);

  // Update a section
  const updateSection = useCallback(
    (sectionId: string, updates: Partial<Omit<PollSection, "id">>) => {
      setData((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, ...updates } : s
        ),
      }));
    },
    []
  );

  // Move section up or down within its flow
  const moveSection = useCallback((sectionId: string, direction: "up" | "down") => {
    setData((prev) => {
      // Find which flow contains this section
      const topLevelIdx = prev.flow.findIndex(f => f.type === 'SECTION' && f.id === sectionId);
      
      if (topLevelIdx !== -1) {
        // Move in top-level flow
        const newIdx = direction === "up" ? topLevelIdx - 1 : topLevelIdx + 1;
        if (newIdx < 0 || newIdx >= prev.flow.length) return prev;
        const newFlow = [...prev.flow];
        [newFlow[topLevelIdx], newFlow[newIdx]] = [newFlow[newIdx], newFlow[topLevelIdx]];
        setTimeout(() => pushToHistoryRef.current(`Moved section ${direction}`), 0);
        return { ...prev, flow: newFlow };
      }
      
      // Check parent section flows
      for (const section of prev.sections) {
        const idx = section.flow.findIndex(f => f.type === 'SECTION' && f.id === sectionId);
        if (idx !== -1) {
          const newIdx = direction === "up" ? idx - 1 : idx + 1;
          if (newIdx < 0 || newIdx >= section.flow.length) return prev;
          const newFlow = [...section.flow];
          [newFlow[idx], newFlow[newIdx]] = [newFlow[newIdx], newFlow[idx]];
          setTimeout(() => pushToHistoryRef.current(`Moved section ${direction}`), 0);
          return {
            ...prev,
            sections: prev.sections.map(s => 
              s.id === section.id ? { ...s, flow: newFlow } : s
            ),
          };
        }
      }
      
      return prev;
    });
  }, []);

  // Merge one section into another (make it a sub-section)
  // Removes the source section from its current flow and adds it to the target section's flow
  const mergeSectionIntoSection = useCallback((sourceSectionId: string, targetSectionId: string) => {
    if (sourceSectionId === targetSectionId) return; // Can't merge into itself
    
    setData((prev) => {
      // Check if target is a descendant of source (would create circular reference)
      const isDescendant = (parentId: string, checkId: string): boolean => {
        const parent = prev.sections.find(s => s.id === parentId);
        if (!parent) return false;
        for (const item of parent.flow) {
          if (item.type === 'SECTION') {
            if (item.id === checkId) return true;
            if (isDescendant(item.id, checkId)) return true;
          }
        }
        return false;
      };
      
      if (isDescendant(sourceSectionId, targetSectionId)) {
        // Target is inside source - can't merge
        return prev;
      }
      
      // Remove source section from top-level flow
      let newTopFlow = prev.flow.filter(f => !(f.type === 'SECTION' && f.id === sourceSectionId));
      
      // Remove from all section flows (including target if somehow already there)
      let updatedSections = prev.sections.map(s => ({
        ...s,
        flow: s.flow.filter(f => !(f.type === 'SECTION' && f.id === sourceSectionId))
      }));
      
      // Add to target section's flow
      updatedSections = updatedSections.map(s => 
        s.id === targetSectionId 
          ? { ...s, flow: [...s.flow, { type: 'SECTION' as const, id: sourceSectionId }] }
          : s
      );
      
      return {
        ...prev,
        flow: newTopFlow,
        sections: updatedSections,
      };
    });
    
    setTimeout(() => pushToHistoryRef.current("Merged section"), 0);
    toast.success("Section merged as sub-section!");
  }, []);

  // Move a nested section to top-level (unparent it)
  const moveSectionToTopLevel = useCallback((sectionId: string) => {
    setData((prev) => {
      // Check if already at top-level
      const isTopLevel = prev.flow.some(f => f.type === 'SECTION' && f.id === sectionId);
      if (isTopLevel) return prev;
      
      // Remove from all section flows
      const updatedSections = prev.sections.map(s => ({
        ...s,
        flow: s.flow.filter(f => !(f.type === 'SECTION' && f.id === sectionId))
      }));
      
      // Add to top-level flow
      return {
        ...prev,
        flow: [...prev.flow, { type: 'SECTION' as const, id: sectionId }],
        sections: updatedSections,
      };
    });
    
    setTimeout(() => pushToHistoryRef.current("Moved section to top-level"), 0);
    toast.success("Section moved to top-level!");
  }, []);

  // Handle element selection - click to select, hold ALT for multi-select
  const handleElementSelect = useCallback((elementId: string, elementType: 'section' | 'question', event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (event.altKey) {
      // Multi-select with ALT
      setMultiSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(elementId)) {
          next.delete(elementId);
        } else {
          next.add(elementId);
        }
        return next;
      });
    } else {
      // Single select
      setSelectedElementId(elementId);
      setSelectedElementType(elementType);
      setMultiSelectedIds(new Set([elementId]));
    }
  }, []);

  // Clear selection when clicking outside
  const clearSelection = useCallback(() => {
    setSelectedElementId(null);
    setSelectedElementType(null);
    setMultiSelectedIds(new Set());
    // Also clear multi-input selection
    setMultiSelectedInputs(new Set());
    setSyncedInputValue("");
  }, []);

  // Handle ALT+click on an input to add it to multi-selection
  const handleInputMultiSelect = useCallback((inputId: string, currentValue: string, event: React.MouseEvent) => {
    if (event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      setMultiSelectedInputs(prev => {
        const next = new Set(prev);
        if (next.has(inputId)) {
          next.delete(inputId);
          // If we removed an input, clear the synced value if no inputs left
          if (next.size === 0) {
            setSyncedInputValue("");
          }
        } else {
          next.add(inputId);
          // If this is the first input, use its value as the synced value
          if (next.size === 1) {
            setSyncedInputValue(currentValue);
          }
        }
        return next;
      });
      return true; // Signal that we handled the event
    }
    return false;
  }, []);

  // Handle synced input change - updates all multi-selected inputs
  const handleSyncedInputChange = useCallback((newValue: string) => {
    setSyncedInputValue(newValue);
    // Update all multi-selected option inputs
    setData((prev) => {
      const updatedQuestions = prev.questions.map(q => {
        if (!q.options) return q;
        const updatedOptions = q.options.map(opt => {
          const inputId = `${q.id}:${opt.id}`;
          if (multiSelectedInputs.has(inputId)) {
            return { ...opt, text: newValue };
          }
          return opt;
        });
        return { ...q, options: updatedOptions };
      });
      return { ...prev, questions: updatedQuestions };
    });
  }, [multiSelectedInputs]);

  // Add question to a section's flow (removes from any other flow first)
  // If sectionId is null, moves question to top-level flow
  const assignQuestionToSection = useCallback((questionId: string, sectionId: string | null) => {
    setData((prev) => {
      // First, remove from top-level flow
      let newTopFlow = prev.flow.filter(f => !(f.type === 'QUESTION' && f.id === questionId));
      
      // Remove from all section flows
      let updatedSections = prev.sections.map(s => ({
        ...s,
        flow: s.flow.filter(f => !(f.type === 'QUESTION' && f.id === questionId))
      }));
      
      // If sectionId is provided, add to that section's flow
      // If sectionId is null, add to top-level flow
      if (sectionId) {
        updatedSections = updatedSections.map(s => 
          s.id === sectionId 
            ? { ...s, flow: [...s.flow, { type: 'QUESTION' as const, id: questionId }] }
            : s
        );
      } else {
        // Add to top-level flow
        newTopFlow = [...newTopFlow, { type: 'QUESTION' as const, id: questionId }];
      }
      
      return {
        ...prev,
        flow: newTopFlow,
        sections: updatedSections,
      };
    });
  }, []);
  
  // Handle dropping a question onto a section
  const handleDropOnSection = useCallback((sectionId: string) => {
    if (draggingQuestionId) {
      assignQuestionToSection(draggingQuestionId, sectionId);
      setDraggingQuestionId(null);
      setDropTargetSectionId(null);
      toast.success("Question moved to section!");
    }
  }, [draggingQuestionId, assignQuestionToSection]);

  // Handle dropping a section question (from inside a section) onto a target
  const handleSectionQuestionDrop = useCallback((questionId: string, targetSectionId: string | null, isTopLevel: boolean) => {
    if (isTopLevel) {
      assignQuestionToSection(questionId, null);
      toast.success("Question moved to top-level!");
    } else if (targetSectionId) {
      assignQuestionToSection(questionId, targetSectionId);
      toast.success("Question moved to section!");
    }
    setDropTargetSectionId(null);
    setDropTargetTopLevel(false);
  }, [assignQuestionToSection]);
  
  // Coordinate-based drop detection - listens to mouse position while dragging
  // This allows drops even when the dragged element blocks hover events
  useEffect(() => {
    if (!draggingQuestionId) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      // Get all elements under the cursor
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      
      // Find any section drop target or top-level drop target, skipping pointer-events-none elements
      let foundSectionId: string | null = null;
      let foundTopLevel = false;
      
      for (const el of elements) {
        const htmlEl = el as HTMLElement;
        
        // Skip elements with pointer-events: none (drag ghosts/overlays)
        const computedStyle = window.getComputedStyle(htmlEl);
        if (computedStyle.pointerEvents === 'none') continue;
        
        // Check for top-level drop target
        if (htmlEl.hasAttribute?.("data-toplevel-drop-target")) {
          foundTopLevel = true;
          break;
        }
        
        const sectionId = htmlEl.getAttribute?.("data-section-drop-target");
        if (sectionId) {
          foundSectionId = sectionId;
          break;
        }
        // Also check parent elements
        const parent = htmlEl.closest?.("[data-section-drop-target]");
        if (parent) {
          foundSectionId = parent.getAttribute("data-section-drop-target");
          break;
        }
        const topLevelParent = htmlEl.closest?.("[data-toplevel-drop-target]");
        if (topLevelParent) {
          foundTopLevel = true;
          break;
        }
      }
      
      setDropTargetSectionId(foundSectionId);
      setDropTargetTopLevel(foundTopLevel);
    };
    
    const handleMouseUp = () => {
      if (dropTargetTopLevel && draggingQuestionId) {
        // Drop the question to top-level (only if not already top-level)
        if (draggingFromSectionId !== null) {
          assignQuestionToSection(draggingQuestionId, null);
          toast.success("Question moved to top-level!");
        }
      } else if (dropTargetSectionId && draggingQuestionId) {
        // Drop the question into the section (only if different section)
        if (dropTargetSectionId !== draggingFromSectionId) {
          assignQuestionToSection(draggingQuestionId, dropTargetSectionId);
          toast.success("Question moved to section!");
        }
        // If same section, question snaps back - no action needed
      }
      setDraggingQuestionId(null);
      setDraggingFromSectionId(null);
      setDropTargetSectionId(null);
      setDropTargetTopLevel(false);
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingQuestionId, draggingFromSectionId, dropTargetSectionId, dropTargetTopLevel, assignQuestionToSection]);

  // Reorder items within a section's flow
  const reorderQuestionsInSection = useCallback((sectionId: string, newOrder: string[]) => {
    setData((prev) => {
      return {
        ...prev,
        sections: prev.sections.map(s => {
          if (s.id !== sectionId) return s;
          // Rebuild flow with new order (only for items in newOrder, preserving types)
          const flowMap = new Map(s.flow.map(f => [f.id, f]));
          const newFlow = newOrder
            .map(id => flowMap.get(id))
            .filter(Boolean) as FlowItem[];
          return { ...s, flow: newFlow };
        }),
      };
    });
  }, []);

  // Reorder top-level flow items
  const reorderTopLevelFlow = useCallback((newOrder: string[]) => {
    setData((prev) => {
      const flowMap = new Map(prev.flow.map(f => [f.id, f]));
      const newFlow = newOrder
        .map(id => flowMap.get(id))
        .filter(Boolean) as FlowItem[];
      return { ...prev, flow: newFlow };
    });
  }, []);

  // Add a question to the top-level flow at a specific index
  const addQuestionToTopFlow = useCallback((questionId: string, atIndex?: number) => {
    setData((prev) => {
      // First remove from any existing flow
      let newTopFlow = prev.flow.filter(f => !(f.type === 'QUESTION' && f.id === questionId));
      const updatedSections = prev.sections.map(s => ({
        ...s,
        flow: s.flow.filter(f => !(f.type === 'QUESTION' && f.id === questionId))
      }));
      
      // Add to top-level flow
      const newItem: FlowItem = { type: 'QUESTION', id: questionId };
      if (atIndex !== undefined && atIndex >= 0 && atIndex <= newTopFlow.length) {
        newTopFlow = [...newTopFlow.slice(0, atIndex), newItem, ...newTopFlow.slice(atIndex)];
      } else {
        newTopFlow = [...newTopFlow, newItem];
      }
      
      return { ...prev, flow: newTopFlow, sections: updatedSections };
    });
  }, []);

  // Remove a question from all flows (move to Workbench)
  const removeQuestionFromFlow = useCallback((questionId: string) => {
    setData((prev) => {
      const newTopFlow = prev.flow.filter(f => !(f.type === 'QUESTION' && f.id === questionId));
      const updatedSections = prev.sections.map(s => ({
        ...s,
        flow: s.flow.filter(f => !(f.type === 'QUESTION' && f.id === questionId))
      }));
      return { ...prev, flow: newTopFlow, sections: updatedSections };
    });
  }, []);

  // Remove a section from all flows (move to Workbench)
  const removeSectionFromFlow = useCallback((sectionId: string) => {
    setData((prev) => {
      const newTopFlow = prev.flow.filter(f => !(f.type === 'SECTION' && f.id === sectionId));
      const updatedSections = prev.sections.map(s => ({
        ...s,
        flow: s.flow.filter(f => !(f.type === 'SECTION' && f.id === sectionId))
      }));
      return { ...prev, flow: newTopFlow, sections: updatedSections };
    });
  }, []);

  // Add a section to the top-level flow at a specific index
  const addSectionToTopFlow = useCallback((sectionId: string, atIndex?: number) => {
    setData((prev) => {
      // First remove from any existing flow (in case it's nested in another section)
      let newTopFlow = prev.flow.filter(f => !(f.type === 'SECTION' && f.id === sectionId));
      const updatedSections = prev.sections.map(s => ({
        ...s,
        flow: s.flow.filter(f => !(f.type === 'SECTION' && f.id === sectionId))
      }));
      
      // Add to top-level flow
      const newItem: FlowItem = { type: 'SECTION', id: sectionId };
      if (atIndex !== undefined && atIndex >= 0 && atIndex <= newTopFlow.length) {
        newTopFlow = [...newTopFlow.slice(0, atIndex), newItem, ...newTopFlow.slice(atIndex)];
      } else {
        newTopFlow = [...newTopFlow, newItem];
      }
      
      return { ...prev, flow: newTopFlow, sections: updatedSections };
    });
  }, []);

  // Handle import from PollImportModal â€” always clear builder first, then import
  const handleImportFromModal = useCallback((imported: ImportedPoll) => {
    // Map imported question types to our types
    const typeMap: Record<string, QuestionType> = {
      "choice": "SINGLE_CHOICE",
      "multi-choice": "MULTI_CHOICE",
      "text": "TEXT",
      "slider": "SLIDER",
      "scale": "SCALE",
      "ranking": "RANKING",
      "shape-match": "SHAPE_MATCH",
    };

    // Helper to build slider config from question
    const buildSliderConfig = (q: ImportedQuestion, mappedType: QuestionType): SliderConfig | undefined => {
      const sourceConfig = q.sliderConfig || q.scaleConfig;
      if ((mappedType === "SLIDER" || mappedType === "SCALE") && sourceConfig) {
        const minVal = sourceConfig.min ?? 1;
        const maxVal = sourceConfig.max ?? 10;
        const stepVal = 'step' in sourceConfig && typeof sourceConfig.step === 'number' ? sourceConfig.step : 1;
        const stepLabelsVal = 'stepLabels' in sourceConfig && Array.isArray(sourceConfig.stepLabels) ? sourceConfig.stepLabels : [];
        
        return {
          min: minVal,
          max: maxVal,
          minValue: minVal,
          maxValue: maxVal,
          step: stepVal,
          minLabel: sourceConfig.minLabel ?? "",
          maxLabel: sourceConfig.maxLabel ?? "",
          stepLabels: stepLabelsVal,
          showValue: true,
        };
      }
      return undefined;
    };

    // Create question map for ID lookup
    const questionMap = new Map<string, ImportedQuestion>();
    imported.questions.forEach(q => {
      if (q.id) questionMap.set(q.id, q);
    });

    // Transform all questions (replace, not append)
    const newQuestions: PollQuestion[] = imported.questions.map((q, i) => {
      const mappedType = typeMap[q.type] || "TEXT";
      return {
        id: q.id || generateId(),
        order: i + 1,
        type: mappedType,
        questionText: q.text,
        description: q.description,
        required: q.required ?? true,
        allowImages: false,
        options: q.options?.map((opt) => ({
          id: opt.id || generateId(),
          text: opt.text,
        })) || [],
        sliderConfig: buildSliderConfig(q, mappedType),
        shapeMatchPreset: q.shapeMatchPreset as PollQuestion["shapeMatchPreset"],
        shapeMatchConfig: (q as any).shapeMatchConfig ?? undefined,
        // Quiz mode fields
        correctAnswer: q.correctAnswer ?? undefined,
        explanation: q.explanation ?? undefined,
        wrongExplanation: q.wrongExplanation ?? undefined,
        deepExplanation: q.deepExplanation ?? undefined,
        commitRequired: q.commitRequired,
        trickQuestion: q.trickQuestion,
      };
    });

    // Check if this is a full v2.0 import with sections and flow
    const hasFullStructure = imported.sections && imported.sections.length > 0 && imported.flow;

    if (hasFullStructure) {
      // Full import: use the imported flow and sections structure
      const newSections: PollSection[] = imported.sections!.map(s => ({
        id: s.id || generateId(),
        title: s.title,
        description: s.description || "",
        icon: s.icon,
        flow: (s.flow || []).map(f => ({
          type: f.type as FlowItem['type'],
          id: f.id,
        })),
      }));

      const newFlow: FlowItem[] = imported.flow!.map(f => ({
        type: f.type as FlowItem['type'],
        id: f.id,
      }));

      setData((prev) => ({
        ...prev,
        title: imported.title || prev.title,
        description: imported.description ?? prev.description,
        type: imported.type as PollType,
        allowPartialSubmission: imported.settings?.allowPartialSubmission ?? prev.allowPartialSubmission,
        showProgressBar: imported.settings?.showProgressBar ?? prev.showProgressBar,
        randomizeQuestions: imported.settings?.randomizeQuestions ?? prev.randomizeQuestions,
        flow: newFlow,
        sections: newSections,
        questions: newQuestions,
      }));

      setTimeout(() => pushToHistoryRef.current(
        `Imported ${newQuestions.length} questions, ${newSections.length} sections`
      ), 0);
    } else {
      // Simple import: just questions, add them to top-level flow
      const newFlowItems = newQuestions.map(q => ({ 
        type: 'QUESTION' as const, 
        id: q.id 
      }));

      setData((prev) => ({
        ...prev,
        title: imported.title || prev.title,
        description: imported.description ?? prev.description,
        type: imported.type as PollType,
        flow: newFlowItems,
        questions: newQuestions,
      }));
      
      setTimeout(() => pushToHistoryRef.current(`Imported ${newQuestions.length} questions`), 0);
    }
  }, []);

  // Update a question
  const updateQuestion = useCallback(
    (questionId: string, updates: Partial<PollQuestion>) => {
      // Intercept _openVisualBuilder flag to open shape builder modal
      if ((updates as any)._openVisualBuilder) {
        setShapeBuilderQuestionId(questionId);
        return;
      }
      setData((prev) => ({
        ...prev,
        questions: prev.questions.map((q) =>
          q.id === questionId ? { ...q, ...updates } : q
        ),
      }));
    },
    []
  );

  // Add option to a question
  const addOption = useCallback((questionId: string) => {
    setData((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: [...q.options, { id: generateId(), text: "" }],
            }
          : q
      ),
    }));
  }, []);

  // Remove option from a question
  const removeOption = useCallback((questionId: string, optionId: string) => {
    setData((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.filter((o) => o.id !== optionId),
            }
          : q
      ),
    }));
  }, []);

  // Update option
  const updateOption = useCallback(
    (questionId: string, optionId: string, updates: Partial<QuestionOption>) => {
      setData((prev) => ({
        ...prev,
        questions: prev.questions.map((q) =>
          q.id === questionId
            ? {
                ...q,
                options: q.options.map((o) =>
                  o.id === optionId ? { ...o, ...updates } : o
                ),
              }
            : q
        ),
      }));
    },
    []
  );

  // Move question up/down
  const moveQuestion = useCallback((questionId: string, direction: "up" | "down") => {
    setData((prev) => {
      const questions = [...prev.questions];
      const index = questions.findIndex((q) => q.id === questionId);
      if (
        (direction === "up" && index === 0) ||
        (direction === "down" && index === questions.length - 1)
      ) {
        return prev;
      }

      const newIndex = direction === "up" ? index - 1 : index + 1;
      [questions[index], questions[newIndex]] = [questions[newIndex], questions[index]];

      return {
        ...prev,
        questions: questions.map((q, i) => ({ ...q, order: i + 1 })),
      };
    });
  }, []);

  // Import from text or JSON
  const handleImport = useCallback(async () => {
    if (!importText.trim()) return;

    setIsImporting(true);
    try {
      let parsed: any;
      let isFlowFormat = false;

      // Detect JSON format (VeggaStare export or generic JSON)
      const trimmed = importText.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          const json = JSON.parse(trimmed);
          // Check if it's our new flow format
          if (json._format === "veggastare-poll-flow") {
            isFlowFormat = true;
            parsed = {
              title: json.title || "",
              description: json.description || "",
              type: json.type || "SURVEY",
              allowPartialSubmission: json.allowPartialSubmission ?? false,
              showProgressBar: json.showProgressBar ?? true,
              randomizeQuestions: json.randomizeQuestions ?? false,
              expiresAt: json.expiresAt || null,
              flow: json.flow || [],
              sections: json.sections || [],
              questions: json.questions || [],
            };
            toast.success("Flow format detected!");
          } else if (json._format === "veggastare-poll" || json.questions) {
            // Legacy format - convert to flow format
            parsed = {
              title: json.title || "",
              description: json.description || "",
              type: json.type || "SURVEY",
              allowPartialSubmission: json.allowPartialSubmission ?? false,
              showProgressBar: json.showProgressBar ?? true,
              randomizeQuestions: json.randomizeQuestions ?? false,
              expiresAt: json.expiresAt || null,
              sections: json.sections || [],
              questions: json.questions || [],
            };
            toast.success("Legacy JSON format detected!");
          } else {
            throw new Error("Not a valid poll JSON");
          }
        } catch (jsonError) {
          // Not valid JSON, fall through to API parsing
          parsed = null;
        }
      }

      // If not JSON, use API to parse text format
      if (!parsed) {
        const response = await fetch("/api/advanced-polls/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: importText }),
        });

        if (!response.ok) {
          throw new Error("Failed to parse text");
        }

        parsed = await response.json();
      }

      // Create ID mappings (old ID -> new ID)
      const sectionIdMap: Record<string, string> = {};
      const questionIdMap: Record<string, string> = {};

      // Process sections with new IDs
      const importedSections: PollSection[] = (parsed.sections || []).map(
        (s: any) => {
          const newId = generateId();
          if (s.id) {
            sectionIdMap[s.id] = newId;
          }
          return {
            id: newId,
            title: s.title || "",
            description: s.description || "",
            icon: s.icon,
            flow: [], // Will be populated below for flow format
          };
        }
      );

      // Process questions with new IDs
      const importedQuestions: PollQuestion[] = (parsed.questions || []).map(
        (q: any) => {
          const newId = generateId();
          if (q.id) {
            questionIdMap[q.id] = newId;
          }
          return {
            id: newId,
            type: q.type || "SINGLE_CHOICE",
            questionText: q.questionText || q.text || "",
            description: q.description,
            required: q.required ?? true,
            allowImages: q.allowImages ?? false,
            options:
              q.options?.map((opt: any) => ({
                id: generateId(),
                text: typeof opt === "string" ? opt : opt.text,
                description: opt.description,
                value: opt.value,
              })) || [],
            sliderConfig: q.sliderConfig,
            shapeMatchPreset: q.shapeMatchPreset,
            shapeMatchConfig: q.shapeMatchConfig ?? undefined,
            // Quiz mode fields
            correctAnswer: q.correctAnswer ?? undefined,
            explanation: q.explanation ?? undefined,
            wrongExplanation: q.wrongExplanation ?? undefined,
            deepExplanation: q.deepExplanation ?? undefined,
            commitRequired: q.commitRequired,
            trickQuestion: q.trickQuestion,
          };
        }
      );

      // Handle flow format - remap flow IDs
      let importedFlow: FlowItem[] = [];
      if (isFlowFormat && parsed.flow) {
        importedFlow = parsed.flow.map((f: FlowItem) => ({
          type: f.type,
          id: f.type === 'SECTION' ? (sectionIdMap[f.id] || f.id) : (questionIdMap[f.id] || f.id),
        }));

        // Remap section flows
        (parsed.sections || []).forEach((s: any, i: number) => {
          if (s.flow && Array.isArray(s.flow)) {
            importedSections[i].flow = s.flow.map((f: FlowItem) => ({
              type: f.type,
              id: f.type === 'SECTION' ? (sectionIdMap[f.id] || f.id) : (questionIdMap[f.id] || f.id),
            }));
          }
        });
      }

      setData((prev) => ({
        ...prev,
        title: parsed.title || prev.title || "",
        description: parsed.description || prev.description || "",
        type: parsed.type || prev.type || "SURVEY",
        allowPartialSubmission: parsed.allowPartialSubmission ?? prev.allowPartialSubmission,
        showProgressBar: parsed.showProgressBar ?? prev.showProgressBar,
        randomizeQuestions: parsed.randomizeQuestions ?? prev.randomizeQuestions,
        expiresAt: parsed.expiresAt || prev.expiresAt,
        flow: [...prev.flow, ...importedFlow],
        sections: [...prev.sections, ...importedSections],
        questions: [...prev.questions, ...importedQuestions],
      }));

      setShowImportModal(false);
      setImportText("");
      toast.success(`Imported ${importedSections.length} section(s) and ${importedQuestions.length} question(s)`);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import. Please check the format.");
    } finally {
      setIsImporting(false);
    }
  }, [importText]);

  // Save poll
  const handleSave = useCallback(async () => {
    if (!data.title.trim()) {
      alert("Please enter a poll title");
      return;
    }
    if (data.questions.length === 0) {
      alert("Please add at least one question");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(data);
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save poll");
    } finally {
      setIsSaving(false);
    }
  }, [data, onSave]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("space-y-4", className)} onClick={clearSelection}>
        {/* Quick Start Guide */}
        <div className="p-3 rounded-lg bg-gradient-to-r from-zinc-900/80 to-zinc-800/50 border border-zinc-800/50">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">?</div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-zinc-200 mb-1">Quick Guide</h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-primary text-[10px] font-bold">1</span>
                  <span>Add questions &amp; sections</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-primary text-[10px] font-bold">2</span>
                  <span>Drag to reorder</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-primary text-[10px] font-bold">3</span>
                  <span>Preview your poll</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-primary text-[10px] font-bold">4</span>
                  <span>Save when ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-zinc-100">Poll Builder</h2>
          <div className="flex flex-wrap gap-1.5">
            {/* Import Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200">
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700 min-w-[200px]">
                <DropdownMenuItem onClick={() => setShowImportModal(true)} className="gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <div className="flex flex-col">
                    <span>Paste Text or JSON</span>
                    <span className="text-xs text-muted-foreground">AI-generated polls, text lists</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImportFromFile} className="gap-2">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <div className="flex flex-col">
                    <span>Import from File</span>
                    <span className="text-xs text-muted-foreground">.json or .txt files</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200">
                  {justCopied ? (
                    <Check className="w-4 h-4 mr-2 text-green-500" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {justCopied ? "Copied!" : "Export"}
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700 min-w-[220px]">
                <DropdownMenuItem onClick={handleCopyJson} className="gap-2">
                  <Copy className="w-4 h-4 text-blue-400" />
                  <div className="flex flex-col">
                    <span>Copy as JSON</span>
                    <span className="text-xs text-muted-foreground">For AI agents, developers</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportAsText} className="gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <div className="flex flex-col">
                    <span>Copy as Text</span>
                    <span className="text-xs text-muted-foreground">Human-readable, easy to edit</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-700" />
                <DropdownMenuItem onClick={handleDownloadJson} className="gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <div className="flex flex-col">
                    <span>Download JSON File</span>
                    <span className="text-xs text-muted-foreground">Save to disk, share, re-import</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          {/* Undo/Redo Buttons */}
          <div className="flex items-center border-l border-zinc-700 pl-2 ml-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn(
                    "h-8 w-8",
                    canUndo ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-600 cursor-not-allowed"
                  )}
                  onClick={undo}
                  disabled={!canUndo}
                >
                  <Undo2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn(
                    "h-8 w-8",
                    canRedo ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-600 cursor-not-allowed"
                  )}
                  onClick={redo}
                  disabled={!canRedo}
                >
                  <Redo2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
            </Tooltip>
          </div>

          {/* Clear Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-zinc-400 hover:text-red-400"
                onClick={() => {
                  if (data.questions.length > 0 || data.sections.length > 0) {
                    if (confirm("Are you sure you want to clear the entire poll? This action can be undone with Ctrl+Z.")) {
                      clearBuilder();
                    }
                  } else {
                    clearBuilder();
                  }
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear all content</TooltipContent>
          </Tooltip>

          {/* Load Example Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200">
                <Sparkles className="w-4 h-4 mr-2" />
                Examples
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700">
              <DropdownMenuItem onClick={loadVerifyDemoTemplate} className="gap-2">
                <FlaskConical className="h-4 w-4 text-emerald-400" />
                Verify Poll Demo
                <span className="text-[10px] text-zinc-500 ml-auto">Test all types</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={loadREACHTemplate} className="gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                Feedback & Discovery
                <span className="text-[10px] text-zinc-500 ml-auto">Hybrid poll</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={loadFeatureExplorerTemplate} className="gap-2">
                <FlaskConical className="h-4 w-4 text-amber-400" />
                Feature Explorer Quiz
                <span className="text-[10px] text-zinc-500 ml-auto">Scored quiz</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={loadCannaCocoTemplate} className="gap-2">
                <FlaskConical className="h-4 w-4 text-green-400" />
                Canna Coco Mastery
                <span className="text-[10px] text-zinc-500 ml-auto">22Q grow quiz</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-700" />
              <DropdownMenuItem 
                onClick={() => {
                  setData({
                    title: "Quick Feedback Survey",
                    description: "A simple feedback form",
                    type: "SURVEY",
                    allowPartialSubmission: true,
                    showProgressBar: true,
                    randomizeQuestions: false,
                    expiresAt: undefined,
                    flow: [{ type: 'QUESTION', id: 'q1' }, { type: 'QUESTION', id: 'q2' }],
                    sections: [],
                    questions: [
                      { id: 'q1', type: 'SCALE', questionText: 'How satisfied are you with our service?', required: true, allowImages: false, options: [] },
                      { id: 'q2', type: 'TEXT', questionText: 'Any additional feedback?', required: false, allowImages: false, options: [] },
                    ],
                  });
                  toast.success("Loaded Quick Feedback template!");
                }} 
                className="gap-2"
              >
                <FileText className="h-4 w-4 text-blue-400" />
                Quick Feedback
                <span className="text-[10px] text-zinc-500 ml-auto">Simple</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => {
                  setData({
                    title: "Product Preference Survey",
                    description: "Help us understand your preferences",
                    type: "SURVEY",
                    allowPartialSubmission: false,
                    showProgressBar: true,
                    randomizeQuestions: false,
                    expiresAt: undefined,
                    flow: [{ type: 'QUESTION', id: 'p1' }, { type: 'QUESTION', id: 'p2' }, { type: 'QUESTION', id: 'p3' }],
                    sections: [],
                    questions: [
                      { id: 'p1', type: 'SINGLE_CHOICE', questionText: 'Which product category interests you most?', required: true, allowImages: false, options: [{ id: 'o1', text: 'Electronics' }, { id: 'o2', text: 'Fashion' }, { id: 'o3', text: 'Home & Garden' }, { id: 'o4', text: 'Sports' }] },
                      { id: 'p2', type: 'MULTI_CHOICE', questionText: 'What factors influence your purchase decisions?', required: true, allowImages: false, options: [{ id: 'o5', text: 'Price' }, { id: 'o6', text: 'Quality' }, { id: 'o7', text: 'Brand' }, { id: 'o8', text: 'Reviews' }, { id: 'o9', text: 'Sustainability' }] },
                      { id: 'p3', type: 'SLIDER', questionText: 'Rate your shopping experience', required: false, allowImages: false, options: [], sliderConfig: { min: 1, max: 7, step: 1, minLabel: 'Poor', maxLabel: 'Excellent', showValue: true } },
                    ],
                  });
                  toast.success("Loaded Product Preference template!");
                }} 
                className="gap-2"
              >
                <LayoutGrid className="h-4 w-4 text-green-400" />
                Product Preference
                <span className="text-[10px] text-zinc-500 ml-auto">Poll</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>

          <Button 
            variant="ghost"
            size="sm"
            className={showPreview ? "text-primary" : "text-zinc-400 hover:text-zinc-200"}
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="w-4 h-4 mr-2" />
            {showPreview ? "Hide Preview" : "Preview"}
          </Button>

          <Button onClick={handleSave} disabled={isSaving} size="sm" className="bg-primary hover:bg-primary/90">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Poll
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Poll Settings */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-lg bg-zinc-900/50 space-y-4">
              <h3 className="font-medium text-zinc-200">Poll Settings</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-400">Poll Type</Label>
                  <Select
                    value={data.type}
                    onValueChange={(v) => setData((d) => ({ ...d, type: v as PollType }))}
                  >
                    <SelectTrigger className="bg-zinc-800/50 border-zinc-700/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      <SelectItem value="SIMPLE">Simple Poll</SelectItem>
                      <SelectItem value="SURVEY">Survey</SelectItem>
                      <SelectItem value="QUIZ">Quiz</SelectItem>
                      <SelectItem value="FEEDBACK">Feedback</SelectItem>
                      <SelectItem value="REACH_ASSESSMENT">Reach Assessment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-400">Expires At (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={data.expiresAt || ""}
                    onChange={(e) =>
                      setData((d) => ({ ...d, expiresAt: e.target.value || undefined }))
                    }
                    className="bg-zinc-800/50 border-zinc-700/50"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="partial"
                    checked={data.allowPartialSubmission}
                    onCheckedChange={(v) =>
                      setData((d) => ({ ...d, allowPartialSubmission: v }))
                    }
                  />
                  <Label htmlFor="partial" className="text-zinc-400">Allow partial submission</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="progress"
                    checked={data.showProgressBar}
                    onCheckedChange={(v) => setData((d) => ({ ...d, showProgressBar: v }))}
                  />
                  <Label htmlFor="progress" className="text-zinc-400">Show progress bar</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="random"
                    checked={data.randomizeQuestions}
                    onCheckedChange={(v) =>
                      setData((d) => ({ ...d, randomizeQuestions: v }))
                    }
                  />
                  <Label htmlFor="random" className="text-zinc-400">Randomize questions</Label>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Preview Panel */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-lg bg-gradient-to-br from-violet-500/5 to-indigo-500/5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Live Preview
                </h3>
                <span className="text-xs text-muted-foreground">
                  This is how your poll will appear in the flow
                </span>
              </div>
              
              {/* Poll Card Preview */}
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden max-w-md mx-auto">
                <div className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                        V
                      </div>
                      <div>
                        <p className="font-semibold text-sm">VeggaStare</p>
                        <p className="text-xs text-muted-foreground">Just now</p>
                      </div>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium",
                      data.type === "SURVEY" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
                      data.type === "QUIZ" && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
                      data.type === "FEEDBACK" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                      data.type === "REACH_ASSESSMENT" && "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
                      data.type === "SIMPLE" && "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
                    )}>
                      {data.type === "REACH_ASSESSMENT" ? "REACH" : data.type}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-semibold text-base">
                      {data.title || "Untitled Poll"}
                    </h3>
                    {data.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {data.description}
                      </p>
                    )}
                  </div>

                  {/* Questions Preview */}
                  <div className="space-y-2 py-2">
                    {data.questions.slice(0, 3).map((q, idx) => (
                      <div 
                        key={q.id} 
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        <span className="truncate">
                          {q.questionText || `Question ${idx + 1}`}
                        </span>
                        {q.type === "SLIDER" && <Sliders className="w-3 h-3 shrink-0" />}
                        {(q.type === "SINGLE_CHOICE" || q.type === "MULTI_CHOICE") && <List className="w-3 h-3 shrink-0" />}
                        {q.type === "TEXT" && <Type className="w-3 h-3 shrink-0" />}
                        {q.type === "SCALE" && <Hash className="w-3 h-3 shrink-0" />}
                      </div>
                    ))}
                    {data.questions.length > 3 && (
                      <p className="text-xs text-muted-foreground pl-7">
                        +{data.questions.length - 3} more questions
                      </p>
                    )}
                    {data.questions.length === 0 && (
                      <p className="text-sm text-muted-foreground italic text-center py-4">
                        Add questions to see the preview
                      </p>
                    )}
                  </div>

                  {/* Stats Bar */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{data.questions.length} questions</span>
                      <span>~{Math.max(1, data.questions.length * 30)} sec</span>
                    </div>
                    <Button size="sm" className="h-8 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white">
                      Take Poll
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Basic Info */}
      <div className="space-y-4 p-4 rounded-lg bg-zinc-900/50">
        <div className="space-y-2">
          <Label className="text-zinc-400">Poll Title *</Label>
          <Input
            value={data.title}
            onChange={(e) => setData((d) => ({ ...d, title: e.target.value }))}
            placeholder="Enter poll title..."
            className="bg-zinc-800/50 border-zinc-700/50 focus:border-zinc-600 text-zinc-100"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-zinc-400">Description</Label>
          <Textarea
            value={data.description}
            onChange={(e) => setData((d) => ({ ...d, description: e.target.value }))}
            placeholder="Optional description..."
            className="min-h-[80px] bg-zinc-800/50 border-zinc-700/50 focus:border-zinc-600 text-zinc-100"
          />
        </div>
      </div>

      {/* Builder */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Tooltip>
            <TooltipTrigger asChild>
              <h3 className="font-medium flex items-center gap-2 text-zinc-200 cursor-help">
                <FolderOpen className="h-4 w-4 text-zinc-500" />
                Builder ({data.flow.length})
                {data.flow.length > 0 && (
                  <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                    <GripVertical className="h-2.5 w-2.5" />
                    Drag to reorder
                  </span>
                )}
              </h3>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div>{data.flow.filter(f => f.type === 'SECTION').length} section{data.flow.filter(f => f.type === 'SECTION').length !== 1 ? 's' : ''}</div>
                <div>{data.flow.filter(f => f.type === 'QUESTION').length} question{data.flow.filter(f => f.type === 'QUESTION').length !== 1 ? 's' : ''}</div>
              </div>
            </TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-1">
            {/* Show target indicator when section is selected */}
            {selectedElementType === 'section' && selectedElementId && (
              <div className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 mr-1">
                <span>â†’</span>
                <span className="max-w-[100px] truncate">
                  {sectionsById.get(selectedElementId)?.title || 'Section'}
                </span>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-1 text-zinc-400 hover:text-zinc-200",
                    selectedElementType === 'section' && "text-amber-400 hover:text-amber-300"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Plus className="h-4 w-4" />
                  Add Question
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700">
                <DropdownMenuItem onClick={() => addQuestion("SINGLE_CHOICE")} className="gap-2">
                  <List className="h-4 w-4" /> Single Choice
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addQuestion("MULTI_CHOICE")} className="gap-2">
                  <List className="h-4 w-4" /> Multiple Choice
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-700" />
                <DropdownMenuItem onClick={() => addQuestion("SLIDER")} className="gap-2">
                  <Sliders className="h-4 w-4" /> Slider (A-G)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addQuestion("SCALE")} className="gap-2">
                  <Hash className="h-4 w-4" /> Scale (1-10)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addQuestion("TEXT")} className="gap-2">
                  <Type className="h-4 w-4" /> Text Response
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-700" />
                <DropdownMenuItem onClick={() => addQuestion("RANKING")} className="gap-2">
                  <GripVertical className="h-4 w-4" /> Ranking
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addQuestion("SHAPE_MATCH")} className="gap-2">
                  <Shapes className="h-4 w-4" /> Shape Match
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addQuestion("UI_ARRANGE")} className="gap-2">
                  <LayoutGrid className="h-4 w-4" /> UI Arrange
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addQuestion("NESTED")} className="gap-2">
                  <GitBranch className="h-4 w-4" /> Nested/Conditional
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                addSection();
              }}
              className={cn(
                "gap-1 text-zinc-400 hover:text-zinc-200",
                selectedElementType === 'section' && "text-amber-400 hover:text-amber-300"
              )}
            >
              <FolderPlus className="h-4 w-4" />
              Add Section
            </Button>
          </div>
        </div>

        {data.flow.length === 0 ? (
          <div
            data-gap-drop-target="0"
            className={cn(
              "py-8 text-center border border-dashed rounded-lg transition-all duration-200",
              (draggingQuestionId || draggingSectionId)
                ? dropTargetSectionId === 'gap-0'
                  ? "border-primary bg-primary/20"
                  : "border-primary/50 bg-primary/5"
                : "border-zinc-700/50"
            )}
            onMouseEnter={() => (draggingQuestionId || draggingSectionId) && setDropTargetSectionId('gap-0')}
            onMouseLeave={() => {
              if (dropTargetSectionId === 'gap-0') setDropTargetSectionId(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDropTargetSectionId('gap-0');
            }}
            onDragLeave={() => {
              if (dropTargetSectionId === 'gap-0') setDropTargetSectionId(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const sectionId = e.dataTransfer.getData("sectionId");
              if (sectionId) {
                addSectionToTopFlow(sectionId, 0);
                toast.success("Section added to Builder!");
              }
              setDropTargetSectionId(null);
              setDraggingSectionId(null);
              setDragSource(null);
            }}
          >
            {(draggingQuestionId || draggingSectionId) ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm text-primary font-medium">
                  {draggingSectionId ? "Drop section here to add to Builder" : "Drop question here to add to Builder"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                No items yet. Use the buttons above to add questions and sections.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Top-level drop zone - appears when dragging questions FROM A SECTION */}
            {draggingQuestionId && draggingFromSectionId && (
              <div
                data-toplevel-drop-target
                className={cn(
                  "mb-3 p-3 rounded-lg border-2 border-dashed transition-all",
                  dropTargetTopLevel
                    ? "bg-amber-500/20 border-amber-500 scale-[1.02]"
                    : "bg-zinc-800/30 border-zinc-600 hover:border-amber-500/50"
                )}
              >
                <div className="flex items-center justify-center gap-2">
                  <ChevronUp className={cn(
                    "h-4 w-4",
                    dropTargetTopLevel ? "text-amber-400" : "text-zinc-500"
                  )} />
                  <span className={cn(
                    "text-sm font-medium",
                    dropTargetTopLevel ? "text-amber-400" : "text-zinc-500"
                  )}>
                    {dropTargetTopLevel ? "Release to move to top-level" : "Drop here for top-level"}
                  </span>
                </div>
              </div>
            )}
            {/* Section dragging info banner */}
            {draggingSectionId && (
              <div className={cn(
                "mb-3 p-2 rounded-lg flex items-center justify-center gap-2",
                mergeSectionTarget 
                  ? "bg-purple-600/20 border border-purple-500/50" 
                  : "bg-blue-600/20 border border-blue-500/50"
              )}>
                {mergeSectionTarget ? (
                  <>
                    <FolderPlus className="h-4 w-4 text-purple-400" />
                    <span className="text-sm text-purple-300">
                      Drop onto another section to merge as sub-section
                    </span>
                  </>
                ) : (
                  <>
                    <ArrowUpDown className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-blue-300">
                      Drag to reorder, or drop onto another section to merge
                    </span>
                  </>
                )}
              </div>
            )}
            <Reorder.Group
              axis="y"
              values={data.flow.map(item => item.id)}
              onReorder={(newOrder) => {
                // Don't reorder if we're about to drop into a section or top-level zone
                if (dropTargetSectionId || dropTargetTopLevel) return;
                // Don't reorder if we're about to merge sections
                if (mergeSectionTarget) return;
                reorderTopLevelFlow(newOrder);
              }}
              className="space-y-2"
            >
            {data.flow.map((flowItem, index) => {
              if (flowItem.type === 'SECTION') {
                const section = sectionsById.get(flowItem.id);
                if (!section) return null;
                // Disable layout animation for target sections when another section is being dragged
                const isBeingMergedOnto = mergeSectionTarget === section.id && draggingSectionId !== section.id;
                const otherSectionDragging = draggingSectionId && draggingSectionId !== section.id;
                return (
                  <Reorder.Item
                    key={section.id}
                    value={section.id}
                    data-section-id={section.id}
                    data-section-merge-target
                    layout={otherSectionDragging ? "position" : true}
                    className={cn(
                      "cursor-grab active:cursor-grabbing relative",
                      // Highlight as merge target when another section is dragged over this one
                      isBeingMergedOnto && "ring-2 ring-purple-500 ring-offset-2 ring-offset-zinc-900 rounded-lg"
                    )}
                    whileDrag={{
                      scale: 1.02,
                      boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                      zIndex: 100,
                    }}
                    onDragStart={() => setDraggingSectionId(section.id)}
                    onDrag={(e, info) => {
                      // Detect if we're hovering over another section for merging
                      // Use a larger search area by checking multiple points
                      const points = [
                        { x: info.point.x, y: info.point.y },
                        { x: info.point.x - 50, y: info.point.y },
                        { x: info.point.x + 50, y: info.point.y },
                        { x: info.point.x, y: info.point.y - 30 },
                        { x: info.point.x, y: info.point.y + 30 },
                      ];
                      
                      for (const point of points) {
                        const elements = document.elementsFromPoint(point.x, point.y);
                        for (const el of elements) {
                          // Walk up the DOM tree to find section containers
                          let current: HTMLElement | null = el as HTMLElement;
                          while (current) {
                            const targetId = current.getAttribute?.("data-section-id");
                            if (targetId && targetId !== section.id && current.hasAttribute("data-section-merge-target")) {
                              if (mergeSectionTarget !== targetId) {
                                setMergeSectionTarget(targetId);
                              }
                              return;
                            }
                            current = current.parentElement;
                          }
                        }
                      }
                      if (mergeSectionTarget) setMergeSectionTarget(null);
                    }}
                    onDragEnd={() => {
                      // Check if we should merge
                      if (mergeSectionTarget && mergeSectionTarget !== section.id) {
                        mergeSectionIntoSection(section.id, mergeSectionTarget);
                      }
                      setDraggingSectionId(null);
                      setMergeSectionTarget(null);
                    }}
                  >
                    {/* Section drag indicator - shows when this section is being dragged */}
                    {draggingSectionId === section.id && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-[101] bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1">
                        <ArrowUpDown className="w-3 h-3" />
                        {mergeSectionTarget ? "Drop to merge" : "Reorder only"}
                      </div>
                    )}
                    {/* Merge target indicator */}
                    {mergeSectionTarget === section.id && draggingSectionId !== section.id && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-[101] bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1">
                        <FolderPlus className="w-3 h-3" />
                        Drop to make sub-section
                      </div>
                    )}
                    <SectionItem
                      section={section}
                      sections={data.sections}
                      questions={data.questions}
                      isExpanded={expandedSections.has(section.id)}
                      onToggleExpand={() => toggleSectionExpand(section.id)}
                      onUpdate={(updates) => updateSection(section.id, updates)}
                      onRemove={(removeQuestions) => removeSection(section.id, removeQuestions)}
                      onMove={(direction) => moveSection(section.id, direction)}
                      onAddSubsection={() => addSection(section.id)}
                      onAssignQuestion={assignQuestionToSection}
                      onReorderQuestions={reorderQuestionsInSection}
                      index={index}
                      isFirst={index === 0}
                      isLast={index === data.flow.length - 1}
                      depth={0}
                      expandedSections={expandedSections}
                      toggleSectionExpand={toggleSectionExpand}
                      updateSection={updateSection}
                      removeSection={removeSection}
                      moveSection={moveSection}
                      addSection={addSection}
                      removeSectionFromFlow={removeSectionFromFlow}
                      draggingQuestionId={draggingQuestionId}
                      setDraggingQuestionId={setDraggingQuestionId}
                      setDraggingFromSectionId={setDraggingFromSectionId}
                      dropTargetSectionId={dropTargetSectionId}
                      setDropTargetSectionId={setDropTargetSectionId}
                      onDropOnSection={handleDropOnSection}
                      dropMode={dropMode}
                      updateQuestion={updateQuestion}
                      removeQuestion={removeQuestion}
                      addOption={addOption}
                      removeOption={removeOption}
                      updateOption={updateOption}
                      expandedQuestions={expandedQuestions}
                      setExpandedQuestion={setExpandedQuestion}
                      sectionsById={sectionsById}
                      questionsById={questionsById}
                      checkDropZoneForSectionQuestion={checkDropZoneForSectionQuestion}
                      onSectionQuestionDropComplete={handleSectionQuestionDrop}
                      selectedElementId={selectedElementId}
                      multiSelectedIds={multiSelectedIds}
                      onElementSelect={handleElementSelect}
                      onMoveToTopLevel={moveSectionToTopLevel}
                      multiSelectedInputs={multiSelectedInputs}
                      syncedInputValue={syncedInputValue}
                      onInputMultiSelect={handleInputMultiSelect}
                      onSyncedInputChange={handleSyncedInputChange}
                    />
                  </Reorder.Item>
                );
              } else {
                // Question in top-level flow
                const question = questionsById.get(flowItem.id);
                if (!question) return null;
                return (
                  <TopLevelQuestionReorderItem
                    key={question.id}
                    question={question}
                    index={index}
                    draggingSectionId={draggingSectionId}
                    isThisExpanded={expandedQuestions.has(question.id)}
                    onToggleExpand={() => setExpandedQuestion(question.id)}
                    onDragStart={() => {
                      setDraggingQuestionId(question.id);
                      setDraggingFromSectionId(null);
                    }}
                    onDragEnd={() => setDraggingQuestionId(null)}
                    updateQuestion={updateQuestion}
                    removeQuestion={removeQuestion}
                    addOption={addOption}
                    removeOption={removeOption}
                    updateOption={updateOption}
                    assignQuestionToSection={assignQuestionToSection}
                    sections={data.sections}
                    multiSelectedInputs={multiSelectedInputs}
                    syncedInputValue={syncedInputValue}
                    handleInputMultiSelect={handleInputMultiSelect}
                    handleSyncedInputChange={handleSyncedInputChange}
                  />
                );
              }
            })}
          </Reorder.Group>
          </>
        )}
      </div>

      {/* Import Modal */}
      <PollImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImport={handleImportFromModal}
      />

      {/* Shape Match Visual Builder Modal */}
      {shapeBuilderQuestionId && (
        <ShapeMatchVisualBuilder
          config={questionsById.get(shapeBuilderQuestionId)?.shapeMatchConfig ?? undefined}
          onSave={(config) => {
            updateQuestion(shapeBuilderQuestionId, {
              shapeMatchConfig: config,
              shapeMatchPreset: undefined, // Clear preset when using custom config
            });
            setShapeBuilderQuestionId(null);
            toast.success("Shape match configuration saved!");
          }}
          onClose={() => setShapeBuilderQuestionId(null)}
        />
      )}
    </div>
    </TooltipProvider>
  );
}

export default PollBuilder;
