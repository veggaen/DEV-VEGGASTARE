"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Upload,
  FileText,
  FileUp,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  ChevronRight,
  X,
  Eye,
  Download,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─────────────────────────────────────────────────────────────────────────────
// POLL IMPORT SYSTEM
// Import polls from: Text paste, File upload, JSON, Templates
// ─────────────────────────────────────────────────────────────────────────────

// Types matching the poll system
export interface ImportedQuestion {
  id: string;
  text: string;
  type: "choice" | "multi-choice" | "text" | "slider" | "scale" | "ranking" | "shape-match";
  description?: string;
  required?: boolean;
  options?: { id: string; text: string; value?: number }[];
  sliderConfig?: { 
    min: number; 
    max: number; 
    step?: number; 
    unit?: string;
    minLabel?: string;
    maxLabel?: string;
    stepLabels?: string[];
  };
  scaleConfig?: { 
    min: number; 
    max: number; 
    minLabel?: string; 
    maxLabel?: string;
  };
  // Quiz mode fields
  correctAnswer?: string | string[] | null;  // optionId(s) or correct ranking order
  explanation?: string | null;               // Why this is correct
  wrongExplanation?: string | null;          // Why they got it wrong
  deepExplanation?: string | null;           // Optional second-layer clarification
  commitRequired?: boolean;                  // Require "Lock In" before feedback
  trickQuestion?: boolean;                   // Is this a trick question
  shapeMatchPreset?: string | null;          // Shape match preset ID
  shapeMatchConfig?: any | null;             // Custom shape match visual builder config
}

export interface ImportedSection {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  flow?: { type: string; id: string }[];
}

export interface ImportedPoll {
  title: string;
  description?: string;
  type: string; // Accept any poll type
  questions: ImportedQuestion[];
  sections?: ImportedSection[];
  flow?: { type: string; id: string }[];
  settings?: {
    allowPartialSubmission?: boolean;
    showProgressBar?: boolean;
    randomizeQuestions?: boolean;
  };
}

interface PollImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (poll: ImportedPoll) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSING LOGIC
// ─────────────────────────────────────────────────────────────────────────────

interface ParseResult {
  success: boolean;
  poll?: ImportedPoll;
  error?: string;
  warnings?: string[];
}

/**
 * Parse plain text into poll questions
 * Supports formats:
 * - Numbered questions: "1. Question text"
 * - With options: "a) Option" or "- Option"
 * - With type hints: "[slider]", "[choice]", etc.
 */
