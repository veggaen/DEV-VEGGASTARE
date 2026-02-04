"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  BarChart3,
  Loader2,
  AlertCircle,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SliderQuestion } from "./SliderQuestion";
import { ChoiceQuestion } from "./ChoiceQuestion";
import { ImagePasteInput } from "./ImagePasteInput";

// Types
interface PollQuestion {
  id: string;
  order: number;
  type: "SINGLE_CHOICE" | "MULTI_CHOICE" | "SLIDER" | "SCALE" | "TEXT" | "NESTED";
  questionText: string;
  description?: string;
  required: boolean;
  allowImages: boolean;
  sliderConfig?: {
    minValue: number;
    maxValue: number;
    step: number;
    minLabel?: string;
    maxLabel?: string;
    stepLabels?: string[];
  };
  options?: {
    id: string;
    text: string;
    description?: string;
    imageUrl?: string;
    order: number;
  }[];
}

interface AdvancedPoll {
  id: string;
  title: string;
  description?: string;
  type: "SIMPLE" | "SURVEY" | "QUIZ" | "FEEDBACK" | "REACH_ASSESSMENT";
  allowPartialSubmission: boolean;
  showProgressBar: boolean;
  randomizeQuestions: boolean;
  questions: PollQuestion[];
  expiresAt?: string;
  totalResponses?: number;
  userResponse?: UserResponse;
}

interface Answer {
  questionId: string;
  selectedOptionIds?: string[];
  sliderValue?: number;
  scaleValue?: number;
  textValue?: string;
  images?: {
    url: string;
    width: number;
    height: number;
    aspectRatio: string;
  }[];
}

interface UserResponse {
  id: string;
  completedAt?: string;
  answers: Answer[];
}

interface AdvancedPollDisplayProps {
  poll: AdvancedPoll;
  onSubmit?: (answers: Answer[]) => Promise<void>;
  onPartialSave?: (answers: Answer[]) => void;
  showAnalytics?: boolean;
  onViewAnalytics?: () => void;
  className?: string;
}

