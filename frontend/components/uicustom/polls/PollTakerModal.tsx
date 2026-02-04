"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SliderQuestion } from "@/components/uicustom/polls/SliderQuestion";
import { ChoiceQuestion } from "@/components/uicustom/polls/ChoiceQuestion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Target,
  Clock,
  Users,
  Zap,
  Sparkles,
  Check,
  Rocket,
  MessageSquarePlus,
  Layers,
  TrendingUp,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types for API responses
interface PollOption {
  id: string;
  text: string;
  order: number;
  value?: number | null;
  imageUrl?: string | null;
}

interface PollQuestion {
  id: string;
  text: string;
  description?: string | null;
  type: string;
  order: number;
  isRequired: boolean;
  allowImages: boolean;
  allowComments: boolean;
  sliderConfig?: {
    min?: number;
    max?: number;
    step?: number;
    labels?: string[];
    showValue?: boolean;
  } | null;
  options: PollOption[];
  childQuestions?: PollQuestion[];
}

interface PollCreator {
  id: string;
  name: string | null;
  image?: string | null;
}

interface PollData {
  id: string;
  title: string;
  description?: string | null;
  type: "SIMPLE" | "SURVEY" | "QUIZ" | "FEEDBACK" | "REACH_ASSESSMENT";
  creatorId: string;
  isAnonymous: boolean;
  allowPartial: boolean;
  requiresAuth: boolean;
  expiresAt?: string | null;
  publishedAt?: string | null;
  totalResponses: number;
  avgCompletionPct: number;
  questions: PollQuestion[];
  creator?: PollCreator;
  userResponse?: {
    id: string;
    completionPct: number;
    completedAt?: string | null;
    answers: {
      questionId: string;
      optionId?: string | null;
      sliderValue?: number | null;
      scaleValue?: number | null;
      textValue?: string | null;
      comment?: string | null;
    }[];
  } | null;
}

interface QuestionAnswer {
  value: string | string[] | number | undefined;
  comment?: string;
}

interface PollTakerModalProps {
  pollId: string | null;
  onClose: () => void;
  onComplete?: (responseId: string) => void;
}

// Group questions into sections based on types or just use flat list
function groupQuestionsIntoSections(questions: PollQuestion[]): { title: string; questions: PollQuestion[] }[] {
  // For now, create a single section - can be enhanced to detect natural breaks
  return [{ title: "Questions", questions }];
}

