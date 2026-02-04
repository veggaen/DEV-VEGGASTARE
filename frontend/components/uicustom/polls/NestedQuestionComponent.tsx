"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  CircleDot,
  CheckSquare,
  FileText,
  GitBranch,
  X,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

// ─────────────────────────────────────────────────────────────────────────────
// NESTED / CONDITIONAL QUESTION COMPONENT
// Supports "question-in-question" logic with branching paths
// ─────────────────────────────────────────────────────────────────────────────

export type NestedQuestionType = "choice" | "multi-choice" | "text" | "scale";

export interface QuestionOption {
  id: string;
  text: string;
  // If this option leads to a follow-up question
  followUp?: NestedQuestion;
  // If this option terminates this branch
  isFinal?: boolean;
  // Value for scoring/analysis
  value?: number;
}

export interface NestedQuestion {
  id: string;
  text: string;
  description?: string;
  type: NestedQuestionType;
  options?: QuestionOption[];
  required?: boolean;
  // For scale type
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  // Condition to show this question (parent option IDs that trigger it)
  showWhen?: string[];
  // Nested depth (for styling)
  depth?: number;
}

export interface NestedQuestionAnswer {
  questionId: string;
  questionText: string;
  answer: string | string[] | number;
  followUpAnswers?: NestedQuestionAnswer[];
}

export interface NestedQuestionResult {
  answers: NestedQuestionAnswer[];
  completionPath: string[]; // Trail of question IDs answered
  totalDepth: number;
  allAnswered: boolean;
}

interface NestedQuestionProps {
  question: NestedQuestion;
  value?: NestedQuestionResult;
  onChange: (result: NestedQuestionResult) => void;
  disabled?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE QUESTION RENDERER
// ─────────────────────────────────────────────────────────────────────────────

interface QuestionRendererProps {
  question: NestedQuestion;
  answer?: NestedQuestionAnswer;
  onAnswer: (answer: NestedQuestionAnswer) => void;
  disabled?: boolean;
  depth?: number;
}

function QuestionRenderer({
  question,
  answer,
  onAnswer,
  disabled = false,
  depth = 0,
}: QuestionRendererProps) {
  const [localAnswer, setLocalAnswer] = useState<string | string[] | number>(
    answer?.answer ?? (question.type === "multi-choice" ? [] : "")
  );
  const [followUpAnswer, setFollowUpAnswer] = useState<NestedQuestionAnswer | null>(
    answer?.followUpAnswers?.[0] ?? null
  );

  // Find if current answer triggers a follow-up
  const activeFollowUp = question.options?.find((opt) => {
    if (Array.isArray(localAnswer)) {
      return localAnswer.includes(opt.id) && opt.followUp;
    }
    return opt.id === localAnswer && opt.followUp;
  })?.followUp;

  const handleAnswerChange = useCallback(
    (value: string | string[] | number) => {
      setLocalAnswer(value);
      
      // Build answer object
      const newAnswer: NestedQuestionAnswer = {
        questionId: question.id,
        questionText: question.text,
        answer: value,
        followUpAnswers: followUpAnswer ? [followUpAnswer] : undefined,
      };
      onAnswer(newAnswer);
    },
    [question, followUpAnswer, onAnswer]
  );

  const handleFollowUpAnswer = useCallback(
    (fuAnswer: NestedQuestionAnswer) => {
      setFollowUpAnswer(fuAnswer);
      
      // Update parent with follow-up
      const newAnswer: NestedQuestionAnswer = {
        questionId: question.id,
        questionText: question.text,
        answer: localAnswer,
        followUpAnswers: [fuAnswer],
      };
      onAnswer(newAnswer);
    },
    [question, localAnswer, onAnswer]
  );

  const depthColors = [
    "border-l-blue-500",
    "border-l-green-500",
    "border-l-purple-500",
    "border-l-orange-500",
    "border-l-pink-500",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "space-y-4",
        depth > 0 && [
          "ml-4 pl-4 border-l-2",
          depthColors[depth % depthColors.length],
        ]
      )}
    >
      {/* Question header */}
      <div className="space-y-1">
        <div className="flex items-start gap-2">
          {depth > 0 && (
            <GitBranch className="w-4 h-4 mt-1 text-muted-foreground shrink-0" />
          )}
          <h4 className={cn("font-medium", depth === 0 && "text-lg")}>
            {question.text}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </h4>
        </div>
        {question.description && (
          <p className="text-sm text-muted-foreground">{question.description}</p>
        )}
      </div>