function parseTextFormat(text: string): ParseResult {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { success: false, error: "No content to parse" };
  }

  const questions: ImportedQuestion[] = [];
  const warnings: string[] = [];
  let currentQuestion: Partial<ImportedQuestion> | null = null;
  let title = "";

  // Check if first line is a title
  if (!lines[0].match(/^\d+[\.\)]/)) {
    title = lines[0];
    lines.shift();
  }

  for (const line of lines) {
    // Check for question start (numbered)
    const questionMatch = line.match(/^(\d+)[\.\)]\s*(.+)/);
    if (questionMatch) {
      // Save previous question
      if (currentQuestion?.text) {
        questions.push(currentQuestion as ImportedQuestion);
      }

      // Parse type hint
      let type: ImportedQuestion["type"] = "text";
      let questionText = questionMatch[2];

      const typeHint = questionText.match(/\[(slider|choice|multi-choice|text|scale|ranking)\]/i);
      if (typeHint) {
        type = typeHint[1].toLowerCase() as ImportedQuestion["type"];
        questionText = questionText.replace(typeHint[0], "").trim();
      }

      currentQuestion = {
        id: `q-${questions.length + 1}`,
        text: questionText,
        type,
        required: questionText.includes("*") || questionText.includes("(required)"),
        options: [],
      };

      // Clean up markers
      if (currentQuestion.text) {
        currentQuestion.text = currentQuestion.text
          .replace("*", "")
          .replace("(required)", "")
          .trim();
      }

      continue;
    }

    // Check for option (a), b), -, or •)
    const optionMatch = line.match(/^([a-z][\.\)]|\-|\•|\*)\s*(.+)/i);
    if (optionMatch && currentQuestion) {
      const optionText = optionMatch[2].trim();
      if (!currentQuestion.options) currentQuestion.options = [];
      
      currentQuestion.options.push({
        id: `opt-${currentQuestion.options.length + 1}`,
        text: optionText,
      });

      // If we found options, it's a choice question
      if (currentQuestion.type === "text" && currentQuestion.options.length >= 2) {
        currentQuestion.type = "choice";
      }

      continue;
    }

    // Check for slider config: "Range: 1-10" or "Min: 1, Max: 10"
    const rangeMatch = line.match(/(?:range|min|scale):\s*(\d+)\s*[-–to]+\s*(\d+)/i);
    if (rangeMatch && currentQuestion) {
      const min = parseInt(rangeMatch[1]);
      const max = parseInt(rangeMatch[2]);
      if (currentQuestion.type === "slider") {
        currentQuestion.sliderConfig = { min, max, step: 1 };
      } else {
        currentQuestion.scaleConfig = { min, max };
      }
      continue;
    }

    // If it's just text after a question, might be a description
    if (currentQuestion && !line.match(/^[a-z\d][\.\)]/i)) {
      if (!currentQuestion.description) {
        currentQuestion.description = line;
      }
    }
  }

  // Save last question
  if (currentQuestion?.text) {
    questions.push(currentQuestion as ImportedQuestion);
  }

  if (questions.length === 0) {
    return {
      success: false,
      error: "Could not parse any questions. Use format:\n1. Question text\na) Option 1\nb) Option 2",
    };
  }

  return {
    success: true,
    poll: {
      title: title || "Imported Poll",
      type: "SURVEY",
      questions,
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Parse JSON format - supports multiple structures including VeggaStare v2.0 flow format
 */
function parseJSONFormat(text: string): ParseResult {
  try {
    const data = JSON.parse(text);

    // Helper to normalize slider/scale config
    const normalizeSliderConfig = (config: any) => {
      if (!config) return undefined;
      return {
        min: config.min ?? config.minValue ?? 1,
        max: config.max ?? config.maxValue ?? 10,
        step: config.step ?? 1,
        unit: config.unit,
        minLabel: config.minLabel,
        maxLabel: config.maxLabel,
        stepLabels: config.stepLabels,
      };
    };

    // Helper to normalize a question from any format
    const normalizeQuestion = (q: any, i: number): ImportedQuestion => {
      const type = mapQuestionType(q.type);
      const sliderConfig = normalizeSliderConfig(q.sliderConfig || q.slider);
      
      return {
        id: q.id || `q-${i + 1}`,
        text: q.text || q.questionText || q.question || q.title || "",
        type,
        description: q.description || q.hint,
        required: q.required ?? true,
        options: q.options?.map((o: any, j: number) => ({
          id: typeof o === "string" ? `opt-${j + 1}` : o.id || `opt-${j + 1}`,
          text: typeof o === "string" ? o : o.text || o.label || "",
          value: typeof o === "object" ? o.value : undefined,
        })),
        sliderConfig: type === "slider" ? sliderConfig : undefined,
        scaleConfig: type === "scale" ? {
          min: sliderConfig?.min ?? 1,
          max: sliderConfig?.max ?? 10,
          minLabel: sliderConfig?.minLabel,
          maxLabel: sliderConfig?.maxLabel,
        } : undefined,
        // Quiz mode fields — preserve when present
        correctAnswer: q.correctAnswer ?? undefined,
        explanation: q.explanation ?? undefined,
        wrongExplanation: q.wrongExplanation ?? undefined,
        deepExplanation: q.deepExplanation ?? undefined,
        commitRequired: q.commitRequired,
        trickQuestion: q.trickQuestion,
        shapeMatchPreset: q.shapeMatchPreset ?? undefined,
      };
    };

    // Detect VeggaStare v2.0 flow format
    if (data._format === "veggastare-poll-flow" && data.questions) {
      return {
        success: true,
        poll: {
          title: data.title || "Imported Poll",
          description: data.description,
          type: data.type || "SURVEY",
          questions: data.questions.map(normalizeQuestion),
          sections: data.sections?.map((s: any) => ({
            id: s.id,
            title: s.title,
            description: s.description,
            icon: s.icon,
            flow: s.flow,
          })),
          flow: data.flow,
          settings: {
            allowPartialSubmission: data.allowPartialSubmission,
            showProgressBar: data.showProgressBar,
            randomizeQuestions: data.randomizeQuestions,
          },
        },
      };
    }

    // Support array of questions
    if (Array.isArray(data)) {
      return {
        success: true,
        poll: {
          title: "Imported Poll",
          type: "SURVEY",
          questions: data.map(normalizeQuestion),
        },
      };
    }

    // Poll object with questions array
    if (data.questions) {
      return {
        success: true,
        poll: {
          title: data.title || data.name || "Imported Poll",
          description: data.description,
          type: data.type || "SURVEY",
          questions: data.questions.map(normalizeQuestion),
        },
      };
    }

    return { success: false, error: "Invalid JSON structure. Expected array of questions or object with 'questions' property." };
  } catch (e) {
    return { success: false, error: "Invalid JSON: " + (e as Error).message };
  }
}

function mapQuestionType(type: string): ImportedQuestion["type"] {
  if (!type) return "text";
  
  const normalizedType = type.toLowerCase().replace(/_/g, "-");
  
  const typeMap: Record<string, ImportedQuestion["type"]> = {
    // VeggaStare uppercase formats
    "single-choice": "choice",
    "multi-choice": "multi-choice",
    "slider": "slider",
    "scale": "scale",
    "text": "text",
    "ranking": "ranking",
    "shape-match": "shape-match",
    "ui-arrange": "choice",
    "nested": "choice",
    // Generic formats
    "single": "choice",
    "radio": "choice",
    "select": "choice",
    "choice": "choice",
    "multiple": "multi-choice",
    "checkbox": "multi-choice",
    "multiselect": "multi-choice",
    "textarea": "text",
    "open": "text",
    "range": "slider",
    "rating": "scale",
    "rank": "ranking",
    "order": "ranking",
  };
  return typeMap[normalizedType] || "text";
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const POLL_TEMPLATES: { id: string; name: string; description: string; poll: ImportedPoll }[] = [
  {
    id: "verify-demo",
    name: "Verify Poll Demo",
    description: "Easy-to-verify test poll: slider→6, ranking→1st-4th, choice→Select me (2 sections)",
    poll: {
      title: "🧪 Verify Poll Demo — Test All Question Types",
      description: "Quick demo to verify poll UX. Each question has an obvious correct answer. Sign in to submit and see results.",
      type: "QUIZ",
      settings: { allowPartialSubmission: true, showProgressBar: true, randomizeQuestions: false },
      sections: [
        { id: "v-sec1", title: "Slider & Ranking", description: "Slide to 6", icon: "📊", flow: [{ type: "QUESTION", id: "v-slider" }, { type: "QUESTION", id: "v-ranking" }] },
        { id: "v-sec2", title: "Choice Questions", description: "Select me, select both", icon: "✓", flow: [{ type: "QUESTION", id: "v-single" }, { type: "QUESTION", id: "v-multi" }] },
      ],
      flow: [{ type: "SECTION", id: "v-sec1" }, { type: "SECTION", id: "v-sec2" }],
      questions: [
        {
          id: "v-slider",
          text: "Slide the slider to option 6",
          type: "slider",
          description: "The correct answer is 6",
          required: true,
          sliderConfig: {
            min: 1,
            max: 10,
            step: 1,
            minLabel: "1",
            maxLabel: "10",
            stepLabels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
          },
          correctAnswer: "6",
          explanation: "The correct answer is 6. The slider represents a scale from 1 to 10, and 6 is the target value for this question.",
          wrongExplanation: "You may have slid too low or too high. The correct position is 6 on the scale. Try again to build accuracy.",
        },
        {
          id: "v-ranking",
          text: "Arrange these 6 items in the correct order (lowest number at top and highest number at bottom)",
          type: "ranking",
          description: "Drag to reorder — 1st at top, 6th at bottom. Ascending order.",
          required: true,
          options: [
            { id: "v-r1", text: "Place me as top rank" },
            { id: "v-r2", text: "Put me at second" },
            { id: "v-r3", text: "Place me third" },
            { id: "v-r4", text: "Place me fourth" },
            { id: "v-r5", text: "Put me fifth" },
            { id: "v-r6", text: "Place me sixth" },
          ],
          correctAnswer: ["v-r1", "v-r2", "v-r3", "v-r4", "v-r5", "v-r6"],
          explanation: "The correct order is 1 to 6 in ascending order: 1st at the top, 6th at the bottom. This represents a priority or sequence where lower numbers rank higher.",
          wrongExplanation: "The items should be in ascending order from 1st to 6th. The first item (Place me as top rank) must be at the top, and the last (Place me sixth) at the bottom.",
        },
        {
          id: "v-single",
          text: "Select the correct option",
          type: "choice",
          description: "Choose 'Select me'",
          required: true,
          options: [
            { id: "v-s1", text: "Select me" },
            { id: "v-s2", text: "Don't select me" },
            { id: "v-s3", text: "Don't select me neither" },
          ],
          correctAnswer: "v-s1",
          explanation: "The first option 'Select me' is the correct one. In single-choice questions, only one answer can be correct.",
          wrongExplanation: "The correct option is 'Select me'. The other options are distractors. Read each option carefully before locking in.",
        },
        {
          id: "v-multi",
          text: "Select both correct options",
          type: "multi-choice",
          description: "Choose both 'Select me' options",
          required: true,
          options: [
            { id: "v-m1", text: "Select me (A)" },
            { id: "v-m2", text: "Select me (B)" },
            { id: "v-m3", text: "Don't select me" },
          ],
          correctAnswer: ["v-m1", "v-m2"],
          explanation: "Both 'Select me (A)' and 'Select me (B)' are correct. Multi-choice questions allow selecting multiple options — here you need both.",
          wrongExplanation: "You need to select both 'Select me (A)' and 'Select me (B)'. Multi-choice allows multiple selections — ensure you have checked both correct options.",
        },
      ],
    },
  },
  {
    id: "customer-satisfaction",
    name: "Customer Satisfaction (NPS)",
    description: "Standard NPS survey with follow-up questions",
    poll: {
      title: "Customer Satisfaction Survey",
      type: "FEEDBACK",
      questions: [
        {
          id: "nps",
          text: "How likely are you to recommend us to a friend or colleague?",
          type: "scale",
          scaleConfig: { min: 0, max: 10, minLabel: "Not likely", maxLabel: "Very likely" },
          required: true,
        },
        {
          id: "satisfaction",
          text: "Overall, how satisfied are you with our service?",
          type: "choice",
          options: [
            { id: "very-satisfied", text: "Very satisfied", value: 5 },
            { id: "satisfied", text: "Satisfied", value: 4 },
            { id: "neutral", text: "Neutral", value: 3 },
            { id: "dissatisfied", text: "Dissatisfied", value: 2 },
            { id: "very-dissatisfied", text: "Very dissatisfied", value: 1 },
          ],
        },
        {
          id: "feedback",
          text: "What could we do to improve your experience?",
          type: "text",
        },
      ],
    },
  },
  {
    id: "product-feedback",
    name: "Product Feedback",
    description: "Gather insights about product features and usability",
    poll: {
      title: "Product Feedback Survey",
      type: "SURVEY",
      questions: [
        {
          id: "features",
          text: "Which features do you use most often?",
          type: "multi-choice",
          options: [
            { id: "dashboard", text: "Dashboard" },
            { id: "reports", text: "Reports" },
            { id: "analytics", text: "Analytics" },
            { id: "integrations", text: "Integrations" },
            { id: "settings", text: "Settings" },
          ],
        },
        {
          id: "ease",
          text: "How easy is the product to use?",
          type: "slider",
          sliderConfig: { min: 1, max: 10, step: 1, unit: "/10" },
        },
        {
          id: "missing",
          text: "What features are you missing?",
          type: "text",
        },
      ],
    },
  },
  {
    id: "employee-engagement",
    name: "Employee Engagement",
    description: "Measure team morale and engagement",
    poll: {
      title: "Employee Engagement Survey",
      type: "SURVEY",
      questions: [
        {
          id: "recommend",
          text: "I would recommend this company as a great place to work",
          type: "scale",
          scaleConfig: { min: 1, max: 5, minLabel: "Strongly disagree", maxLabel: "Strongly agree" },
        },
        {
          id: "valued",
          text: "I feel valued for my contributions",
          type: "scale",
          scaleConfig: { min: 1, max: 5, minLabel: "Strongly disagree", maxLabel: "Strongly agree" },
        },
        {
          id: "growth",
          text: "There are opportunities for growth and development",
          type: "scale",
          scaleConfig: { min: 1, max: 5, minLabel: "Strongly disagree", maxLabel: "Strongly agree" },
        },
        {
          id: "suggestions",
          text: "What suggestions do you have to improve our workplace?",
          type: "text",
        },
      ],
    },
  },
  {
    id: "event-registration",
    name: "Event Registration",
    description: "Collect attendee information for events",
    poll: {
      title: "Event Registration",
      type: "SIMPLE",
      questions: [
        {
          id: "attendance",
          text: "Will you be attending the event?",
          type: "choice",
          required: true,
          options: [
            { id: "yes-person", text: "Yes, in person" },
            { id: "yes-virtual", text: "Yes, virtually" },
            { id: "maybe", text: "Maybe, undecided" },
            { id: "no", text: "No, cannot attend" },
          ],
        },
        {
          id: "dietary",
          text: "Do you have any dietary restrictions?",
          type: "multi-choice",
          options: [
            { id: "none", text: "None" },
            { id: "vegetarian", text: "Vegetarian" },
            { id: "vegan", text: "Vegan" },
            { id: "gluten-free", text: "Gluten-free" },
            { id: "other", text: "Other (please specify in comments)" },
          ],
        },
        {
          id: "topics",
          text: "Which topics are you most interested in?",
          type: "ranking",
          options: [
            { id: "keynote", text: "Keynote presentations" },
            { id: "workshops", text: "Hands-on workshops" },
            { id: "networking", text: "Networking sessions" },
            { id: "panels", text: "Panel discussions" },
          ],
        },
      ],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function PollPreview({ poll }: { poll: ImportedPoll }) {
  const hasSections = poll.sections && poll.sections.length > 0;
  
  return (
    <div className="space-y-4 max-h-[300px] overflow-y-auto p-4 bg-muted/30 rounded-lg">
      <div>
        <h4 className="font-semibold text-lg">{poll.title}</h4>
        {poll.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{poll.description}</p>
        )}
        <div className="flex gap-2 mt-1 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
            {poll.type}
          </span>
          {hasSections && (
            <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-500">
              {poll.sections!.length} sections
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-500">
            {poll.questions.length} questions
          </span>
        </div>
      </div>

      {/* Show sections if present */}
      {hasSections && (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-muted-foreground uppercase">Sections</h5>
          {poll.sections!.map((s) => (
            <div key={s.id} className="p-2 bg-background rounded border text-sm flex items-center gap-2">
              {s.icon && <span>{s.icon}</span>}
              <span className="font-medium">{s.title}</span>
              {s.flow && <span className="text-xs text-muted-foreground">({s.flow.length} items)</span>}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h5 className="text-xs font-semibold text-muted-foreground uppercase">Questions</h5>
        {poll.questions.map((q, i) => (
          <div key={q.id} className="p-3 bg-background rounded-lg border">
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{q.text}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded bg-muted">{q.type}</span>
                  {q.required && <span className="text-red-500">Required</span>}
                  {q.options && q.options.length > 0 && <span>{q.options.length} options</span>}
                  {q.sliderConfig && (
                    <span className="text-blue-400">
                      Range: {q.sliderConfig.min}-{q.sliderConfig.max}
                    </span>
                  )}
                  {q.scaleConfig && (
                    <span className="text-purple-400">
                      Scale: {q.scaleConfig.min}-{q.scaleConfig.max}
                    </span>
                  )}
                </div>
                {/* Show slider labels if present */}
                {(q.sliderConfig?.minLabel || q.sliderConfig?.maxLabel) && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {q.sliderConfig.minLabel && <span>Min: "{q.sliderConfig.minLabel}"</span>}
                    {q.sliderConfig.minLabel && q.sliderConfig.maxLabel && <span> → </span>}
                    {q.sliderConfig.maxLabel && <span>Max: "{q.sliderConfig.maxLabel}"</span>}
                  </div>
                )}
                {(q.scaleConfig?.minLabel || q.scaleConfig?.maxLabel) && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {q.scaleConfig.minLabel && <span>Min: "{q.scaleConfig.minLabel}"</span>}
                    {q.scaleConfig.minLabel && q.scaleConfig.maxLabel && <span> → </span>}
                    {q.scaleConfig.maxLabel && <span>Max: "{q.scaleConfig.maxLabel}"</span>}
                  </div>
                )}
                {q.options && q.options.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {q.options.slice(0, 4).map((opt) => (
                      <div key={opt.id} className="text-xs text-muted-foreground flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                        {opt.text}
                      </div>
                    ))}
                    {q.options.length > 4 && (
                      <div className="text-xs text-muted-foreground">
                        +{q.options.length - 4} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN MODAL
// ─────────────────────────────────────────────────────────────────────────────

export function PollImportModal({ open, onOpenChange, onImport }: PollImportModalProps) {
  const [activeTab, setActiveTab] = useState<"paste" | "upload" | "json" | "template">("paste");
  const [textInput, setTextInput] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoParseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-parse JSON as user types (debounced 400ms)
  useEffect(() => {
    if (activeTab !== "json" || !jsonInput.trim()) {
      return;
    }
    
    // Clear any pending parse
    if (autoParseTimerRef.current) {
      clearTimeout(autoParseTimerRef.current);
    }
    
    setIsProcessing(true);
    autoParseTimerRef.current = setTimeout(() => {
      const result = parseJSONFormat(jsonInput);
      setParseResult(result);
      setIsProcessing(false);
      autoParseTimerRef.current = null;
    }, 400);
    
    return () => {
      if (autoParseTimerRef.current) {
        clearTimeout(autoParseTimerRef.current);
      }
    };
  }, [jsonInput, activeTab]);

  const handlePaste = useCallback(() => {
    setIsProcessing(true);
    setTimeout(() => {
      const result = parseTextFormat(textInput);
      setParseResult(result);
      setIsProcessing(false);
    }, 300);
  }, [textInput]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      
      // Detect format
      let result: ParseResult;
      if (file.name.endsWith(".json")) {
        result = parseJSONFormat(content);
      } else {
        result = parseTextFormat(content);
      }
      
      setParseResult(result);
      setIsProcessing(false);
    };
    reader.onerror = () => {
      setParseResult({ success: false, error: "Failed to read file" });
      setIsProcessing(false);
    };
    reader.readAsText(file);
  }, []);

  const handleTemplateSelect = useCallback((templateId: string) => {
    const template = POLL_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setParseResult({ success: true, poll: template.poll });
    }
  }, []);

  const handleImport = useCallback(() => {
    if (parseResult?.poll) {
      onImport(parseResult.poll);
      onOpenChange(false);
      // Reset state
      setTextInput("");
      setJsonInput("");
      setParseResult(null);
      setSelectedTemplate(null);
    }
  }, [parseResult, onImport, onOpenChange]);

  const handleReset = useCallback(() => {
    setParseResult(null);
    setSelectedTemplate(null);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] overflow-hidden flex flex-col bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="w-5 h-5" />
            Import Poll
          </DialogTitle>
          <DialogDescription>
            Import questions from text, file, JSON, or choose a template
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); handleReset(); }} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4 shrink-0">
            <TabsTrigger value="paste" className="gap-1">
              <Copy className="w-4 h-4" />
              <span className="hidden sm:inline">Paste</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-1">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="json" className="gap-1">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">JSON</span>
            </TabsTrigger>
            <TabsTrigger value="template" className="gap-1">
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto mt-4">
            {/* Paste tab */}
            <TabsContent value="paste" className="mt-0 space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>Paste your questions in this format:</p>
                <pre className="mt-2 p-2 bg-muted rounded text-xs">
{`1. What is your favorite color? [choice]
a) Red
b) Blue
c) Green

2. Rate your experience [slider]
Range: 1-10

3. Any additional feedback?`}
                </pre>
              </div>
              <Textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Paste your questions here..."
                className="min-h-[200px] font-mono text-sm"
              />
              <Button onClick={handlePaste} disabled={!textInput.trim() || isProcessing}>
                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                Preview
              </Button>
            </TabsContent>

            {/* Upload tab */}
            <TabsContent value="upload" className="mt-0 space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                  "hover:border-primary hover:bg-primary/5"
                )}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="font-medium">Click to upload a file</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supports .txt, .json, .csv
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.json,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </TabsContent>

            {/* JSON tab */}
            <TabsContent value="json" className="mt-0 space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>Paste JSON in this format:</p>
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-[100px]">
{`{
  "title": "My Survey",
  "questions": [
    { "text": "Question 1", "type": "choice", "options": ["A", "B"] }
  ]
}`}
                </pre>
              </div>
              <Textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Paste JSON here..."
                className="min-h-[200px] font-mono text-sm"
              />
              {isProcessing && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Parsing...
                </div>
              )}
            </TabsContent>

            {/* Templates tab */}
            <TabsContent value="template" className="mt-0 space-y-3">
              {POLL_TEMPLATES.map((template) => (
                <motion.div
                  key={template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  className={cn(
                    "p-4 rounded-xl border cursor-pointer transition-all",
                    selectedTemplate === template.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50 hover:bg-muted/50"
                  )}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{template.name}</h4>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    </div>
                    <ChevronRight className={cn(
                      "w-5 h-5 transition-transform",
                      selectedTemplate === template.id && "rotate-90"
                    )} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {template.poll.questions.length} questions • {template.poll.type}
                  </div>
                </motion.div>
              ))}
            </TabsContent>
          </div>
        </Tabs>

        {/* Parse result / Preview */}
        <AnimatePresence>
          {parseResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t pt-4"
            >
              {parseResult.success && parseResult.poll ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-500">
                      <Check className="w-5 h-5" />
                      <span className="font-medium">
                        {parseResult.poll.questions.length} questions parsed
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleReset}>
                      <X className="w-4 h-4 mr-1" />
                      Reset
                    </Button>
                  </div>

                  {parseResult.warnings && parseResult.warnings.length > 0 && (
                    <div className="flex items-start gap-2 text-orange-500 text-sm">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        {parseResult.warnings.map((w, i) => (
                          <p key={i}>{w}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <PollPreview poll={parseResult.poll} />

                  <Button onClick={handleImport} className="w-full gap-2">
                    <Download className="w-4 h-4" />
                    Import {parseResult.poll.questions.length} Questions
                  </Button>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-red-500 p-3 bg-red-500/10 rounded-lg">
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Parse Error</p>
                    <p className="text-sm whitespace-pre-wrap">{parseResult.error}</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export default PollImportModal;
