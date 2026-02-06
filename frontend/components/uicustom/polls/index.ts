// Enhanced Poll Components - Export Index
// Created for improved navigation, comments, and results display

// ─── Core Components ──────────────────────────────────────────────────────────

// Navigation Bar - Draggable taskbar-style navigation
export { 
  PollNavigationBar, 
  type BarPosition 
} from "./PollNavigationBar";

// Results Display - Charts, text aggregation, public/realtime options
export { 
  PollResultsDisplay,
  type DisplayMode,
  type ChoiceResponse,
  type SliderResponse,
  type TextResponse,
  type QuestionResult,
  type SectionResult,
  type PollResultsProps,
} from "./PollResultsDisplay";

// Comment Button - Prominent + icon for adding comments
export { 
  QuestionCommentButton,
  InlineCommentButton,
  FloatingCommentButton,
} from "./QuestionCommentButton";

// Enhanced Wrapper - Integrates all features
export { 
  EnhancedPollWrapper,
  type EnhancedPollWrapperProps,
} from "./EnhancedPollWrapper";

// ─── Existing Components ──────────────────────────────────────────────────────

// Re-export existing poll components for convenience
export { default as AdvancedPollDisplay } from "./AdvancedPollDisplay";
export { default as ReachPollV3 } from "./ReachPollV3";
export { default as SliderQuestion } from "./SliderQuestion";
export { default as ChoiceQuestion } from "./ChoiceQuestion";
export { default as ImagePasteInput } from "./ImagePasteInput";

// Interactive components
export { DragToSort } from "./interactive/DragToSort";
export { DragToZone } from "./interactive/DragToZone";
export { VisualSlider } from "./interactive/VisualSlider";
export { WeightAdjuster } from "./interactive/WeightAdjuster";
export { BranchingChoice } from "./interactive/BranchingChoice";