      {/* Choice question */}
      {question.type === "choice" && question.options && (
        <RadioGroup
          value={localAnswer as string}
          onValueChange={handleAnswerChange}
          disabled={disabled}
          className="space-y-2"
        >
          {question.options.map((option) => (
            <div key={option.id}>
              <Label
                htmlFor={`${question.id}-${option.id}`}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                  localAnswer === option.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50",
                  disabled && "opacity-60 cursor-not-allowed"
                )}
              >
                <RadioGroupItem
                  value={option.id}
                  id={`${question.id}-${option.id}`}
                />
                <span className="flex-1">{option.text}</span>
                {option.followUp && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {/* Multi-choice question */}
      {question.type === "multi-choice" && question.options && (
        <div className="space-y-2">
          {question.options.map((option) => {
            const isChecked = Array.isArray(localAnswer) && localAnswer.includes(option.id);
            return (
              <Label
                key={option.id}
                htmlFor={`${question.id}-${option.id}`}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                  isChecked
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50",
                  disabled && "opacity-60 cursor-not-allowed"
                )}
              >
                <Checkbox
                  id={`${question.id}-${option.id}`}
                  checked={isChecked}
                  disabled={disabled}
                  onCheckedChange={(checked) => {
                    const current = (localAnswer as string[]) || [];
                    const newValue = checked
                      ? [...current, option.id]
                      : current.filter((id) => id !== option.id);
                    handleAnswerChange(newValue);
                  }}
                />
                <span className="flex-1">{option.text}</span>
                {option.followUp && isChecked && (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </Label>
            );
          })}
        </div>
      )}

      {/* Text question */}
      {question.type === "text" && (
        <Textarea
          value={localAnswer as string}
          onChange={(e) => handleAnswerChange(e.target.value)}
          placeholder="Type your answer..."
          disabled={disabled}
          className="min-h-[100px]"
        />
      )}

      {/* Scale question */}
      {question.type === "scale" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{question.scaleMinLabel || question.scaleMin || 1}</span>
            <span>{question.scaleMaxLabel || question.scaleMax || 10}</span>
          </div>
          <div className="flex gap-2">
            {Array.from(
              { length: (question.scaleMax || 10) - (question.scaleMin || 1) + 1 },
              (_, i) => (question.scaleMin || 1) + i
            ).map((value) => (
              <button
                key={value}
                onClick={() => handleAnswerChange(value)}
                disabled={disabled}
                className={cn(
                  "flex-1 py-2 rounded-lg border text-sm font-medium transition-all",
                  localAnswer === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted",
                  disabled && "opacity-60 cursor-not-allowed"
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nested follow-up question */}
      <AnimatePresence mode="wait">
        {activeFollowUp && (
          <QuestionRenderer
            key={activeFollowUp.id}
            question={activeFollowUp}
            answer={followUpAnswer ?? undefined}
            onAnswer={handleFollowUpAnswer}
            disabled={disabled}
            depth={depth + 1}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function NestedQuestionComponent({
  question,
  value,
  onChange,
  disabled = false,
}: NestedQuestionProps) {
  const handleAnswer = useCallback(
    (answer: NestedQuestionAnswer) => {
      // Calculate depth
      let maxDepth = 0;
      const calcDepth = (a: NestedQuestionAnswer, d: number): void => {
        maxDepth = Math.max(maxDepth, d);
        a.followUpAnswers?.forEach((f) => calcDepth(f, d + 1));
      };
      calcDepth(answer, 1);

      // Build path
      const path: string[] = [];
      const buildPath = (a: NestedQuestionAnswer): void => {
        path.push(a.questionId);
        a.followUpAnswers?.forEach(buildPath);
      };
      buildPath(answer);

      // Check if all required answered
      const checkComplete = (q: NestedQuestion, a: NestedQuestionAnswer | undefined): boolean => {
        if (!a) return !q.required;
        if (q.required && !a.answer && a.answer !== 0) return false;
        
        // Check follow-up requirements
        const activeOption = q.options?.find((opt) => {
          if (Array.isArray(a.answer)) return a.answer.includes(opt.id);
          return opt.id === a.answer;
        });
        if (activeOption?.followUp) {
          return checkComplete(activeOption.followUp, a.followUpAnswers?.[0]);
        }
        return true;
      };

      onChange({
        answers: [answer],
        completionPath: path,
        totalDepth: maxDepth,
        allAnswered: checkComplete(question, answer),
      });
    },
    [question, onChange]
  );

  return (
    <div className="space-y-4">
      <QuestionRenderer
        question={question}
        answer={value?.answers[0]}
        onAnswer={handleAnswer}
        disabled={disabled}
        depth={0}
      />

      {/* Completion indicator */}
      {value && (
        <div className="flex items-center gap-2 text-sm">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              value.allAnswered ? "bg-green-500" : "bg-orange-500"
            )}
          />
          <span className="text-muted-foreground">
            {value.allAnswered
              ? "All required questions answered"
              : "Some required questions pending"}
          </span>
          {value.totalDepth > 1 && (
            <span className="text-xs text-muted-foreground">
              ({value.totalDepth} levels deep)
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE PRESETS
// ─────────────────────────────────────────────────────────────────────────────

export const NESTED_QUESTION_PRESETS = {
  satisfactionDrillDown: {
    id: "satisfaction",
    text: "How satisfied are you with our service?",
    type: "choice" as const,
    required: true,
    options: [
      { id: "very-satisfied", text: "Very satisfied", value: 5 },
      { id: "satisfied", text: "Satisfied", value: 4 },
      {
        id: "neutral",
        text: "Neutral",
        value: 3,
        followUp: {
          id: "neutral-reason",
          text: "What could we improve?",
          type: "text" as const,
          required: true,
        },
      },
      {
        id: "dissatisfied",
        text: "Dissatisfied",
        value: 2,
        followUp: {
          id: "dissatisfied-area",
          text: "Which area disappointed you?",
          type: "choice" as const,
          required: true,
          options: [
            { id: "quality", text: "Product quality" },
            { id: "service", text: "Customer service" },
            { id: "delivery", text: "Delivery time" },
            {
              id: "other",
              text: "Other",
              followUp: {
                id: "other-details",
                text: "Please describe:",
                type: "text" as const,
                required: true,
              },
            },
          ],
        },
      },
      {
        id: "very-dissatisfied",
        text: "Very dissatisfied",
        value: 1,
        followUp: {
          id: "vd-reason",
          text: "We're sorry to hear that. What happened?",
          type: "text" as const,
          required: true,
        },
      },
    ],
  },

  purchaseIntent: {
    id: "purchase-intent",
    text: "Are you considering purchasing our product?",
    type: "choice" as const,
    required: true,
    options: [
      {
        id: "yes",
        text: "Yes, definitely",
        value: 5,
        followUp: {
          id: "timeline",
          text: "When do you plan to purchase?",
          type: "choice" as const,
          options: [
            { id: "now", text: "Within this week" },
            { id: "month", text: "Within this month" },
            { id: "quarter", text: "Within 3 months" },
            { id: "later", text: "Later this year" },
          ],
        },
      },
      {
        id: "maybe",
        text: "Maybe, considering it",
        value: 3,
        followUp: {
          id: "blockers",
          text: "What's holding you back?",
          type: "multi-choice" as const,
          options: [
            { id: "price", text: "Price" },
            { id: "features", text: "Missing features" },
            { id: "competition", text: "Evaluating competitors" },
            { id: "timing", text: "Not the right time" },
          ],
        },
      },
      {
        id: "no",
        text: "No, not interested",
        value: 1,
        followUp: {
          id: "no-reason",
          text: "Could you tell us why?",
          type: "text" as const,
        },
      },
    ],
  },

  featurePriority: {
    id: "feature-priority",
    text: "Which feature matters most to you?",
    type: "choice" as const,
    required: true,
    options: [
      {
        id: "speed",
        text: "Performance & Speed",
        followUp: {
          id: "speed-importance",
          text: "How important is speed on a scale of 1-10?",
          type: "scale" as const,
          scaleMin: 1,
          scaleMax: 10,
          scaleMinLabel: "Nice to have",
          scaleMaxLabel: "Critical",
        },
      },
      {
        id: "ui",
        text: "User Interface",
        followUp: {
          id: "ui-aspects",
          text: "Which UI aspects matter most?",
          type: "multi-choice" as const,
          options: [
            { id: "clean", text: "Clean design" },
            { id: "intuitive", text: "Intuitive navigation" },
            { id: "customizable", text: "Customization options" },
            { id: "accessibility", text: "Accessibility" },
          ],
        },
      },
      {
        id: "integrations",
        text: "Integrations",
        followUp: {
          id: "integration-types",
          text: "Which integrations do you need?",
          type: "text" as const,
          description: "List the tools/services you'd like us to integrate with",
        },
      },
      {
        id: "support",
        text: "Customer Support",
        followUp: {
          id: "support-type",
          text: "What type of support do you prefer?",
          type: "choice" as const,
          options: [
            { id: "chat", text: "Live chat" },
            { id: "email", text: "Email support" },
            { id: "phone", text: "Phone support" },
            { id: "self", text: "Self-service docs" },
          ],
        },
      },
    ],
  },
};

export default NestedQuestionComponent;