export function AdvancedPollDisplay({
  poll,
  onSubmit,
  onPartialSave,
  showAnalytics = false,
  onViewAnalytics,
  className,
}: AdvancedPollDisplayProps) {
  // Randomize questions if enabled
  const questions = useMemo(() => {
    if (poll.randomizeQuestions) {
      return [...poll.questions].sort(() => Math.random() - 0.5);
    }
    return poll.questions.sort((a, b) => a.order - b.order);
  }, [poll.questions, poll.randomizeQuestions]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, Answer>>(() => {
    const map = new Map<string, Answer>();
    // Initialize with existing user response if any
    if (poll.userResponse?.answers) {
      poll.userResponse.answers.forEach((answer) => {
        map.set(answer.questionId, answer);
      });
    }
    return map;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(!!poll.userResponse?.completedAt);
  const [startTime] = useState(Date.now());

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const progress = ((currentIndex + 1) / totalQuestions) * 100;

  // Calculate completion stats
  const { answeredCount, requiredAnswered, allRequiredDone } = useMemo(() => {
    let answered = 0;
    let requiredAnswered = 0;
    let requiredTotal = 0;

    questions.forEach((q) => {
      const answer = answers.get(q.id);
      const hasAnswer = answer && (
        (answer.selectedOptionIds && answer.selectedOptionIds.length > 0) ||
        answer.sliderValue !== undefined ||
        answer.scaleValue !== undefined ||
        (answer.textValue && answer.textValue.trim().length > 0)
      );

      if (hasAnswer) answered++;
      if (q.required) {
        requiredTotal++;
        if (hasAnswer) requiredAnswered++;
      }
    });

    return {
      answeredCount: answered,
      requiredAnswered,
      allRequiredDone: requiredAnswered >= requiredTotal,
    };
  }, [questions, answers]);

  // Check if current question is answered
  const isCurrentAnswered = useMemo(() => {
    const answer = answers.get(currentQuestion?.id);
    if (!answer) return false;

    switch (currentQuestion?.type) {
      case "SINGLE_CHOICE":
      case "MULTI_CHOICE":
        return answer.selectedOptionIds && answer.selectedOptionIds.length > 0;
      case "SLIDER":
        return answer.sliderValue !== undefined;
      case "SCALE":
        return answer.scaleValue !== undefined;
      case "TEXT":
        return answer.textValue && answer.textValue.trim().length > 0;
      default:
        return false;
    }
  }, [answers, currentQuestion]);

  // Update answer
  const updateAnswer = useCallback(
    (questionId: string, update: Partial<Answer>) => {
      setAnswers((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(questionId) || { questionId };
        newMap.set(questionId, { ...existing, ...update });
        return newMap;
      });
    },
    []
  );

  // Save partial progress
  useEffect(() => {
    if (poll.allowPartialSubmission && onPartialSave && answers.size > 0) {
      const debounce = setTimeout(() => {
        onPartialSave(Array.from(answers.values()));
      }, 2000);
      return () => clearTimeout(debounce);
    }
  }, [answers, poll.allowPartialSubmission, onPartialSave]);

  // Navigation
  const goNext = useCallback(() => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, totalQuestions]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  // Submit
  const handleSubmit = useCallback(async () => {
    if (!onSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onSubmit(Array.from(answers.values()));
      setIsComplete(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  }, [onSubmit, answers]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && e.ctrlKey) {
        goNext();
      } else if (e.key === "ArrowLeft" && e.ctrlKey) {
        goPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

  // Check if expired
  const isExpired = poll.expiresAt && new Date(poll.expiresAt) < new Date();

  if (isExpired && !isComplete) {
    return (
      <div className={cn("p-6 rounded-lg border bg-muted/50", className)}>
        <div className="text-center space-y-2">
          <Clock className="w-12 h-12 mx-auto text-muted-foreground" />
          <h3 className="font-semibold">Poll Expired</h3>
          <p className="text-sm text-muted-foreground">
            This poll ended on {new Date(poll.expiresAt!).toLocaleDateString()}
          </p>
          {showAnalytics && onViewAnalytics && (
            <Button variant="outline" onClick={onViewAnalytics}>
              <BarChart3 className="w-4 h-4 mr-2" />
              View Results
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Show completion state
  if (isComplete) {
    return (
      <div className={cn("p-6 rounded-lg border bg-muted/50", className)}>
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center"
          >
            <Check className="w-8 h-8 text-green-500" />
          </motion.div>
          <h3 className="font-semibold text-lg">Thank you!</h3>
          <p className="text-sm text-muted-foreground">
            Your response has been submitted successfully.
          </p>
          <div className="text-xs text-muted-foreground">
            You answered {answeredCount} of {totalQuestions} questions
          </div>
          {showAnalytics && onViewAnalytics && (
            <Button variant="outline" onClick={onViewAnalytics}>
              <BarChart3 className="w-4 h-4 mr-2" />
              View Results
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{poll.title}</h2>
        {poll.description && (
          <p className="text-sm text-muted-foreground">{poll.description}</p>
        )}
        {poll.totalResponses !== undefined && (
          <p className="text-xs text-muted-foreground">
            {poll.totalResponses} response{poll.totalResponses !== 1 ? "s" : ""} so far
          </p>
        )}
      </div>

      {/* Progress Bar */}
      {poll.showProgressBar && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Question {currentIndex + 1} of {totalQuestions}
            </span>
            <span>
              {answeredCount} answered ({Math.round((answeredCount / totalQuestions) * 100)}%)
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Question Dots Navigation */}
      <div className="flex justify-center gap-2 flex-wrap">
        {questions.map((q, i) => {
          const isAnswered = answers.has(q.id);
          const isCurrent = i === currentIndex;

          return (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                "w-3 h-3 rounded-full transition-all",
                isCurrent
                  ? "bg-primary scale-125"
                  : isAnswered
                  ? "bg-primary/50"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              aria-label={`Go to question ${i + 1}`}
            />
          );
        })}
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="p-6 rounded-lg border bg-card"
        >
          {/* Question Type Renderer */}
          {(currentQuestion.type === "SINGLE_CHOICE" ||
            currentQuestion.type === "MULTI_CHOICE") && (
            <ChoiceQuestion
              questionId={currentQuestion.id}
              questionText={currentQuestion.questionText}
              description={currentQuestion.description}
              options={
                currentQuestion.options?.map((opt) => ({
                  id: opt.id,
                  text: opt.text,
                  description: opt.description,
                  imageUrl: opt.imageUrl,
                })) || []
              }
              selectedValue={answers.get(currentQuestion.id)?.selectedOptionIds}
              onChange={(value) =>
                updateAnswer(currentQuestion.id, {
                  selectedOptionIds: Array.isArray(value) ? value : value ? [value] : [],
                })
              }
              multiSelect={currentQuestion.type === "MULTI_CHOICE"}
              disabled={isSubmitting}
            />
          )}

          {currentQuestion.type === "SLIDER" && currentQuestion.sliderConfig && (
            <SliderQuestion
              questionId={currentQuestion.id}
              questionText={currentQuestion.questionText}
              description={currentQuestion.description}
              minValue={currentQuestion.sliderConfig.minValue}
              maxValue={currentQuestion.sliderConfig.maxValue}
              step={currentQuestion.sliderConfig.step}
              minLabel={currentQuestion.sliderConfig.minLabel}
              maxLabel={currentQuestion.sliderConfig.maxLabel}
              stepLabels={currentQuestion.sliderConfig.stepLabels}
              value={answers.get(currentQuestion.id)?.sliderValue}
              onChange={(value) =>
                updateAnswer(currentQuestion.id, { sliderValue: value })
              }
              disabled={isSubmitting}
              colorScheme={poll.type === "REACH_ASSESSMENT" ? "reach" : "default"}
            />
          )}

          {currentQuestion.type === "SCALE" && (
            <SliderQuestion
              questionId={currentQuestion.id}
              questionText={currentQuestion.questionText}
              description={currentQuestion.description}
              minValue={1}
              maxValue={10}
              step={1}
              minLabel="Low"
              maxLabel="High"
              value={answers.get(currentQuestion.id)?.scaleValue}
              onChange={(value) =>
                updateAnswer(currentQuestion.id, { scaleValue: value })
              }
              disabled={isSubmitting}
            />
          )}

          {currentQuestion.type === "TEXT" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-medium">{currentQuestion.questionText}</h3>
                {currentQuestion.description && (
                  <p className="text-sm text-muted-foreground">
                    {currentQuestion.description}
                  </p>
                )}
              </div>
              <textarea
                value={answers.get(currentQuestion.id)?.textValue || ""}
                onChange={(e) =>
                  updateAnswer(currentQuestion.id, { textValue: e.target.value })
                }
                placeholder="Type your answer..."
                disabled={isSubmitting}
                className="w-full min-h-[120px] p-3 rounded-lg border bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          {/* Image Upload (if allowed) */}
          {currentQuestion.allowImages && (
            <div className="mt-4 pt-4 border-t">
              <ImagePasteInput
                questionId={currentQuestion.id}
                label="Add images (optional)"
                description="Paste (Ctrl+V) or drop images to illustrate your answer"
                value={(answers.get(currentQuestion.id)?.images || []).map(img => ({
                  ...img,
                  aspectRatio: img.aspectRatio as "portrait" | "landscape" | "square",
                  size: 0,
                }))}
                onChange={(images) =>
                  updateAnswer(currentQuestion.id, {
                    images: images.map((img) => ({
                      url: img.url,
                      width: img.width,
                      height: img.height,
                      aspectRatio: img.aspectRatio as string,
                    })),
                  })
                }
                maxImages={2}
                disabled={isSubmitting}
              />
            </div>
          )}

          {/* Required indicator */}
          {currentQuestion.required && (
            <p className="mt-4 text-xs text-muted-foreground">
              * This question is required
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {submitError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            {submitError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={goPrev}
          disabled={currentIndex === 0 || isSubmitting}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>

        <div className="flex gap-2">
          {currentIndex < totalQuestions - 1 ? (
            <Button onClick={goNext} disabled={isSubmitting}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                (!poll.allowPartialSubmission && !allRequiredDone)
              }
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit ({answeredCount}/{totalQuestions})
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Partial submission hint */}
      {poll.allowPartialSubmission && (
        <p className="text-xs text-center text-muted-foreground">
          💡 Your progress is saved automatically. You can submit even with partial answers.
        </p>
      )}
    </div>
  );
}

export default AdvancedPollDisplay;
