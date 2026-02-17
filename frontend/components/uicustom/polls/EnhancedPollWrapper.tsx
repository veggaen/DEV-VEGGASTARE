"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Components
import { PollNavigationBar, type BarPosition } from "./PollNavigationBar";
import { PollResultsDisplay, type SectionResult } from "./PollResultsDisplay";
import { QuestionCommentButton } from "./QuestionCommentButton";
import { usePollNavigation, type PollNavigationState } from "@/hooks/use-poll-navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Question {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  data: any;
  optional?: boolean;
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

export interface EnhancedPollWrapperProps {
  pollId: string;
  pollTitle: string;
  sections: Section[];
  
  // Render props for flexibility
  renderQuestion: (
    question: Question,
    answer: any,
    onAnswer: (value: any) => void,
    comment: string,
    onCommentChange: (comment: string) => void
  ) => React.ReactNode;
  
  renderWelcome?: () => React.ReactNode;
  renderComplete?: (stats: { answered: number; total: number; percent: number }) => React.ReactNode;
  
  // Answers state (controlled)
  answers: Record<string, any>;
  onAnswersChange: (answers: Record<string, any>) => void;
  
  // Comments state (controlled)
  comments?: Record<string, string>;
  onCommentsChange?: (comments: Record<string, string>) => void;
  
  // Results
  results?: SectionResult[];
  onViewResults?: () => void;
  isResultsPublic?: boolean;
  onToggleResultsPublic?: () => void;
  
  // Submission
  onSubmit?: () => void;
  isSubmitting?: boolean;
  
  // Options
  enableUrlSync?: boolean;
  enableMouseNavigation?: boolean;
  enableNavigationBar?: boolean;
  defaultNavBarPosition?: BarPosition;
  showCommentButton?: boolean;
  