export function PollTakerModal({ pollId, onClose, onComplete }: PollTakerModalProps) {
  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"all" | "single">("all");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch poll data
  useEffect(() => {
    if (!pollId) {
      setPoll(null);
      setLoading(false);
      return;
    }

    const fetchPoll = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/advanced-polls/${pollId}`);
        if (!res.ok) throw new Error("Failed to fetch poll");
        const data = await res.json();
        setPoll(data.poll);

        // Initialize answers from existing response
        if (data.poll?.userResponse?.answers) {
          const existingAnswers: Record<string, QuestionAnswer> = {};
          for (const ans of data.poll.userResponse.answers) {
            existingAnswers[ans.questionId] = {
              value: ans.sliderValue ?? ans.optionId ?? ans.textValue ?? undefined,
              comment: ans.comment ?? undefined,
            };
          }
          setAnswers(existingAnswers);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchPoll();
  }, [pollId]);

  // Group questions into sections
  const sections = useMemo(() => {
    if (!poll?.questions) return [];
    return groupQuestionsIntoSections(poll.questions);
  }, [poll?.questions]);

  const currentSection = sections[currentSectionIndex];
  const totalQuestions = poll?.questions?.length || 0;

  // Calculate progress
  const answeredCount = Object.values(answers).filter((a) => a.value !== undefined).length;
  const progressPct = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  // Handle answer
  const handleAnswer = useCallback((questionId: string, answer: QuestionAnswer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }, []);

  // Toggle comment
  const toggleComment = useCallback((questionId: string) => {
    setShowComments((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  }, []);

  // Submit answers
  const handleSubmit = async () => {
    if (!poll) return;
    setIsSubmitting(true);

    try {
      const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => {
        const question = poll.questions.find((q) => q.id === questionId);
        return {
          questionId,
          optionId: typeof answer.value === "string" && question?.type !== "TEXT" ? answer.value : undefined,
          sliderValue: typeof answer.value === "number" ? answer.value : undefined,
          textValue: question?.type === "TEXT" ? String(answer.value || "") : undefined,
          comment: answer.comment,
        };
      });

      const res = await fetch(`/api/advanced-polls/${poll.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: formattedAnswers }),
      });

      if (!res.ok) throw new Error("Failed to submit");
      const data = await res.json();
      onComplete?.(data.response.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Navigate sections
  const goToNextSection = () => {
    if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex((i) => i + 1);
      setCurrentQuestionIndex(0);
    }
  };

  const goToPrevSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex((i) => i - 1);
      setCurrentQuestionIndex(0);
    }
  };

  if (!pollId) return null;

  return (
    <Dialog open={!!pollId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <TooltipProvider>
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-destructive mb-4">{error}</p>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          ) : poll ? (
            <div className="flex flex-col h-[85vh]">
              {/* Header */}
              <div className="p-4 border-b bg-gradient-to-r from-background via-muted/20 to-background">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {poll.type === "REACH_ASSESSMENT" ? (
                        <Rocket className="h-6 w-6 text-amber-500" />
                      ) : (
                        <Target className="h-6 w-6 text-primary" />
                      )}
                      <DialogTitle className="text-xl font-bold">
                        {poll.title}
                      </DialogTitle>
                    </div>
                    {poll.description && (
                      <DialogDescription className="text-sm">
                        {poll.description}
                      </DialogDescription>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Badge variant="outline" className="gap-1">
                    <Target className="h-3 w-3" />
                    {totalQuestions} Questions
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Users className="h-3 w-3" />
                    {poll.totalResponses} Responses
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "gap-1",
                      progressPct === 100 && "border-emerald-500 text-emerald-500"
                    )}
                  >
                    <TrendingUp className="h-3 w-3" />
                    {progressPct}% Complete
                  </Badge>
                </div>

                {/* Progress bar */}
                <div className="mt-3 space-y-1">
                  <Progress value={progressPct} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{answeredCount} answered</span>
                    <span>{totalQuestions - answeredCount} remaining</span>
                  </div>
                </div>
              </div>

              {/* Questions Area */}
              <ScrollArea className="flex-1 p-4">
                <AnimatePresence mode="wait">
                  {currentSection && (
                    <motion.div
                      key={currentSectionIndex}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      {/* Section header if multiple sections */}
                      {sections.length > 1 && (
                        <div className="mb-4">
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Layers className="h-5 w-5" />
                            {currentSection.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Section {currentSectionIndex + 1} of {sections.length}
                          </p>
                        </div>
                      )}

                      {/* Questions */}
                      {currentSection.questions.map((question, idx) => (
                        <QuestionCard
                          key={question.id}
                          question={question}
                          questionNumber={idx + 1}
                          answer={answers[question.id]}
                          onAnswer={(val) => handleAnswer(question.id, val)}
                          showComment={showComments[question.id] || false}
                          onToggleComment={() => toggleComment(question.id)}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </ScrollArea>

              {/* Footer */}
              <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
                <div className="flex gap-2">
                  {currentSectionIndex > 0 && (
                    <Button variant="outline" onClick={goToPrevSection}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  {currentSectionIndex < sections.length - 1 ? (
                    <Button onClick={goToNextSection}>
                      Next Section
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting || answeredCount === 0}
                      className={cn(
                        poll.type === "REACH_ASSESSMENT" &&
                          "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                      )}
                    >
                      {isSubmitting ? (
                        <>Submitting...</>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-1" />
                          Submit Response
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}

// Individual question card
function QuestionCard({
  question,
  questionNumber,
  answer,
  onAnswer,
  showComment,
  onToggleComment,
}: {
  question: PollQuestion;
  questionNumber: number;
  answer: QuestionAnswer | undefined;
  onAnswer: (val: QuestionAnswer) => void;
  showComment: boolean;
  onToggleComment: () => void;
}) {
  const handleValueChange = (value: string | string[] | number | undefined) => {
    onAnswer({ value, comment: answer?.comment });
  };

  const handleCommentChange = (comment: string) => {
    onAnswer({ value: answer?.value ?? undefined, comment });
  };

  const sliderConfig = question.sliderConfig || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl border bg-card space-y-4"
    >
      {/* Question header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Q{questionNumber}
            </span>
            <h3 className="font-medium">{question.text}</h3>
            {question.isRequired && <span className="text-red-500 text-xs">*</span>}
          </div>
          {question.description && (
            <p className="text-sm text-muted-foreground">{question.description}</p>
          )}
        </div>

        {question.allowComments && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleComment}
                className={cn(
                  showComment && "text-emerald-500 bg-emerald-500/10"
                )}
              >
                <MessageSquarePlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add comment</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Question input based on type */}
      <div className="pt-2">
        {(question.type === "SLIDER" || question.type === "SCALE") && (
          <SliderQuestion
            questionId={question.id}
            questionText=""
            minValue={sliderConfig.min ?? 1}
            maxValue={sliderConfig.max ?? 7}
            step={sliderConfig.step ?? 1}
            minLabel={sliderConfig.labels?.[0] ?? "A"}
            maxLabel={sliderConfig.labels?.[sliderConfig.labels?.length - 1 || 0] ?? "G"}
            stepLabels={sliderConfig.labels}
            value={answer?.value as number | undefined}
            onChange={handleValueChange}
          />
        )}

        {(question.type === "SINGLE_CHOICE" || question.type === "MULTI_CHOICE") && (
          <ChoiceQuestion
            questionId={question.id}
            questionText=""
            options={question.options.map((opt) => ({
              id: opt.id,
              text: opt.text,
            }))}
            selectedValue={
              question.type === "MULTI_CHOICE"
                ? (answer?.value as string[] | undefined)
                : (answer?.value as string | undefined)
            }
            onChange={(v) => handleValueChange(v as string | string[])}
            multiSelect={question.type === "MULTI_CHOICE"}
            variant="card"
          />
        )}

        {question.type === "TEXT" && (
          <Textarea
            placeholder="Share your thoughts..."
            value={(answer?.value as string) ?? ""}
            onChange={(e) => handleValueChange(e.target.value)}
            className="min-h-[100px]"
          />
        )}
      </div>

      {/* Comment section */}
      <AnimatePresence>
        {showComment && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3 border-t">
              <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Additional feedback
              </label>
              <Textarea
                placeholder="Any additional thoughts..."
                value={answer?.comment ?? ""}
                onChange={(e) => handleCommentChange(e.target.value)}
                className="text-sm min-h-[60px]"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Answered indicator */}
      {answer?.value !== undefined && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-500">
          <Check className="h-3 w-3" />
          Answered
          {answer?.comment && <span className="text-muted-foreground">+ comment</span>}
        </div>
      )}
    </motion.div>
  );
}