  // Callbacks
  onNavigate?: (state: PollNavigationState) => void;
  onComplete?: () => void;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function calculateProgress(
  sections: Section[],
  answers: Record<string, any>
): { answered: number; total: number; percent: number; sectionProgress: Record<string, { answered: number; total: number }> } {
  let answered = 0;
  let total = 0;
  const sectionProgress: Record<string, { answered: number; total: number }> = {};

  for (const section of sections) {
    const sectionAnswered = section.questions.filter(
      (q) => answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== ""
    ).length;
    const sectionTotal = section.questions.length;

    sectionProgress[section.id] = {
      answered: sectionAnswered,
      total: sectionTotal,
    };

    answered += sectionAnswered;
    total += sectionTotal;
  }

  return {
    answered,
    total,
    percent: total > 0 ? Math.round((answered / total) * 100) : 0,
    sectionProgress,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EnhancedPollWrapper({
  pollId,
  pollTitle,
  sections,
  renderQuestion,
  renderWelcome,
  renderComplete,
  answers,
  onAnswersChange,
  comments = {},
  onCommentsChange,
  results,
  onViewResults,
  isResultsPublic,
  onToggleResultsPublic,
  onSubmit,
  isSubmitting,
  enableUrlSync = true,
  enableMouseNavigation = true,
  enableNavigationBar = true,
  defaultNavBarPosition = "bottom",
  showCommentButton = true,
  onNavigate,
  onComplete,
}: EnhancedPollWrapperProps) {
  // Navigation hook
  const nav = usePollNavigation({
    totalSections: sections.length,
    getSectionQuestionCount: (sectionIndex) => sections[sectionIndex]?.questions.length || 0,
    pollId,
    enableUrlSync,
    enableMouseNavigation,
    onNavigate,
  });

  // Progress calculations
  const progress = useMemo(
    () => calculateProgress(sections, answers),
    [sections, answers]
  );

  // Navigation bar sections data
  const navSections = useMemo(
    () =>
      sections.map((section, idx) => ({
        id: section.id,
        title: section.title,
        questionCount: section.questions.length,
        answeredCount: progress.sectionProgress[section.id]?.answered || 0,
      })),
    [sections, progress.sectionProgress]
  );

  // Current question
  const currentSection = sections[nav.currentSection];
  const currentQuestion = currentSection?.questions[nav.currentQuestion];

  // Answer handlers
  const handleAnswer = useCallback(
    (questionId: string, value: any) => {
      onAnswersChange({
        ...answers,
        [questionId]: value,
      });
    },
    [answers, onAnswersChange]
  );

  const handleCommentChange = useCallback(
    (questionId: string, comment: string) => {
      onCommentsChange?.({
        ...comments,
        [questionId]: comment,
      });
    },
    [comments, onCommentsChange]
  );

  // Navigation handlers
  const handleHome = useCallback(() => {
    nav.goHome();
  }, [nav]);

  const handleRestart = useCallback(() => {
    nav.restart();
    onAnswersChange({});
    onCommentsChange?.({});
  }, [nav, onAnswersChange, onCommentsChange]);

  const handleViewResults = useCallback(() => {
    nav.goToResults();
    onViewResults?.();
  }, [nav, onViewResults]);

  // Check if complete
  useEffect(() => {
    if (nav.screen === "complete" && progress.percent === 100) {
      onComplete?.();
    }
  }, [nav.screen, progress.percent, onComplete]);

  return (
    <div className="relative min-h-screen">
      {/* Navigation Bar */}
      {enableNavigationBar && nav.screen !== "welcome" && nav.screen !== "results" && (
        <PollNavigationBar
          currentSection={nav.currentSection}
          currentQuestion={nav.currentQuestion}
          totalSections={sections.length}
          totalQuestions={progress.total}
          sections={navSections}
          onPrevQuestion={() => nav.goPrev()}
          onNextQuestion={() => nav.goNext()}
          onPrevSection={() => {
            if (nav.currentSection > 0) {
              nav.goToSection(nav.currentSection - 1);
            }
          }}
          onNextSection={() => {
            if (nav.currentSection < sections.length - 1) {
              nav.goToSection(nav.currentSection + 1);
            }
          }}
          onGoToSection={nav.goToSection}
          onGoToQuestion={nav.goToQuestion}
          onRestart={handleRestart}
          onHome={handleHome}
          onViewResults={handleViewResults}
          shareableUrl={nav.shareableUrl}
          onCopyUrl={() => nav.copyShareableUrl()}
          answeredCount={progress.answered}
          progressPercent={progress.percent}
          defaultPosition={defaultNavBarPosition}
          canGoBack={nav.canGoBack}
          canGoForward={nav.canGoForward}
          isComplete={progress.percent === 100}
          pollTitle={pollTitle}
        />
      )}

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {/* Welcome Screen */}
        {nav.screen === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="min-h-screen"
          >
            {renderWelcome ? (
              renderWelcome()
            ) : (
              <DefaultWelcome
                pollTitle={pollTitle}
                totalQuestions={progress.total}
                totalSections={sections.length}
                onStart={() => nav.goToScreen("question")}
              />
            )}
          </motion.div>
        )}

        {/* Question Screen */}
        {nav.screen === "question" && currentQuestion && (
          <motion.div
            key={`${currentSection.id}-${currentQuestion.id}`}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "min-h-screen p-4 md:p-8",
              enableNavigationBar && "pb-24" // Padding for nav bar
            )}
          >
            <div className="max-w-3xl mx-auto">
              {/* Section indicator */}
              <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  Section {nav.currentSection + 1}: {currentSection.title}
                </span>
                <span>•</span>
                <span>
                  Question {nav.currentQuestion + 1} of {currentSection.questions.length}
                </span>
              </div>

              {/* Question container */}
              <div className="relative">
                {/* Comment button */}
                {showCommentButton && (
                  <div className="absolute top-0 right-0 z-10">
                    <QuestionCommentButton
                      questionId={currentQuestion.id}
                      comment={comments[currentQuestion.id] || ""}
                      onCommentChange={(comment) =>
                        handleCommentChange(currentQuestion.id, comment)
                      }
                      size="md"
                      variant="default"
                    />
                  </div>
                )}

                {/* Question content */}
                <div className="pr-12">
                  {renderQuestion(
                    currentQuestion,
                    answers[currentQuestion.id],
                    (value) => handleAnswer(currentQuestion.id, value),
                    comments[currentQuestion.id] || "",
                    (comment) => handleCommentChange(currentQuestion.id, comment)
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Complete Screen */}
        {nav.screen === "complete" && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="min-h-screen p-4 md:p-8"
          >
            {renderComplete ? (
              renderComplete({
                answered: progress.answered,
                total: progress.total,
                percent: progress.percent,
              })
            ) : (
              <DefaultComplete
                answered={progress.answered}
                total={progress.total}
                percent={progress.percent}
                onSubmit={onSubmit}
                onViewResults={handleViewResults}
                isSubmitting={isSubmitting}
              />
            )}
          </motion.div>
        )}

        {/* Results Screen */}
        {nav.screen === "results" && results && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="min-h-screen p-4 md:p-8"
          >
            <PollResultsDisplay
              pollId={pollId}
              pollTitle={pollTitle}
              sections={results}
              totalRespondents={0}
              completionRate={progress.percent}
              isPublic={isResultsPublic}
              onTogglePublic={onToggleResultsPublic}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Default Welcome Screen ───────────────────────────────────────────────────

function DefaultWelcome({
  pollTitle,
  totalQuestions,
  totalSections,
  onStart,
}: {
  pollTitle: string;
  totalQuestions: number;
  totalSections: number;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="w-20 h-20 rounded-2xl bg-linear-to-br from-primary to-primary/60 flex items-center justify-center mb-6 shadow-xl"
      >
        <span className="text-4xl">📊</span>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-3xl md:text-4xl font-bold mb-4"
      >
        {pollTitle}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-muted-foreground max-w-md mb-8"
      >
        {totalQuestions} questions across {totalSections} sections
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        onClick={onStart}
        className="px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-colors shadow-lg"
      >
        Start Poll
      </motion.button>
    </div>
  );
}

// ─── Default Complete Screen ──────────────────────────────────────────────────

function DefaultComplete({
  answered,
  total,
  percent,
  onSubmit,
  onViewResults,
  isSubmitting,
}: {
  answered: number;
  total: number;
  percent: number;
  onSubmit?: () => void;
  onViewResults?: () => void;
  isSubmitting?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="w-24 h-24 rounded-full bg-linear-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mb-6 shadow-xl"
      >
        <span className="text-5xl">🎉</span>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-bold mb-2"
      >
        {percent === 100 ? "Complete!" : "Almost There!"}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-muted-foreground mb-8"
      >
        {answered} of {total} questions answered ({percent}%)
      </motion.p>

      {/* Progress ring */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="relative w-32 h-32 mb-8"
      >
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-muted"
          />
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={283}
            initial={{ strokeDashoffset: 283 }}
            animate={{ strokeDashoffset: 283 - (283 * percent) / 100 }}
            transition={{ duration: 1, delay: 0.5 }}
          />
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold">{percent}%</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex gap-4"
      >
        {onViewResults && (
          <button
            onClick={onViewResults}
            className="px-6 py-3 rounded-xl border border-border hover:bg-muted transition-colors"
          >
            View Results
          </button>
        )}
        {onSubmit && (
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        )}
      </motion.div>
    </div>
  );
}

export default EnhancedPollWrapper;
