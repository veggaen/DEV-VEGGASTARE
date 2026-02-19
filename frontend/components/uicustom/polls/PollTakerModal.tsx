"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SliderQuestion } from "@/components/uicustom/polls/SliderQuestion";
import { ChoiceQuestion } from "@/components/uicustom/polls/ChoiceQuestion";
import { ShapeMatchQuestion, SHAPE_MATCH_PRESETS } from "@/components/uicustom/polls/ShapeMatchQuestion";
import { RankingQuestion } from "@/components/uicustom/polls/RankingQuestion";
import { UIArrangeQuestion, UI_ARRANGE_PRESETS } from "@/components/uicustom/polls/UIArrangeQuestion";
import { NestedQuestionComponent, NESTED_QUESTION_PRESETS } from "@/components/uicustom/polls/NestedQuestionComponent";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Target,
  Sparkles,
  Check,
  MessageSquarePlus,
  Crown,
  ListChecks,
  CheckCircle2,
  SlidersHorizontal,
  BarChart3,
  FileText,
  Send,
  RotateCcw,
  PartyPopper,
  Share2,
  Trophy,
  AlertCircle,
  Eye,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fuzzyTextMatch, aiVerifyTextAnswer } from "@/lib/fuzzy-text-match";

// ─── TYPES ─────────────────────────────────────────────────────────────────

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
  questionText?: string; // Alternative name from PollBuilder
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
    steps?: number;
    labels?: string[];
    showValue?: boolean;
  } | null;
  options: PollOption[];
  childQuestions?: PollQuestion[];
  // Quiz mode fields
  correctAnswer?: string | string[] | null;  // optionId(s) for choice, correct order for ranking
  explanation?: string | null;               // Why this is correct (shown after commit)
  wrongExplanation?: string | null;          // Why they got it wrong (shown when incorrect)
  deepExplanation?: string | null;           // Optional second-layer clarification shown on demand
  commitRequired?: boolean;                  // Whether user must "commit" before seeing feedback (default: true for quiz)
  trickQuestion?: boolean;                   // Marks as trick question; shows extra feedback after lock-in
  shapeMatchPreset?: string;                 // Preset name for SHAPE_MATCH questions
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
  committed?: boolean; // Whether the user has "locked in" this answer
}

interface PollTakerModalProps {
  pollId: string | null;
  onClose: () => void;
  onComplete?: (responseId: string) => void;
  /** Pass PollBuilderData directly for preview mode (no API fetch, no submit) */
  previewData?: {
    title: string;
    description: string;
    type: string;
    allowPartialSubmission: boolean;
    showProgressBar: boolean;
    randomizeQuestions: boolean;
    questions: Array<{
      id: string;
      type: string;
      questionText: string;
      description?: string;
      required: boolean;
      allowImages: boolean;
      options: Array<{ id: string; text: string; description?: string; value?: number; imageUrl?: string }>;
      sliderConfig?: any;
      shapeMatchPreset?: string;
      shapeMatchConfig?: any;
      correctAnswer?: string | string[] | null;
      explanation?: string | null;
      wrongExplanation?: string | null;
      deepExplanation?: string | null;
      commitRequired?: boolean;
      trickQuestion?: boolean;
      order?: number;
    }>;
    sections: Array<{
      id: string;
      title: string;
      description?: string;
      icon?: string;
      flow: Array<{ type: string; id: string }>;
    }>;
    flow: Array<{ type: string; id: string }>;
  } | null;
}

/** Convert PollBuilderData to the PollData shape that PollTakerModal expects */
function builderDataToPollData(bd: NonNullable<PollTakerModalProps['previewData']>): PollData {
  // Build ordered question list from flow
  const orderedQuestions: PollQuestion[] = [];
  let order = 0;

  const addQuestionsFromFlow = (flow: Array<{ type: string; id: string }>) => {
    for (const item of flow) {
      if (item.type === 'QUESTION') {
        const q = bd.questions.find(qq => qq.id === item.id);
        if (q) {
          order++;
          orderedQuestions.push({
            id: q.id,
            text: q.questionText,
            questionText: q.questionText,
            description: q.description || null,
            type: q.type,
            order,
            isRequired: q.required,
            allowImages: q.allowImages,
            allowComments: false,
            sliderConfig: q.sliderConfig ? {
              min: q.sliderConfig.min ?? q.sliderConfig.minValue,
              max: q.sliderConfig.max ?? q.sliderConfig.maxValue,
              step: q.sliderConfig.step,
              labels: q.sliderConfig.stepLabels,
              showValue: q.sliderConfig.showValue,
            } : null,
            options: (q.options || []).map((o, idx) => ({
              id: o.id,
              text: o.text,
              order: idx,
              value: o.value ?? null,
              imageUrl: o.imageUrl ?? null,
            })),
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || null,
            wrongExplanation: q.wrongExplanation || null,
            deepExplanation: q.deepExplanation || null,
            commitRequired: q.commitRequired,
            trickQuestion: q.trickQuestion,
            shapeMatchPreset: q.shapeMatchPreset,
          });
        }
      } else if (item.type === 'SECTION') {
        const sec = bd.sections.find(s => s.id === item.id);
        if (sec) addQuestionsFromFlow(sec.flow);
      }
    }
  };

  addQuestionsFromFlow(bd.flow);

  // If no flow-based ordering, fall back to flat list
  if (orderedQuestions.length === 0) {
    for (const q of bd.questions) {
      order++;
      orderedQuestions.push({
        id: q.id,
        text: q.questionText,
        questionText: q.questionText,
        description: q.description || null,
        type: q.type,
        order: q.order ?? order,
        isRequired: q.required,
        allowImages: q.allowImages,
        allowComments: false,
        sliderConfig: q.sliderConfig ? {
          min: q.sliderConfig.min ?? q.sliderConfig.minValue,
          max: q.sliderConfig.max ?? q.sliderConfig.maxValue,
          step: q.sliderConfig.step,
          labels: q.sliderConfig.stepLabels,
          showValue: q.sliderConfig.showValue,
        } : null,
        options: (q.options || []).map((o, idx) => ({
          id: o.id,
          text: o.text,
          order: idx,
          value: o.value ?? null,
          imageUrl: o.imageUrl ?? null,
        })),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || null,
        wrongExplanation: q.wrongExplanation || null,
        deepExplanation: q.deepExplanation || null,
        commitRequired: q.commitRequired,
        trickQuestion: q.trickQuestion,
        shapeMatchPreset: q.shapeMatchPreset,
      });
    }
  }

  return {
    id: 'preview-' + Date.now(),
    title: bd.title || 'Untitled Poll',
    description: bd.description || null,
    type: (bd.type || 'SURVEY') as PollData['type'],
    creatorId: 'preview',
    isAnonymous: false,
    allowPartial: bd.allowPartialSubmission,
    requiresAuth: false,
    totalResponses: 0,
    avgCompletionPct: 0,
    questions: orderedQuestions,
    creator: { id: 'preview', name: 'Preview Mode' },
  };
}

// ─── SECTION GROUPING ──────────────────────────────────────────────────────

interface Section {
  id: string;
  title: string;
  icon: string;
  description?: string;
  questions: PollQuestion[];
}

type Screen = "welcome" | "section-select" | "question" | "complete" | "results";

function estimateMinutes(totalQuestions: number): number {
  return Math.max(3, Math.round(totalQuestions * 0.5));
}

function getPollTheme(type: string) {
  switch (type) {
    case "QUIZ":
      return { gradient: "from-violet-500 via-purple-500 to-fuchsia-500", accent: "text-violet-500", accentLight: "text-violet-400", badge: "bg-violet-500/20 text-violet-400" };
    case "FEEDBACK":
      return { gradient: "from-blue-500 via-cyan-500 to-teal-500", accent: "text-blue-500", accentLight: "text-blue-400", badge: "bg-blue-500/20 text-blue-400" };
    case "REACH_ASSESSMENT":
      return { gradient: "from-emerald-500 via-cyan-500 to-blue-500", accent: "text-emerald-500", accentLight: "text-emerald-400", badge: "bg-emerald-500/20 text-emerald-400" };
    default:
      return { gradient: "from-amber-500 via-orange-500 to-red-500", accent: "text-amber-500", accentLight: "text-amber-400", badge: "bg-amber-500/20 text-amber-400" };
  }
}

function getQuestionTypeIcon(type: string) {
  switch (type) {
    case "SINGLE_CHOICE": return <ListChecks className="h-3.5 w-3.5" />;
    case "MULTI_CHOICE": return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "SLIDER": case "SCALE": return <SlidersHorizontal className="h-3.5 w-3.5" />;
    case "RANKING": return <BarChart3 className="h-3.5 w-3.5" />;
    case "TEXT": return <FileText className="h-3.5 w-3.5" />;
    default: return <Target className="h-3.5 w-3.5" />;
  }
}

function getQuestionTypeLabel(type: string) {
  switch (type) {
    case "SINGLE_CHOICE": return "Single choice";
    case "MULTI_CHOICE": return "Multiple choice";
    case "SLIDER": return "Slider";
    case "SCALE": return "Scale";
    case "RANKING": return "Ranking";
    case "TEXT": return "Open text";
    default: return type;
  }
}

function sectionAnsweredCount(section: Section, answers: Record<string, QuestionAnswer>): number {
  return section.questions.filter(q => answers[q.id]?.value !== undefined).length;
}

// Parse AI trust score from poll description (embedded by generation endpoint)
function parseTrustInfo(description?: string | null): { score: number | null; factor: string | null } | null {
  if (!description) return null;
  const match = description.match(/Estimated truthfulness\/quality:\s*(\d+)\/100/);
  if (!match) return null;
  const score = parseInt(match[1], 10);
  const factor = score >= 80 ? "High" : score >= 55 ? "Medium" : "Low";
  return { score, factor };
}

// Find all unanswered question indices across all sections
function findUnansweredQuestions(sections: Section[], answers: Record<string, QuestionAnswer>): Array<{ sectionIdx: number; questionIdx: number; question: PollQuestion }> {
  const unanswered: Array<{ sectionIdx: number; questionIdx: number; question: PollQuestion }> = [];
  sections.forEach((section, sectionIdx) => {
    section.questions.forEach((question, questionIdx) => {
      if (answers[question.id]?.value === undefined) {
        unanswered.push({ sectionIdx, questionIdx, question });
      }
    });
  });
  return unanswered;
}

function normalizeTextTokensForCoverage(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[-_.,;:!?\'"()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function hasMinimumTokenCoverageForAiCheck(userAnswer: string, correctAnswer: string): boolean {
  const correctTokens = normalizeTextTokensForCoverage(correctAnswer);
  const userTokens = normalizeTextTokensForCoverage(userAnswer);
  if (correctTokens.length <= 1) return userTokens.length >= 1;
  return userTokens.length >= Math.ceil(correctTokens.length / 2);
}

function getNumericBoundsForQuestion(question: PollQuestion): { min: number; max: number; step: number } {
  const cfg = question.sliderConfig ?? {};
  const fallbackMin = question.type === "SCALE" ? 1 : 1;
  const fallbackMax = question.type === "SCALE" ? 10 : 7;
  const fallbackStep = question.type === "SCALE" ? 1 : 1;

  const min = typeof cfg.min === "number" && Number.isFinite(cfg.min) ? cfg.min : fallbackMin;
  const max = typeof cfg.max === "number" && Number.isFinite(cfg.max) ? cfg.max : fallbackMax;
  const step = typeof cfg.step === "number" && Number.isFinite(cfg.step) && cfg.step > 0 ? cfg.step : fallbackStep;

  if (max <= min) {
    return { min: fallbackMin, max: fallbackMax, step: fallbackStep };
  }

  return { min, max, step };
}

function snapToSelectableValue(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  const stepsFromMin = Math.round((clamped - min) / step);
  const snapped = min + stepsFromMin * step;
  return Math.min(max, Math.max(min, snapped));
}

function getNormalizedCorrectNumericAnswer(question: PollQuestion, rawCorrectAnswer: unknown): number | null {
  const numeric = typeof rawCorrectAnswer === "number"
    ? rawCorrectAnswer
    : typeof rawCorrectAnswer === "string"
      ? parseFloat(rawCorrectAnswer)
      : NaN;

  if (!Number.isFinite(numeric)) return null;

  const { min, max, step } = getNumericBoundsForQuestion(question);
  if (numeric < min || numeric > max) return null;

  let normalized = snapToSelectableValue(numeric, min, max, step);
  if (question.type === "SCALE") {
    normalized = Math.round(normalized);
  }

  return Number(normalized.toFixed(6));
}

// Calculate quiz score (correct answers / total questions with correct answers)
// Async: TEXT answers that fail fuzzy match get a second opinion from AI (Groq, ~200ms).
async function calculateQuizScore(
  sections: Section[],
  answers: Record<string, QuestionAnswer>
): Promise<{ correct: number; total: number; bySection: Array<{ section: Section; correct: number; total: number }>; aiVerified: string[] }> {
  let totalCorrect = 0;
  let totalGraded = 0;
  const bySection: Array<{ section: Section; correct: number; total: number }> = [];
  // Track TEXT questions that fuzzy rejected but AI verified correct
  const pendingAiChecks: Array<{ questionId: string; sectionIdx: number; userAnswer: string; correctAnswer: string; questionText: string }> = [];

  sections.forEach((section, sectionIdx) => {
    let sectionCorrect = 0;
    let sectionGraded = 0;

    section.questions.forEach((question) => {
      const answer = answers[question.id];
      if (!answer?.value) return;

      // Get correct answer (check sliderConfig for SLIDER/SCALE)
      const sliderConfig = question.sliderConfig as { correctAnswer?: string } | null;
      const correctAnswer = question.correctAnswer ?? sliderConfig?.correctAnswer;
      if (!correctAnswer) return; // No correct answer defined

      sectionGraded++;
      totalGraded++;

      // Check if answer is correct
      const userAnswer = answer.value;

      // RANKING: exact order
      if (question.type === "RANKING" && Array.isArray(correctAnswer) && Array.isArray(userAnswer)) {
        if (JSON.stringify(correctAnswer) === JSON.stringify(userAnswer)) {
          sectionCorrect++;
          totalCorrect++;
        }
        return;
      }

      // MULTI_CHOICE: same elements
      if (Array.isArray(correctAnswer) && Array.isArray(userAnswer)) {
        if (correctAnswer.length === userAnswer.length && correctAnswer.every(a => userAnswer.includes(a))) {
          sectionCorrect++;
          totalCorrect++;
        }
        return;
      }

      // TEXT: fuzzy match with requiresExactMatch guard + AI fallback for rejections
      if (question.type === "TEXT" && typeof correctAnswer === "string" && typeof userAnswer === "string") {
        const prompt = (question.questionText ?? question.text ?? "").toLowerCase();
        const description = (question.description ?? "").toLowerCase();
        const requiresExactMatch =
          prompt.includes("type exactly") ||
          description.includes("case and punctuation must be exact") ||
          description.includes("case-sensitive");

        if (requiresExactMatch) {
          if (correctAnswer === userAnswer) { sectionCorrect++; totalCorrect++; }
          return;
        }

        if (fuzzyTextMatch(userAnswer, correctAnswer)) {
          sectionCorrect++;
          totalCorrect++;
        } else if (hasMinimumTokenCoverageForAiCheck(userAnswer, correctAnswer)) {
          // Queue for AI verification — don't mark wrong yet
          pendingAiChecks.push({
            questionId: question.id,
            sectionIdx,
            userAnswer,
            correctAnswer,
            questionText: question.questionText ?? question.text ?? "",
          });
        }
        return;
      }

      // SLIDER/SCALE: numeric comparison
      if ((question.type === "SLIDER" || question.type === "SCALE") && typeof correctAnswer === "string") {
        const numCorrect = getNormalizedCorrectNumericAnswer(question, correctAnswer);
        const userVal = typeof userAnswer === "number" ? userAnswer : parseFloat(String(userAnswer));
        if (numCorrect === null || Number.isNaN(userVal)) {
          sectionGraded--;
          totalGraded--;
          return;
        }
        if (numCorrect !== null && !Number.isNaN(userVal) && Math.abs(numCorrect - userVal) <= 1e-6) {
          sectionCorrect++;
          totalCorrect++;
        }
        return;
      }

      // SINGLE_CHOICE: string match
      if (typeof correctAnswer === "string" && typeof userAnswer === "string") {
        if (correctAnswer === userAnswer) {
          sectionCorrect++;
          totalCorrect++;
        }
      }
    });

    bySection.push({ section, correct: sectionCorrect, total: sectionGraded });
  });

  // AI verification pass — batch all pending TEXT checks in parallel
  const aiVerified: string[] = [];
  if (pendingAiChecks.length > 0) {
    const results = await Promise.allSettled(
      pendingAiChecks.map((check) =>
        aiVerifyTextAnswer(check.userAnswer, check.correctAnswer, check.questionText)
          .then((ok) => ({ ...check, ok }))
      )
    );
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.ok) {
        totalCorrect++;
        const sectionEntry = bySection[result.value.sectionIdx];
        if (sectionEntry) sectionEntry.correct++;
        aiVerified.push(result.value.questionId);
      }
    }
  }

  return { correct: totalCorrect, total: totalGraded, bySection, aiVerified };
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────

export function PollTakerModal({ pollId, onClose, onComplete, previewData }: PollTakerModalProps) {
  const isPreviewMode = !!previewData;
  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});

  // Screen-based navigation (like ReachPollV3)
  const [screen, setScreen] = useState<Screen>("welcome");
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [missingMode, setMissingMode] = useState(false);
  const [missingQueue, setMissingQueue] = useState<Array<{ sectionIdx: number; questionIdx: number }>>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Reset modal-local state whenever the opened poll changes.
  useEffect(() => {
    if (!pollId) return;
    setPoll(null);
    setAnswers({});
    setShowComments({});
    setScreen("welcome");
    setCurrentSectionIdx(0);
    setCurrentQuestionIdx(0);
    setSlideDirection(1);
    setIsSubmitting(false);
    setAuthRequired(false);
    setMissingMode(false);
    setMissingQueue([]);
    setError(null);
  }, [pollId, previewData]);

  // Preview mode: convert builder data directly, skip API fetch
  useEffect(() => {
    if (previewData) {
      setPoll(builderDataToPollData(previewData));
      setLoading(false);
      return;
    }
  }, [previewData]);

  // Fetch poll data
  useEffect(() => {
    if (previewData) return; // Skip fetch in preview mode
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

        // Initialize answers from existing response or from draft (after login return)
        const draftKey = `poll-draft-${data.poll.id}`;
        const draftRaw = typeof window !== "undefined" ? sessionStorage.getItem(draftKey) : null;
        if (draftRaw) {
          try {
            const draft = JSON.parse(draftRaw) as Record<string, QuestionAnswer>;
            setAnswers(draft);
            setScreen("complete");
            sessionStorage.removeItem(draftKey);
          } catch {
            /* ignore invalid draft */
          }
        } else if (data.poll?.userResponse?.answers) {
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

  // Build sections from flat question list (auto-group into ~5-question batches)
  const sections = useMemo((): Section[] => {
    if (!poll?.questions?.length) return [];
    const questions = [...poll.questions].sort((a, b) => a.order - b.order);
    if (questions.length <= 6) {
      return [{ id: "main", title: "Questions", icon: "📋", questions }];
    }
    const sectionSize = questions.length <= 12 ? 4 : questions.length <= 20 ? 5 : 6;
    const result: Section[] = [];
    const icons = ["📋", "🎯", "💡", "⚡", "🔍", "🏆", "📊", "🌟", "🎨", "🚀"];
    for (let i = 0; i < questions.length; i += sectionSize) {
      const n = result.length;
      result.push({
        id: `section-${n + 1}`,
        title: `Section ${n + 1}`,
        icon: icons[n % icons.length],
        questions: questions.slice(i, i + sectionSize),
      });
    }
    return result;
  }, [poll?.questions]);

  const totalQuestions = poll?.questions?.length || 0;
  const currentSection = sections[currentSectionIdx];
  const currentQuestion = currentSection?.questions[currentQuestionIdx];
  const answeredCount = Object.values(answers).filter((a) => a.value !== undefined).length;
  const progressPct = totalQuestions > 0 ? Math.min(100, Math.round((answeredCount / totalQuestions) * 100)) : 0;
  const unanswered = useMemo(() => findUnansweredQuestions(sections, answers), [sections, answers]);

  // Global question number
  const globalQuestionNumber = useMemo(() => {
    let num = 0;
    for (let s = 0; s < currentSectionIdx; s++) num += sections[s]?.questions.length || 0;
    return num + currentQuestionIdx + 1;
  }, [currentSectionIdx, currentQuestionIdx, sections]);

  const theme = useMemo(() => getPollTheme(poll?.type || "SURVEY"), [poll?.type]);

  const handleAnswer = useCallback((questionId: string, answer: QuestionAnswer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }, []);

  const handleCommit = useCallback((questionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], committed: true },
    }));
  }, []);

  const toggleComment = useCallback((questionId: string) => {
    setShowComments((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  }, []);

  // Navigation — one question at a time
  const goNext = useCallback(() => {
    if (!currentSection) return;

    if (missingMode) {
      const currentQuestionId = currentSection.questions[currentQuestionIdx]?.id;
      const queueAfterCurrent = missingQueue.filter((item) => {
        const queuedQuestion = sections[item.sectionIdx]?.questions[item.questionIdx];
        if (!queuedQuestion) return false;
        if (queuedQuestion.id === currentQuestionId) return false;
        return answers[queuedQuestion.id]?.value === undefined;
      });

      if (queueAfterCurrent.length > 0) {
        const nextMissing = queueAfterCurrent[0];
        const movingForward =
          nextMissing.sectionIdx > currentSectionIdx ||
          (nextMissing.sectionIdx === currentSectionIdx && nextMissing.questionIdx > currentQuestionIdx);

        setSlideDirection(movingForward ? 1 : -1);
        setMissingQueue(queueAfterCurrent);
        setCurrentSectionIdx(nextMissing.sectionIdx);
        setCurrentQuestionIdx(nextMissing.questionIdx);
        return;
      }

      setMissingMode(false);
      setMissingQueue([]);
      setScreen("complete");
      return;
    }

    setSlideDirection(1);
    if (currentQuestionIdx < currentSection.questions.length - 1) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
    } else if (currentSectionIdx < sections.length - 1) {
      setCurrentSectionIdx(currentSectionIdx + 1);
      setCurrentQuestionIdx(0);
    } else {
      setScreen("complete");
    }
  }, [answers, currentQuestionIdx, currentSection, currentSectionIdx, missingMode, missingQueue, sections]);

  const goPrev = useCallback(() => {
    setSlideDirection(-1);
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(currentQuestionIdx - 1);
    } else if (currentSectionIdx > 0) {
      const prev = sections[currentSectionIdx - 1];
      setCurrentSectionIdx(currentSectionIdx - 1);
      setCurrentQuestionIdx(prev.questions.length - 1);
    } else {
      setScreen("welcome");
    }
  }, [currentQuestionIdx, currentSectionIdx, sections]);

  // Reset all progress
  const resetProgress = useCallback(() => {
    setAnswers({});
    setShowComments({});
    setMissingMode(false);
    setMissingQueue([]);
    setCurrentSectionIdx(0);
    setCurrentQuestionIdx(0);
    setScreen("welcome");
  }, []);

  // Keyboard + mouse-button navigation (matching ReachPollV3 approach)
  useEffect(() => {
    if (!pollId && !isPreviewMode) return;
    
    const onKey = (e: KeyboardEvent) => {
      if (screen !== "question") return;
      // Don't navigate when user is typing in a textarea
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    };
    
    // Mouse back/forward buttons with capture phase (runs before other handlers)
    const onMouse = (e: MouseEvent) => {
      if (e.button === 3) { 
        e.preventDefault(); 
        e.stopImmediatePropagation();
        if (screen === "question") goPrev();
        else if (screen === "complete") {
          // Guard: only go back to question screen if a valid question exists
          if (sections[currentSectionIdx]?.questions[currentQuestionIdx]) {
            setScreen("question");
          } else {
            setScreen("welcome");
          }
        }
        else if (screen === "section-select") setScreen("welcome");
      }
      if (e.button === 4) { 
        e.preventDefault(); 
        e.stopImmediatePropagation();
        if (screen === "welcome") {
          if (sections[0]?.questions[0]) {
            setCurrentSectionIdx(0);
            setCurrentQuestionIdx(0);
            setScreen("question");
          }
        } else if (screen === "section-select") {
          // Guard: only go to question if current indices are valid
          if (sections[currentSectionIdx]?.questions[currentQuestionIdx]) {
            setScreen("question");
          } else {
            setScreen("welcome");
          }
        } else if (screen === "question") {
          goNext();
        }
      }
    };
    
    // Prevent browser default navigation on these buttons
    const preventBrowserNav = (e: MouseEvent) => {
      if (e.button === 3 || e.button === 4) {
        e.preventDefault();
      }
    };
    
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onMouse, { capture: true });
    window.addEventListener("auxclick", preventBrowserNav);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onMouse, { capture: true });
      window.removeEventListener("auxclick", preventBrowserNav);
    };
  }, [pollId, screen, goNext, goPrev]);

  // Submit
  const handleSubmit = async () => {
    if (!poll) return;
    // Preview mode: skip API call, simulate submission
    if (isPreviewMode) {
      setScreen("results");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setAuthRequired(false);
    try {
      const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => {
        const question = poll.questions.find((q) => q.id === questionId);
        const v = answer.value;
        if (question?.type === "TEXT") {
          return { questionId, textValue: String(v || ""), comment: answer.comment };
        }
        if (Array.isArray(v)) {
          // Ranking: store as JSON array in textValue
          return { questionId, textValue: JSON.stringify(v), comment: answer.comment };
        }
        if (typeof v === "number") {
          return { questionId, sliderValue: v, comment: answer.comment };
        }
        if (typeof v === "string") {
          return { questionId, optionId: v, comment: answer.comment };
        }
        return { questionId, comment: answer.comment };
      }).filter((a) => a.optionId || a.sliderValue !== undefined || a.textValue);
      const res = await fetch(`/api/advanced-polls/${poll.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: formattedAnswers }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Auth required — prompt sign in instead of generic error
        const msg = data.message || "";
        if (res.status === 401 || /authentication|auth required|sign in/i.test(msg)) {
          setAuthRequired(true);
          setIsSubmitting(false);
          // Preserve answers so after login user returns to completion screen
          if (typeof window !== "undefined" && poll?.id) {
            sessionStorage.setItem(`poll-draft-${poll.id}`, JSON.stringify(answers));
          }
          return;
        }
        throw new Error(msg || `Submission failed (${res.status})`);
      }
      // Show results screen instead of closing immediately
      setScreen("results");
      setIsSubmitting(false);
      if (typeof window !== "undefined" && poll?.id) {
        sessionStorage.removeItem(`poll-draft-${poll.id}`);
      }
      onComplete?.(data.response.id);
    } catch (err) {
      console.error("[PollTakerModal] Submit error:", err);
      setError(err instanceof Error ? err.message : "Failed to submit");
      setIsSubmitting(false);
    }
  };

  const jumpToSection = useCallback((idx: number) => {
    setSlideDirection(idx > currentSectionIdx ? 1 : -1);
    setCurrentSectionIdx(idx);
    setCurrentQuestionIdx(0);
    setScreen("question");
  }, [currentSectionIdx]);

  // Jump to a specific question (used by CompletionScreen "Jump to missing" feature)
  const jumpToQuestion = useCallback((sectionIdx: number, questionIdx: number) => {
    setSlideDirection(sectionIdx > currentSectionIdx ? 1 : -1);
    setCurrentSectionIdx(sectionIdx);
    setCurrentQuestionIdx(questionIdx);
    setScreen("question");
  }, [currentSectionIdx]);

  const startMissingFlow = useCallback(() => {
    if (unanswered.length === 0) return;
    const queue = unanswered.map((item) => ({ sectionIdx: item.sectionIdx, questionIdx: item.questionIdx }));
    const first = queue[0];

    setMissingQueue(queue);
    setMissingMode(true);
    jumpToQuestion(first.sectionIdx, first.questionIdx);
  }, [jumpToQuestion, unanswered]);

  const startPoll = useCallback(() => {
    setSlideDirection(1);
    setCurrentSectionIdx(0);
    setCurrentQuestionIdx(0);
    setScreen("question");
  }, []);

  if (!pollId && !isPreviewMode) return null;

  return (
    <Dialog open={!!pollId || isPreviewMode} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-3xl w-[95vw] max-h-[90vh] p-0 overflow-hidden border-zinc-800/50 bg-zinc-950/95 backdrop-blur-xl"
        accessibleTitle={poll?.title || "Poll"}
      >
        <TooltipProvider>
          {loading ? (
            <div className="flex items-center justify-center p-16">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <Target className="h-8 w-8 text-muted-foreground" />
              </motion.div>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-destructive mb-4">{error}</p>
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          ) : poll ? (
            <div ref={containerRef} className="flex flex-col h-[85vh]">
              <AnimatePresence mode="wait">
                {screen === "welcome" && (
                  <WelcomeScreen
                    key="welcome"
                    poll={poll}
                    sections={sections}
                    theme={theme}
                    answeredCount={answeredCount}
                    totalQuestions={totalQuestions}
                    onStart={startPoll}
                    onSelectSection={() => setScreen("section-select")}
                    onReset={resetProgress}
                    onClose={onClose}
                  />
                )}
                {screen === "section-select" && (
                  <SectionSelectScreen
                    key="section-select"
                    sections={sections}
                    answers={answers}
                    theme={theme}
                    onSelect={jumpToSection}
                    onBack={() => setScreen("welcome")}
                  />
                )}
                {screen === "question" && !currentQuestion && (
                  <motion.div
                    key="question-fallback"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center h-full"
                  >
                    <p className="text-muted-foreground">Loading question…</p>
                  </motion.div>
                )}
                {screen === "question" && currentQuestion && (
                  <QuestionScreen
                    key={`q-${currentQuestion.id}`}
                    question={currentQuestion}
                    questionNumber={globalQuestionNumber}
                    totalQuestions={totalQuestions}
                    section={currentSection}
                    sectionIdx={currentSectionIdx}
                    sectionCount={sections.length}
                    answer={answers[currentQuestion.id]}
                    showComment={showComments[currentQuestion.id] || false}
                    answeredCount={answeredCount}
                    progressPct={progressPct}
                    theme={theme}
                    slideDirection={slideDirection}
                    isFirst={currentSectionIdx === 0 && currentQuestionIdx === 0}
                    isLast={currentSectionIdx === sections.length - 1 && currentQuestionIdx === currentSection.questions.length - 1}
                    pollType={poll.type}
                    onAnswer={(val) => handleAnswer(currentQuestion.id, val)}
                    onCommit={() => handleCommit(currentQuestion.id)}
                    onToggleComment={() => toggleComment(currentQuestion.id)}
                    onNext={goNext}
                    onPrev={goPrev}
                    onSectionSelect={() => setScreen("section-select")}
                    answers={answers}
                    trustInfo={parseTrustInfo(poll.description)}
                  />
                )}
                {screen === "complete" && (
                  <CompletionScreen
                    key="complete"
                    poll={poll}
                    sections={sections}
                    answers={answers}
                    answeredCount={answeredCount}
                    totalQuestions={totalQuestions}
                    theme={theme}
                    isSubmitting={isSubmitting}
                    authRequired={authRequired}
                    isPreview={isPreviewMode}
                    onSubmit={handleSubmit}
                    onBack={() => setScreen("question")}
                    onSelectSection={jumpToSection}
                    onStartMissingFlow={startMissingFlow}
                    onClose={onClose}
                  />
                )}
                {screen === "results" && (
                  <ResultsScreen
                    key="results"
                    poll={poll}
                    sections={sections}
                    answers={answers}
                    answeredCount={answeredCount}
                    totalQuestions={totalQuestions}
                    theme={theme}
                    isPreview={isPreviewMode}
                    onClose={onClose}
                  />
                )}
              </AnimatePresence>
            </div>
          ) : null}
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}

// ─── WELCOME SCREEN ────────────────────────────────────────────────────────

function WelcomeScreen({ poll, sections, theme, answeredCount, totalQuestions, onStart, onSelectSection, onReset, onClose }: {
  poll: PollData;
  sections: Section[];
  theme: ReturnType<typeof getPollTheme>;
  answeredCount: number;
  totalQuestions: number;
  onStart: () => void;
  onSelectSection: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const minutes = estimateMinutes(totalQuestions);
  const hasProgress = answeredCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      className="relative flex flex-col items-center justify-center p-8 text-center min-h-full h-full"
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-linear-to-b from-background via-zinc-900/50 to-background overflow-hidden">
        <motion.div
          className={cn("absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20 bg-linear-to-br", theme.gradient)}
          animate={{ x: [0, 50, 0], y: [0, 30, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-linear-to-br from-violet-500/15 to-pink-500/15 blur-3xl"
          animate={{ x: [0, -50, 0], y: [0, -30, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Close */}
      <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-3 right-3 z-20 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </Button>

      <div className="relative z-10 max-w-lg">
        {/* Hero icon */}
        <motion.div
          className="relative mb-8 mx-auto w-fit"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.2 }}
        >
          <div className={cn("w-24 h-24 rounded-3xl p-1 shadow-2xl bg-linear-to-br", theme.gradient)}>
            <div className="w-full h-full rounded-[20px] bg-background/80 backdrop-blur-xl flex items-center justify-center">
              {poll.type === "QUIZ" ? <Crown className="w-12 h-12 text-violet-500" /> :
               <Target className="w-12 h-12 text-amber-500" />}
            </div>
          </div>
          <motion.div
            className={cn("absolute -top-2 -right-2 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg bg-linear-to-br", theme.gradient)}
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
          <DialogTitle className="sr-only">{poll.title}</DialogTitle>
          <h1 className="text-2xl md:text-3xl font-extrabold mb-3">
            <span className={cn("bg-linear-to-r bg-clip-text text-transparent", theme.gradient)}>
              {poll.title.replace(/^[📊🎯🚀⚡💡🔐🛡️🎨🌐📋]+\s*/, '')}
            </span>
          </h1>
        </motion.div>

        {/* Description excerpt */}
        <motion.p className="text-sm text-muted-foreground max-w-md mx-auto mb-2" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
          {poll.description ? poll.description.split('\n').filter(l => l.trim())[0]?.slice(0, 120) || "Share your insights" : "Share your insights and help shape the future"}
        </motion.p>

        <motion.p className="text-xs text-muted-foreground/70 mb-6" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}>
          Skip ahead anytime &bull; Partial completion counts &bull; Every answer matters
        </motion.p>

        {/* Stats row */}
        <motion.div className="flex justify-center gap-6 mb-8" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
          {sections.length > 1 && (
            <div className="text-center">
              <div className={cn("text-2xl font-bold", theme.accent)}>{sections.length}</div>
              <div className="text-xs text-muted-foreground">Sections</div>
            </div>
          )}
          <div className="text-center">
            <div className={cn("text-2xl font-bold", theme.accentLight)}>{totalQuestions}</div>
            <div className="text-xs text-muted-foreground">Questions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">~{minutes}</div>
            <div className="text-xs text-muted-foreground">Minutes</div>
          </div>
        </motion.div>

        {poll.totalResponses > 0 && (
          <motion.p className="text-xs text-muted-foreground/60 mb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}>
            {poll.totalResponses} people have already responded
          </motion.p>
        )}

        {/* CTA buttons */}
        <motion.div className="flex flex-col sm:flex-row gap-3 justify-center" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}>
          <Button
            size="lg"
            onClick={onStart}
            className={cn("relative group px-8 py-6 text-base font-semibold rounded-2xl text-white shadow-2xl overflow-hidden bg-linear-to-r", theme.gradient)}
          >
            <motion.span className="absolute inset-0 bg-linear-to-r from-white/0 via-white/20 to-white/0" animate={{ x: ["-200%", "200%"] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
            <span className="relative flex items-center gap-2">
              {hasProgress ? "Continue" : "Start"}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </Button>

          {sections.length > 1 && (
            <Button size="lg" variant="outline" onClick={onSelectSection} className="px-8 py-6 text-base font-semibold rounded-2xl border-zinc-700 hover:border-zinc-600">
              Choose Section
            </Button>
          )}
        </motion.div>

        {hasProgress && (
          <motion.div className="mt-6 flex flex-col items-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              {answeredCount} of {totalQuestions} answered ({totalQuestions > 0 ? Math.min(100, Math.round((answeredCount / totalQuestions) * 100)) : 0}%)
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              <RotateCcw className="h-3 w-3 mr-1.5" />
              Start Over
            </Button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ─── SECTION SELECT SCREEN ─────────────────────────────────────────────────

function SectionSelectScreen({ sections, answers, theme, onSelect, onBack }: {
  sections: Section[];
  answers: Record<string, QuestionAnswer>;
  theme: ReturnType<typeof getPollTheme>;
  onSelect: (idx: number) => void;
  onBack: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col h-full">
      <div className="p-6 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h2 className="text-lg font-bold">Choose a Section</h2>
            <p className="text-sm text-muted-foreground">Jump to any section</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {sections.map((section, idx) => {
          const answered = sectionAnsweredCount(section, answers);
          const total = section.questions.length;
          const pct = Math.round((answered / total) * 100);
          const isDone = pct === 100;
          return (
            <motion.button
              key={section.id}
              onClick={() => onSelect(idx)}
              className={cn(
                "w-full p-4 rounded-xl text-left transition-all",
                "bg-zinc-900/50 hover:bg-zinc-800/70 border border-zinc-800/50 hover:border-zinc-700/50",
                isDone && "border-emerald-500/30 bg-emerald-500/5"
              )}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{section.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold truncate">{section.title}</h3>
                    <span className="text-xs text-muted-foreground shrink-0">{answered}/{total}</span>
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-zinc-800 overflow-hidden">
                    <motion.div
                      className={cn("h-full rounded-full", isDone ? "bg-emerald-500" : `bg-linear-to-r ${theme.gradient}`)}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: idx * 0.05 + 0.2, duration: 0.5 }}
                    />
                  </div>
                </div>
                {isDone && <Check className="h-5 w-5 text-emerald-500 shrink-0" />}
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── QUESTION SCREEN (one at a time, slide navigation) ─────────────────────

function QuestionScreen({
  question, questionNumber, totalQuestions, section, sectionIdx, sectionCount,
  answer, showComment, answeredCount, progressPct, theme, slideDirection,
  isFirst, isLast, pollType,
  onAnswer, onCommit, onToggleComment, onNext, onPrev, onSectionSelect, answers, trustInfo,
}: {
  question: PollQuestion;
  questionNumber: number;
  totalQuestions: number;
  section: Section;
  sectionIdx: number;
  sectionCount: number;
  answer: QuestionAnswer | undefined;
  showComment: boolean;
  answeredCount: number;
  progressPct: number;
  theme: ReturnType<typeof getPollTheme>;
  slideDirection: 1 | -1;
  isFirst: boolean;
  isLast: boolean;
  pollType: PollData["type"];
  onAnswer: (val: QuestionAnswer) => void;
  onCommit: () => void;
  onToggleComment: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSectionSelect: () => void;
  answers: Record<string, QuestionAnswer>;
  trustInfo?: { score: number | null; factor: string | null } | null;
}) {
  const [showExplanation, setShowExplanation] = useState(false);
  const [showDeepExplanation, setShowDeepExplanation] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowExplanation(false);
      setShowDeepExplanation(false);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [question.id]);
  
  // Shuffle ranking options on first display (so not defaulted to correct order).
  // Ensure shuffled order is never identical to correct order — user must make at least one adjustment.
  const rankingOptionsShuffled = (() => {
    if (question.type !== "RANKING" || !question.options?.length) return question.options?.map((opt) => ({ id: opt.id, label: opt.text })) ?? [];
    const arr = [...question.options];
    const correctOrder = Array.isArray(question.correctAnswer) ? (question.correctAnswer as string[]) : null;
    const idsEqual = (a: { id: string }[], b: string[] | null) =>
      b && a.length === b.length && a.every((x, i) => x.id === b[i]);
    const getDeterministicIndex = (maxExclusive: number, seed: string) => {
      let hash = 0;
      for (let idx = 0; idx < seed.length; idx++) {
        hash = (hash * 31 + seed.charCodeAt(idx)) >>> 0;
      }
      return maxExclusive > 0 ? hash % maxExclusive : 0;
    };

    for (let attempt = 0; attempt < 50; attempt++) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = getDeterministicIndex(i + 1, `${question.id}:${attempt}:${i}`);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      if (!idsEqual(arr, correctOrder)) break;
      // If by chance we got correct order, swap first two
      [arr[0], arr[1]] = [arr[1], arr[0]];
    }
    return arr.map((opt) => ({ id: opt.id, label: opt.text }));
  })();
  
  const handleValueChange = (value: string | string[] | number | undefined) => {
    onAnswer({ value, comment: answer?.comment });
  };

  const handleCommentChange = (comment: string) => {
    onAnswer({ value: answer?.value ?? undefined, comment });
  };

  const sliderConfig = question.sliderConfig || {};
  const sliderMin = typeof sliderConfig.min === "number" ? sliderConfig.min : 1;
  const sliderMax = typeof sliderConfig.max === "number" ? sliderConfig.max : 7;
  const sliderLabels = Array.isArray(sliderConfig.labels) && sliderConfig.labels.length >= 2 ? sliderConfig.labels : undefined;
  const sliderStepFromConfig = typeof sliderConfig.step === "number" && sliderConfig.step > 0 ? sliderConfig.step : undefined;
  const sliderStepFromLabels =
    sliderLabels && sliderLabels.length > 1
      ? (sliderMax - sliderMin) / (sliderLabels.length - 1)
      : undefined;
  const sliderStepFromSteps =
    typeof sliderConfig.steps === "number" && sliderConfig.steps > 1
      ? (sliderMax - sliderMin) / (sliderConfig.steps - 1)
      : undefined;
  const sliderStep =
    (typeof sliderStepFromLabels === "number" && Number.isFinite(sliderStepFromLabels) && sliderStepFromLabels > 0
      ? sliderStepFromLabels
      : undefined) ??
    sliderStepFromConfig ??
    (typeof sliderStepFromSteps === "number" && Number.isFinite(sliderStepFromSteps) && sliderStepFromSteps > 0
      ? sliderStepFromSteps
      : undefined) ??
    1;
  const isAnswered = answer?.value !== undefined;
  const isCommitted = answer?.committed === true;
  
  // Quiz feedback logic - determine if this question needs a commit before showing feedback
  const isQuiz = pollType === "QUIZ";
  // Check for correctAnswer on question level OR in sliderConfig (for SLIDER/SCALE questions)
  const sliderCorrectAnswer = (sliderConfig as { correctAnswer?: string })?.correctAnswer;
  const effectiveCorrectAnswer = question.correctAnswer ?? sliderCorrectAnswer;
  const hasCorrectAnswer = effectiveCorrectAnswer !== undefined && effectiveCorrectAnswer !== null;
  // Questions with correct answers OR quiz type need commit before showing feedback
  const needsCommit = hasCorrectAnswer || (isQuiz && question.commitRequired !== false);
  // Show feedback only after commit (or immediately if no commit needed)
  const showFeedback = isAnswered && (!needsCommit || isCommitted);
  
  const isCorrect = (() => {
    if (!isAnswered || !hasCorrectAnswer || !isQuiz) return null;
    const correctAns = effectiveCorrectAnswer;
    const userAns = answer?.value;
    
    // Ranking: check if EXACT order matches (must check before multi-choice)
    if (question.type === "RANKING" && Array.isArray(correctAns) && Array.isArray(userAns)) {
      return JSON.stringify(correctAns) === JSON.stringify(userAns);
    }
    
    // Multi-choice: check if same elements (any order)
    if (Array.isArray(correctAns) && Array.isArray(userAns)) {
      return correctAns.length === userAns.length && correctAns.every((a) => userAns.includes(a));
    }
    
    // TEXT question: exact match mode for explicitly strict prompts, otherwise fuzzy-tolerant comparison
    if (question.type === "TEXT" && typeof correctAns === "string" && typeof userAns === "string") {
      const prompt = (question.questionText ?? question.text ?? "").toLowerCase();
      const description = (question.description ?? "").toLowerCase();
      const requiresExactMatch =
        prompt.includes("type exactly") ||
        description.includes("case and punctuation must be exact") ||
        description.includes("case-sensitive");

      if (requiresExactMatch) {
        return correctAns === userAns;
      }

      return fuzzyTextMatch(userAns, correctAns);
    }

    // Slider/scale: compare against a selectable normalized numeric answer
    if (question.type === "SLIDER" || question.type === "SCALE") {
      const normalizedCorrect = getNormalizedCorrectNumericAnswer(question, correctAns);
      const userVal = typeof userAns === "number" ? userAns : parseFloat(String(userAns));
      if (normalizedCorrect === null) {
        return null;
      }
      if (normalizedCorrect !== null && Number.isFinite(userVal)) {
        return Math.abs(normalizedCorrect - userVal) <= 1e-6;
      }
      return false;
    }
    
    // String comparison (single choice - exact ID match)
    if (typeof correctAns === "string" && typeof userAns === "string") {
      return correctAns === userAns;
    }
    
    return null;
  })();

  const deepRangeHelp = (() => {
    if (isCorrect !== false) return null;
    if (question.type !== "SLIDER" && question.type !== "SCALE") return null;

    const selectedValue = typeof answer?.value === "number" ? answer.value : NaN;
    const numericCorrect = getNormalizedCorrectNumericAnswer(question, effectiveCorrectAnswer);
    if (Number.isNaN(selectedValue) || numericCorrect === null) return null;

    const min = sliderMin;
    const max = sliderMax;
    const step = sliderStep;

    const formatValue = (value: number) => (Number.isInteger(value) ? `${value}` : `${value.toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")}`);
    const buildRange = (from: number, to: number) => {
      if (to < from) return [] as number[];
      const values: number[] = [];
      for (let value = from; value <= to + 1e-9; value += step) {
        values.push(Number(value.toFixed(6)));
        if (values.length >= 30) break;
      }
      return values;
    };

    const expectedHighlighted = buildRange(min, numericCorrect);
    const currentHighlighted = buildRange(min, selectedValue);
    const remainingUnselected = selectedValue < max ? buildRange(selectedValue + step, max) : [];

    return {
      min,
      selectedValue,
      numericCorrect,
      expectedHighlighted,
      currentHighlighted,
      remainingUnselected,
      formatValue,
    };
  })();

  const deepWordHelp = (() => {
    if (isCorrect !== false) return null;
    if (question.type !== "MULTI_CHOICE" && question.type !== "SINGLE_CHOICE") return null;

    const prompt = (question.questionText ?? question.text ?? "").toLowerCase();
    if (!prompt.includes("contain the word") || !prompt.includes("correct")) return null;

    const normalize = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);

    const optionsWithWord = question.options
      .filter((option) => normalize(option.text).includes("correct"))
      .map((option) => option.text);

    const optionsWithSubstringOnly = question.options
      .filter((option) => {
        const raw = option.text.toLowerCase();
        const hasSubstring = raw.includes("correct");
        const hasWholeWord = normalize(option.text).includes("correct");
        return hasSubstring && !hasWholeWord;
      })
      .map((option) => option.text);

    const selectedIds = Array.isArray(answer?.value)
      ? (answer?.value as string[])
      : typeof answer?.value === "string"
        ? [answer.value]
        : [];

    const selectedTexts = selectedIds
      .map((id) => question.options.find((option) => option.id === id)?.text)
      .filter((value): value is string => Boolean(value));

    if (optionsWithWord.length === 0 && optionsWithSubstringOnly.length === 0) return null;

    return {
      optionsWithWord,
      optionsWithSubstringOnly,
      selectedTexts,
    };
  })();

  const dynamicWrongTip = (() => {
    if (isCorrect !== false) return null;
    if (question.type !== "MULTI_CHOICE" && question.type !== "SINGLE_CHOICE") return null;

    const prompt = (question.questionText ?? question.text ?? "").toLowerCase();
    if (!prompt.includes("contain the word") || !prompt.includes("correct")) return null;

    const selectedIds = Array.isArray(answer?.value)
      ? (answer.value as string[])
      : typeof answer?.value === "string"
        ? [answer.value]
        : [];

    if (selectedIds.length === 0) return null;

    const normalize = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);

    const hasStandaloneCorrect = (text: string) => normalize(text).includes("correct");
    const hasSubstringOnly = (text: string) => text.toLowerCase().includes("correct") && !hasStandaloneCorrect(text);

    const selectedOptions = selectedIds
      .map((id) => question.options.find((option) => option.id === id))
      .filter((option): option is PollOption => Boolean(option));

    const selectedWithWord = selectedOptions.filter((option) => hasStandaloneCorrect(option.text));
    const selectedSubstringOnly = selectedOptions.filter((option) => hasSubstringOnly(option.text));
    const selectedNoMatch = selectedOptions.filter((option) => !hasStandaloneCorrect(option.text) && !hasSubstringOnly(option.text));

    const requiredOptions = question.options.filter((option) => hasStandaloneCorrect(option.text));
    const missingRequired = requiredOptions.filter((option) => !selectedWithWord.some((picked) => picked.id === option.id));

    if (selectedNoMatch.length > 0) {
      const firstInvalid = selectedNoMatch[0].text;
      const missingText = missingRequired.length > 0
        ? ` You still needed: ${missingRequired.map((option) => `"${option.text}"`).join(", ")}.`
        : "";
      return `"${firstInvalid}" does not contain the standalone word "correct".${missingText}`;
    }

    if (selectedSubstringOnly.length > 0) {
      const firstSubstringOnly = selectedSubstringOnly[0].text;
      const missingText = missingRequired.length > 0
        ? ` You still needed: ${missingRequired.map((option) => `"${option.text}"`).join(", ")}.`
        : "";
      return `"${firstSubstringOnly}" contains the letters c-o-r-r-e-c-t, but not the standalone word "correct".${missingText}`;
    }

    if (missingRequired.length > 0) {
      return `You missed required option${missingRequired.length > 1 ? "s" : ""}: ${missingRequired.map((option) => `"${option.text}"`).join(", ")}.`;
    }

    return null;
  })();

  const deepRankingHelp = (() => {
    if (isCorrect !== false) return null;
    if (question.type !== "RANKING") return null;
    if (!Array.isArray(effectiveCorrectAnswer) || !Array.isArray(answer?.value)) return null;

    const expected = effectiveCorrectAnswer as string[];
    const selected = answer.value as string[];
    if (expected.length === 0 || selected.length !== expected.length) return null;

    const correctPositions = expected.reduce((count, id, index) => count + (selected[index] === id ? 1 : 0), 0);
    const mismatchedIndices = expected
      .map((id, index) => ({ id, index }))
      .filter(({ id, index }) => selected[index] !== id)
      .map(({ index }) => index);

    const ordinal = (n: number) => {
      const mod100 = n % 100;
      if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
      const mod10 = n % 10;
      if (mod10 === 1) return `${n}st`;
      if (mod10 === 2) return `${n}nd`;
      if (mod10 === 3) return `${n}rd`;
      return `${n}th`;
    };

    const isSingleSwap =
      mismatchedIndices.length === 2 &&
      selected[mismatchedIndices[0]] === expected[mismatchedIndices[1]] &&
      selected[mismatchedIndices[1]] === expected[mismatchedIndices[0]];

    if (isSingleSwap) {
      const leftPos = mismatchedIndices[0] + 1;
      const rightPos = mismatchedIndices[1] + 1;
      return `Almost perfect. You got ${correctPositions} out of ${expected.length} positions right.\n\nOnly one swap is needed: switch the ${ordinal(leftPos)} and ${ordinal(rightPos)} positions.`;
    }

    return `You got ${correctPositions} out of ${expected.length} positions right.\n\nCompare each row with the target order and fix only the rows that differ.`;
  })();

  const customDeepHelp = useMemo(() => {
    if (typeof question.deepExplanation !== "string") return null;
    const trimmed = question.deepExplanation.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [question.deepExplanation]);

  const wrongExplanationDetail = (() => {
    if (isCorrect !== false) return null;

    if (question.type === "RANKING" && Array.isArray(effectiveCorrectAnswer) && Array.isArray(answer?.value)) {
      const expectedIds = effectiveCorrectAnswer as string[];
      const selectedIds = answer.value as string[];
      if (expectedIds.length !== selectedIds.length || expectedIds.length === 0) return null;

      const toText = (id: string) => question.options.find((option) => option.id === id)?.text ?? id;
      const correctPositions = expectedIds.reduce((count, id, index) => count + (selectedIds[index] === id ? 1 : 0), 0);
      const expectedOrder = expectedIds.map(toText).join(" → ");
      const yourOrder = selectedIds.map(toText).join(" → ");

      return `The ranking task requires a perfect top-to-bottom order. You got ${correctPositions}/${expectedIds.length} positions correct. Expected: ${expectedOrder}. Your order: ${yourOrder}.`;
    }

    if (question.type === "TEXT" && typeof effectiveCorrectAnswer === "string" && typeof answer?.value === "string") {
      const expected = effectiveCorrectAnswer;
      const actual = answer.value;

      const issues: string[] = [];
      const trailingSpaces = actual.length - actual.trimEnd().length;
      const leadingSpaces = actual.length - actual.trimStart().length;
      if (leadingSpaces > 0) issues.push(`${leadingSpaces} extra leading space${leadingSpaces > 1 ? "s" : ""}`);
      if (trailingSpaces > 0) issues.push(`${trailingSpaces} extra trailing space${trailingSpaces > 1 ? "s" : ""}`);

      if (actual.trim() === expected.trim() && actual !== expected && issues.length > 0) {
        return `You were very close. Expected exactly "${expected}", but you entered ${issues.join(" and ")}.`;
      }

      if (actual.trim().toLowerCase() === expected.trim().toLowerCase() && actual.trim() !== expected.trim()) {
        return `You matched the letters but not the exact casing/punctuation. Expected exactly "${expected}".`;
      }

      return `This field requires an exact match. Expected "${expected}", but your input was "${actual}".`;
    }

    return null;
  })();

  const explanationContent = (() => {
    if (isCorrect === false) {
      return wrongExplanationDetail ?? question.wrongExplanation ?? question.explanation ?? null;
    }
    return question.explanation ?? null;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, x: slideDirection * 80 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: slideDirection * -80 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col h-full"
    >
      {/* Compact header with section + progress */}
      <div className="px-4 pt-3 pb-2 border-b border-zinc-800/30">
        <div className="flex items-center justify-between gap-2 mb-2">
          {sectionCount > 1 ? (
            <button onClick={onSectionSelect} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <span>{section.icon}</span>
              <span className="font-medium">{section.title}</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">Questions</span>
          )}
          <span className="text-xs text-muted-foreground">{answeredCount}/{totalQuestions}</span>
        </div>
        <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
          <motion.div className={cn("h-full rounded-full bg-linear-to-r", theme.gradient)} initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.3 }} />
        </div>
      </div>

      {/* Question content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* Question badge + type */}
          <div className="flex items-center gap-2 mb-4">
            <span className={cn("flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full", theme.badge)}>Q{questionNumber}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {getQuestionTypeIcon(question.type)}
              {getQuestionTypeLabel(question.type)}
            </span>
            {question.isRequired && <span className="text-[10px] text-red-400/80 font-medium">Required</span>}
            {trustInfo?.score != null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn(
                    "ml-auto flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full cursor-help",
                    trustInfo.factor === "High" && "bg-emerald-500/15 text-emerald-400",
                    trustInfo.factor === "Medium" && "bg-amber-500/15 text-amber-400",
                    trustInfo.factor === "Low" && "bg-red-500/15 text-red-400",
                  )}>
                    <Sparkles className="w-3 h-3" />
                    Trust: {trustInfo.factor}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  AI-generated · Confidence: {trustInfo.score}/100
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          <h2 className="text-xl md:text-2xl font-bold mb-2 leading-snug">{question.text}</h2>
          {question.description && <p className="text-sm text-muted-foreground mb-6">{question.description}</p>}

          {/* Question input */}
          <div className="mt-6">
            {(question.type === "SLIDER" || question.type === "SCALE") && (
              <SliderQuestion
                questionId={question.id}
                questionText=""
                minValue={sliderMin}
                maxValue={sliderMax}
                step={sliderStep}
                minLabel={sliderLabels?.[0] ?? "A"}
                maxLabel={sliderLabels?.[sliderLabels?.length - 1 || 0] ?? "G"}
                stepLabels={sliderLabels}
                value={answer?.value as number | undefined}
                onChange={handleValueChange}
                disabled={isCommitted}
              />
            )}

            {(question.type === "SINGLE_CHOICE" || question.type === "MULTI_CHOICE") && (
              <ChoiceQuestion
                questionId={question.id}
                questionText=""
                options={question.options.map((opt) => ({ id: opt.id, text: opt.text }))}
                selectedValue={
                  question.type === "MULTI_CHOICE"
                    ? (answer?.value as string[] | undefined)
                    : (answer?.value as string | undefined)
                }
                onChange={(v) => handleValueChange(v as string | string[])}
                multiSelect={question.type === "MULTI_CHOICE"}
                variant="card"
                disabled={isCommitted}
              />
            )}

            {question.type === "SHAPE_MATCH" && (
              <ShapeMatchQuestion
                key={question.id}
                questionId={question.id}
                questionText={question.questionText || question.text || ""}
                description={question.description ?? undefined}
                config={SHAPE_MATCH_PRESETS[question.shapeMatchPreset as keyof typeof SHAPE_MATCH_PRESETS] || SHAPE_MATCH_PRESETS.basicShapes}
                onChange={(placements) => { handleValueChange(Object.values(placements).filter(Boolean).length); }}
                onComplete={(isCorrect) => { handleValueChange(isCorrect ? 100 : 0); onCommit(); }}
                disabled={isCommitted}
              />
            )}

            {question.type === "RANKING" && (
              <RankingQuestion
                questionId={question.id}
                questionText=""
                options={rankingOptionsShuffled}
                value={answer?.value as string[] | undefined}
                onChange={(v) => handleValueChange(v)}
                showMedals={true}
                showRankNumbers={true}
                disabled={isCommitted}
              />
            )}

            {question.type === "UI_ARRANGE" && (
              <UIArrangeQuestion
                questionId={question.id}
                questionText=""
                gridSize={{ cols: 6, rows: 4 }}
                boxes={[...UI_ARRANGE_PRESETS.dashboardLayout.boxes]}
                dropZones={[...UI_ARRANGE_PRESETS.dashboardLayout.dropZones]}
                onChange={(result) => { handleValueChange(result.accuracy ?? 100); }}
              />
            )}

            {question.type === "NESTED" && (
              <NestedQuestionComponent
                question={{
                  id: question.id,
                  text: question.text,
                  type: "choice",
                  options: question.options.map((opt) => ({ id: opt.id, text: opt.text })),
                }}
                onChange={(result) => { handleValueChange(result.allAnswered ? 100 : 0); }}
              />
            )}

            {question.type === "TEXT" && (
              <Textarea
                placeholder="Share your thoughts..."
                value={(answer?.value as string) ?? ""}
                onChange={(e) => handleValueChange(e.target.value)}
                className="min-h-[120px] bg-zinc-900/50 border-zinc-800 focus:border-zinc-600 text-base"
              />
            )}
          </div>

          {/* Comment toggle */}
          {question.allowComments && (
            <div className="mt-4">
              <button
                onClick={onToggleComment}
                className={cn(
                  "flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-colors",
                  showComment 
                    ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" 
                    : "text-muted-foreground border-zinc-700 hover:border-zinc-500 hover:text-foreground bg-zinc-800/50"
                )}
              >
                <MessageSquarePlus className="h-4 w-4" />
                {showComment ? "Hide comment" : "Add a comment"}
              </button>
              <AnimatePresence>
                {showComment && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <Textarea
                      placeholder="Additional thoughts..."
                      value={answer?.comment ?? ""}
                      onChange={(e) => handleCommentChange(e.target.value)}
                      className="mt-2 text-sm min-h-[60px] bg-zinc-900/50 border-zinc-800"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Commit button — shown when answer is selected but not yet committed */}
          {isAnswered && needsCommit && !isCommitted && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
              <Button
                onClick={onCommit}
                className={cn(
                  "w-full py-5 text-base font-semibold rounded-xl text-white shadow-lg",
                  "bg-linear-to-r from-violet-600 via-purple-600 to-fuchsia-600",
                  "hover:from-violet-500 hover:via-purple-500 hover:to-fuchsia-500",
                  "transition-all duration-200"
                )}
              >
                <span className="flex items-center justify-center gap-2">
                  <Target className="h-5 w-5" />
                  Lock In Answer
                </span>
              </Button>
              <p className="text-[11px] text-center text-muted-foreground/60 mt-2">
                Once committed, you&apos;ll see if you got it right
              </p>
            </motion.div>
          )}

          {/* Feedback — shown after commit (or immediately if no commit needed) */}
          {isAnswered && showFeedback && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-3">
              {isQuiz && isCorrect !== null ? (
                <div className="space-y-4">
                  {/* Main feedback card - more prominent */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className={cn(
                      "flex flex-col gap-3 px-5 py-4 rounded-2xl border-2",
                      isCorrect 
                        ? "bg-emerald-500/15 border-emerald-500/50 shadow-lg shadow-emerald-500/10" 
                        : "bg-red-500/15 border-red-500/50 shadow-lg shadow-red-500/10"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <motion.div
                        initial={{ rotate: -45, scale: 0 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.1 }}
                        className={cn(
                          "shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                          isCorrect ? "bg-emerald-500/30" : "bg-red-500/30"
                        )}
                      >
                        {isCorrect ? (
                          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                        ) : (
                          <X className="h-6 w-6 text-red-400" />
                        )}
                      </motion.div>
                      <div className="flex-1">
                        <motion.h4 
                          initial={{ x: -10, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.15 }}
                          className={cn(
                            "text-lg font-bold",
                            isCorrect ? "text-emerald-400" : "text-red-400"
                          )}
                        >
                          {isCorrect ? "✓ Correct!" : "✗ Incorrect"}
                        </motion.h4>
                      </div>
                    </div>
                    
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className={cn(
                        "text-sm leading-relaxed",
                        isCorrect ? "text-emerald-300/90" : "text-red-300/90"
                      )}
                    >
                      {isCorrect ? (
                        <>
                          {(question.type === "SLIDER" || question.type === "SCALE") && "You managed to slide it to the correct slot!"}
                          {question.type === "RANKING" && "Great job! You arranged them correctly."}
                          {question.type === "TEXT" && "You typed the correct answer!"}
                          {question.type !== "SLIDER" && question.type !== "SCALE" && question.type !== "RANKING" && question.type !== "TEXT" && "You selected the right answer."}
                          {question.trickQuestion && " Good job catching the trick question!"}
                        </>
                      ) : (
                        <>
                          {(question.type === "SLIDER" || question.type === "SCALE") && (() => {
                            const correctAns = effectiveCorrectAnswer;
                            const numCorrect = typeof correctAns === "string" ? parseFloat(correctAns) : NaN;
                            const userVal = typeof answer?.value === "number" ? answer.value : NaN;
                            if (!Number.isNaN(numCorrect) && !Number.isNaN(userVal)) {
                              const distance = Math.abs(userVal - numCorrect);
                              return `You were ${distance} step${distance !== 1 ? "s" : ""} away. The correct answer is ${numCorrect}.`;
                            }
                            return `The correct answer is ${!Number.isNaN(numCorrect) ? numCorrect : correctAns}.`;
                          })()}
                          {question.type === "RANKING" && "The order wasn't quite right."}
                          {question.type === "TEXT" && `Not quite! The correct answer is "${effectiveCorrectAnswer}".`}
                          {question.type !== "SLIDER" && question.type !== "SCALE" && question.type !== "RANKING" && question.type !== "TEXT" && "That wasn't the right choice."}
                          {question.trickQuestion && " This was a trick question!"}
                        </>
                      )}
                    </motion.p>

                    {/* Show correct answer inline for choice/text questions */}
                    {!isCorrect && hasCorrectAnswer && question.type !== "RANKING" && question.type !== "SLIDER" && question.type !== "SCALE" && question.type !== "TEXT" && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.25 }}
                        className="text-sm text-muted-foreground border-t border-red-500/20 pt-3 mt-1"
                      >
                        <span className="text-red-300/70">Correct answer: </span>
                        <span className="font-medium text-foreground">
                          {(() => {
                            const correctAns = effectiveCorrectAnswer;
                            if (typeof correctAns === "string") {
                              const opt = question.options.find(o => o.id === correctAns);
                              return opt?.text || correctAns;
                            }
                            if (Array.isArray(correctAns)) {
                              return correctAns.map(id => question.options.find(o => o.id === id)?.text || id).join(", ");
                            }
                            return "";
                          })()}
                        </span>
                      </motion.div>
                    )}
                  </motion.div>
                  
                  {/* Show wrong explanation when provided - more prominent styling */}
                  {!isCorrect && (dynamicWrongTip || question.wrongExplanation) && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="p-4 rounded-xl bg-red-500/5 text-sm text-red-200/80 border border-red-500/20 leading-relaxed"
                    >
                      <span className="text-red-400 font-medium">💡 Tip: </span>
                      {dynamicWrongTip ?? question.wrongExplanation}
                    </motion.div>
                  )}

                  {/* Show correct ranking order when wrong */}
                  {!isCorrect && question.type === "RANKING" && Array.isArray(effectiveCorrectAnswer) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 rounded-lg bg-zinc-800/50 text-sm">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">
                          It should have been: {(effectiveCorrectAnswer as string[]).map(id => question.options.find(o => o.id === id)?.text ?? id).join(" → ")}
                        </p>
                        <ol className="space-y-1">
                          {(effectiveCorrectAnswer as string[]).map((id, idx) => {
                            const opt = question.options.find(o => o.id === id);
                            return (
                              <li key={id} className="flex items-center gap-2 text-xs">
                                <span className={cn(
                                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                                  idx === 0 ? "bg-amber-500/20 text-amber-400" :
                                  idx === 1 ? "bg-zinc-400/20 text-zinc-300" :
                                  idx === 2 ? "bg-orange-600/20 text-orange-400" :
                                  "bg-zinc-700/50 text-zinc-400"
                                )}>
                                  {idx + 1}
                                </span>
                                <span className="text-foreground">{opt?.text || id}</span>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    </motion.div>
                  )}
                  
                  {/* Explanation button moved outside the card for better visibility */}
                  {explanationContent && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      <button
                        onClick={() => setShowExplanation(!showExplanation)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all w-full justify-center",
                          showExplanation 
                            ? "text-violet-300 border-violet-500/50 bg-violet-500/15"
                            : isCorrect
                              ? "text-emerald-300/80 hover:text-emerald-300 border-emerald-500/30 hover:border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/10"
                              : "text-amber-300 hover:text-amber-200 border-amber-500/40 hover:border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/15"
                        )}
                      >
                        <Sparkles className="h-4 w-4" />
                        <span className="font-medium">
                          {showExplanation ? "Hide explanation" : isCorrect ? "Why is this correct?" : "Why was I wrong?"}
                        </span>
                      </button>
                      <AnimatePresence>
                        {showExplanation && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 p-4 rounded-xl bg-zinc-800/70 text-sm text-foreground/90 border border-zinc-700/50 leading-relaxed">
                              <span className="text-violet-400 font-medium">💡 Explanation: </span>
                              {explanationContent}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  {showExplanation && (deepRankingHelp || customDeepHelp || deepRangeHelp || deepWordHelp) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.35 }}
                    >
                      <button
                        onClick={() => setShowDeepExplanation(!showDeepExplanation)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all w-full justify-center",
                          showDeepExplanation
                            ? "text-blue-200 border-blue-400/60 bg-blue-500/10"
                            : "text-blue-200/90 hover:text-blue-100 border-blue-400/35 hover:border-blue-400/55 bg-blue-500/5 hover:bg-blue-500/10"
                        )}
                      >
                        <AlertCircle className="h-4 w-4" />
                        <span className="font-medium">
                          {showDeepExplanation ? "Hide extra clarification" : "Still don’t understand?"}
                        </span>
                      </button>

                      <AnimatePresence>
                        {showDeepExplanation && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            {deepRankingHelp ? (
                              <div className="mt-3 p-4 rounded-xl bg-blue-500/5 text-sm border border-blue-500/20 leading-relaxed whitespace-pre-line text-foreground/90">
                                {deepRankingHelp}
                              </div>
                            ) : customDeepHelp ? (
                              <div className="mt-3 p-4 rounded-xl bg-blue-500/5 text-sm border border-blue-500/20 leading-relaxed whitespace-pre-line text-foreground/90">
                                {customDeepHelp}
                              </div>
                            ) : deepRangeHelp ? (
                              <div className="mt-3 p-4 rounded-xl bg-blue-500/5 text-sm border border-blue-500/20 leading-relaxed space-y-2">
                                <p className="text-blue-200 font-medium">Extra clarification — how this range selector works</p>
                                <p className="text-foreground/90">
                                  In this demo, selecting a value highlights a contiguous range starting from {deepRangeHelp.formatValue(deepRangeHelp.min)} up to your selected value.
                                </p>
                                <p className="text-foreground/90">
                                  Correct highlighted set: {deepRangeHelp.expectedHighlighted.map(deepRangeHelp.formatValue).join(", ")}.
                                </p>
                                <p className="text-foreground/90">
                                  Your selected value was {deepRangeHelp.formatValue(deepRangeHelp.selectedValue)}, which highlights: {deepRangeHelp.currentHighlighted.map(deepRangeHelp.formatValue).join(", ")}.
                                </p>
                                {deepRangeHelp.remainingUnselected.length > 0 && (
                                  <p className="text-foreground/90">
                                    Values not selected yet: {deepRangeHelp.remainingUnselected.map(deepRangeHelp.formatValue).join(", ")}.
                                  </p>
                                )}
                                <p className="text-blue-100/90">
                                  To match this question exactly, stop at {deepRangeHelp.formatValue(deepRangeHelp.numericCorrect)} and do not move past it.
                                </p>
                              </div>
                            ) : deepWordHelp ? (
                              <div className="mt-3 p-4 rounded-xl bg-blue-500/5 text-sm border border-blue-500/20 leading-relaxed space-y-2">
                                <p className="text-blue-200 font-medium">Extra clarification — word match vs substring match</p>
                                <p className="text-foreground/90">
                                  This question says: select options that contain the <span className="font-semibold">word</span> “correct”.
                                </p>
                                <p className="text-foreground/90">
                                  A whole-word match means “correct” appears as its own token, like: {deepWordHelp.optionsWithWord.join(", ") || "(none)"}.
                                </p>
                                {deepWordHelp.optionsWithSubstringOnly.length > 0 && (
                                  <p className="text-foreground/90">
                                    These contain the letters but not the word itself: {deepWordHelp.optionsWithSubstringOnly.join(", ")}.
                                  </p>
                                )}
                                {deepWordHelp.selectedTexts.length > 0 && (
                                  <p className="text-foreground/90">
                                    You selected: {deepWordHelp.selectedTexts.join(", ")}.
                                  </p>
                                )}
                                <p className="text-blue-100/90">
                                  “Incorrect” is one different word; it includes the letters c-o-r-r-e-c-t, but it is not the standalone word “correct”.
                                </p>
                              </div>
                            ) : null}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  Response saved
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Navigation footer */}
      <div className="px-4 py-3 border-t border-zinc-800/30 bg-zinc-900/50">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <Button variant="ghost" size="sm" onClick={onPrev} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          {/* Question dots for current section */}
          <div className="hidden sm:flex items-center gap-1">
            {section.questions.map((q) => {
              const isActive = q.id === question.id;
              const isFilled = answers[q.id]?.value !== undefined;
              return (
                <div
                  key={q.id}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200",
                    isActive ? cn("w-6 bg-linear-to-r", theme.gradient) :
                    isFilled ? "w-1.5 bg-emerald-500" : "w-1.5 bg-zinc-700"
                  )}
                />
              );
            })}
          </div>

          <Button
            size="sm"
            onClick={onNext}
            className={cn("font-medium", isLast ? cn("bg-linear-to-r text-white", theme.gradient) : "bg-zinc-800 hover:bg-zinc-700 text-foreground")}
          >
            {isLast ? (<>Finish <CheckCircle2 className="h-4 w-4 ml-1" /></>) : (<>Next <ChevronRight className="h-4 w-4 ml-1" /></>)}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── COMPLETION SCREEN ─────────────────────────────────────────────────────

function CompletionScreen({
  poll, sections, answers, answeredCount, totalQuestions, theme,
  isSubmitting, authRequired, isPreview, onSubmit, onBack, onSelectSection, onStartMissingFlow, onClose,
}: {
  poll: PollData;
  sections: Section[];
  answers: Record<string, QuestionAnswer>;
  answeredCount: number;
  totalQuestions: number;
  theme: ReturnType<typeof getPollTheme>;
  isSubmitting: boolean;
  authRequired: boolean;
  isPreview?: boolean;
  onSubmit: () => void;
  onBack: () => void;
  onSelectSection: (idx: number) => void;
  onStartMissingFlow: () => void;
  onClose: () => void;
}) {
  const pct = totalQuestions > 0 ? Math.min(100, Math.round((answeredCount / totalQuestions) * 100)) : 0;
  const loginCallbackUrl = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/pulse";
  
  // Get unanswered questions for "Jump to missing" feature
  const unanswered = findUnansweredQuestions(sections, answers);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-md mx-auto text-center py-8">
          {/* Completion icon */}
          <motion.div className="mx-auto mb-6" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
            {pct === 100 ? (
              <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mx-auto bg-linear-to-br", theme.gradient)}>
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
            ) : (
              <div className="relative w-20 h-20 mx-auto">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="16" fill="none" className="stroke-zinc-800" strokeWidth="3" />
                  <circle cx="18" cy="18" r="16" fill="none" className="stroke-violet-500" strokeWidth="3" strokeDasharray={`${pct} 100`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-muted-foreground">{pct}%</span>
              </div>
            )}
          </motion.div>

          <h2 className="text-2xl font-bold mb-2">
            {pct === 100 ? "All Done!" : pct > 50 ? "Almost There!" : "Ready to Submit?"}
          </h2>
          <p className="text-sm text-muted-foreground mb-2">
            You&apos;ve answered {answeredCount} of {totalQuestions} questions
            {poll.allowPartial && pct < 100 && " — partial submissions are welcome!"}
          </p>
          <p className="text-xs text-zinc-500 mb-6">
            {pct}% = completion progress{poll.type === "QUIZ" ? ", not your score" : ""}
          </p>

          {/* Section breakdown */}
          {sections.length > 1 && (
            <div className="space-y-2 mb-8 text-left">
              {sections.map((section, idx) => {
                const answered = sectionAnsweredCount(section, answers);
                const total = section.questions.length;
                const secPct = Math.round((answered / total) * 100);
                return (
                  <button
                    key={section.id}
                    onClick={() => onSelectSection(idx)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors bg-zinc-900/50 hover:bg-zinc-800/70 border border-zinc-800/50"
                  >
                    <span>{section.icon}</span>
                    <span className="flex-1 text-sm font-medium text-left truncate">{section.title}</span>
                    <span className="text-xs text-muted-foreground">{answered}/{total}</span>
                    {secPct === 100 && <Check className="h-4 w-4 text-emerald-500" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Jump to missing questions */}
          {unanswered.length > 0 && (
            <div className="mb-6">
              <Button
                variant="outline"
                size="lg"
                onClick={onStartMissingFlow}
                className="w-full rounded-2xl border-amber-500/50 text-amber-200 hover:bg-amber-500/10 hover:border-amber-500"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Complete {unanswered.length} missing question{unanswered.length > 1 ? "s" : ""}
              </Button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            {authRequired ? (
              <>
                <p className="text-sm text-amber-200/90 mb-1">Sign in to submit this poll. After signing in, you&apos;ll return here to submit.</p>
                <Button
                  size="lg"
                  asChild
                  className={cn("w-full py-6 text-base font-semibold rounded-2xl text-white bg-linear-to-r", theme.gradient)}
                >
                  <Link href={`/auth/login?callbackUrl=${encodeURIComponent(loginCallbackUrl)}`}>
                    Sign in to submit
                  </Link>
                </Button>
              </>
            ) : isPreview ? (
              <Button
                size="lg"
                onClick={onSubmit}
                className={cn("w-full py-6 text-base font-semibold rounded-2xl text-white bg-linear-to-r", theme.gradient)}
              >
                <span className="flex items-center gap-2"><Eye className="h-5 w-5" />See Preview Results</span>
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={onSubmit}
                disabled={isSubmitting || answeredCount === 0}
                className={cn("w-full py-6 text-base font-semibold rounded-2xl text-white bg-linear-to-r", theme.gradient)}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Target className="h-5 w-5" /></motion.div>
                    Submitting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2"><Send className="h-5 w-5" />Submit Response</span>
                )}
              </Button>
            )}
            <Button variant="outline" size="lg" onClick={onBack} className="w-full rounded-2xl border-zinc-700">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── RESULTS SCREEN ─────────────────────────────────────────────────────────

function ResultsScreen({
  poll, sections, answers, answeredCount, totalQuestions, theme, isPreview, onClose,
}: {
  poll: PollData;
  sections: Section[];
  answers: Record<string, QuestionAnswer>;
  answeredCount: number;
  totalQuestions: number;
  theme: ReturnType<typeof getPollTheme>;
  isPreview?: boolean;
  onClose: () => void;
}) {
  const pct = totalQuestions > 0 ? Math.min(100, Math.round((answeredCount / totalQuestions) * 100)) : 0;
  const isQuiz = poll.type === "QUIZ";
  
  // Async quiz score — starts with quick fuzzy-only pass, then AI-verifies rejected TEXT answers
  const [quizScore, setQuizScore] = useState<{ correct: number; total: number; bySection: Array<{ section: Section; correct: number; total: number }>; aiVerified: string[] } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!isQuiz) return;
    let cancelled = false;
    const timeoutId = window.setTimeout(() => setIsVerifying(true), 0);
    calculateQuizScore(sections, answers).then((score) => {
      if (!cancelled) {
        setQuizScore(score);
        setIsVerifying(false);
      }
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isQuiz, sections, answers]);

  const scorePct = quizScore && quizScore.total > 0 ? Math.round((quizScore.correct / quizScore.total) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-md mx-auto text-center py-8">
          {/* Success animation */}
          <motion.div 
            className="mb-6"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
          >
            <div className={cn("w-24 h-24 rounded-full flex items-center justify-center mx-auto bg-linear-to-br shadow-2xl", theme.gradient)}>
              {isQuiz ? <Trophy className="w-12 h-12 text-white" /> : <PartyPopper className="w-12 h-12 text-white" />}
            </div>
          </motion.div>

          {/* Confetti effect (decorative) */}
          <motion.div className="absolute inset-0 pointer-events-none overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className={cn("absolute w-3 h-3 rounded-full", i % 3 === 0 ? "bg-violet-500" : i % 3 === 1 ? "bg-amber-400" : "bg-emerald-400")}
                initial={{ 
                  x: "50%", 
                  y: "30%", 
                  scale: 0 
                }}
                animate={{ 
                  x: `${20 + ((i * 37) % 61)}%`,
                  y: `${10 + ((i * 29) % 51)}%`,
                  scale: [0, 1.5, 1],
                  opacity: [0, 1, 0]
                }}
                transition={{ duration: 1.5, delay: 0.2 + i * 0.1 }}
              />
            ))}
          </motion.div>

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
            <h2 className="text-3xl font-bold mb-2">
              {isQuiz ? "Quiz Complete!" : "Thank You!"}
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              {isQuiz && quizScore
                ? `You got ${quizScore.correct} of ${quizScore.total} correct (${scorePct}%)`
                : isQuiz && isVerifying
                  ? "Checking your answers..."
                  : isQuiz 
                    ? `You answered ${answeredCount} of ${totalQuestions} questions`
                    : "Your feedback has been recorded"
              }
            </p>
            {isQuiz && quizScore && quizScore.aiVerified.length > 0 && (
              <p className="text-xs text-violet-400 mb-4 flex items-center justify-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                {quizScore.aiVerified.length} answer{quizScore.aiVerified.length > 1 ? "s" : ""} verified by AI (typo forgiveness)
              </p>
            )}
          </motion.div>

          {/* Quiz Score Card - Only shown for quizzes with scored questions */}
          {isQuiz && quizScore && quizScore.total > 0 && (
            <motion.div 
              className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 mb-6"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 }}
            >
              {/* Score gauge */}
              <div className="flex items-center justify-center mb-4">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="stroke-zinc-800"
                      fill="none"
                      strokeWidth="3"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={cn(
                        "transition-all duration-1000 ease-out",
                        scorePct >= 80 ? "stroke-emerald-500" : scorePct >= 60 ? "stroke-amber-500" : "stroke-red-500"
                      )}
                      fill="none"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${scorePct}, 100`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={cn(
                      "text-3xl font-bold",
                      scorePct >= 80 ? "text-emerald-400" : scorePct >= 60 ? "text-amber-400" : "text-red-400"
                    )}>
                      {scorePct}%
                    </span>
                    <span className="text-xs text-muted-foreground">Score</span>
                  </div>
                </div>
              </div>
              
              {/* Score breakdown */}
              <div className="flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">{quizScore.correct} correct</span>
                </div>
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4 text-red-400" />
                  <span className="text-red-400 font-medium">{quizScore.total - quizScore.correct} wrong</span>
                </div>
              </div>

              {/* Per-section score breakdown */}
              {sections.length > 1 && quizScore.bySection.length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-800 space-y-2">
                  <p className="text-xs text-muted-foreground mb-2 text-left">Score by section:</p>
                  {quizScore.bySection.map((sec, idx) => {
                    const secPct = sec.total > 0 ? Math.round((sec.correct / sec.total) * 100) : 0;
                    return (
                      <div key={sec.section.id} className="flex items-center gap-2 text-sm">
                        <span>{sections[idx]?.icon || "📋"}</span>
                        <span className="flex-1 text-left text-muted-foreground truncate">{sections[idx]?.title}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all",
                                secPct >= 80 ? "bg-emerald-500" : secPct >= 60 ? "bg-amber-500" : "bg-red-500"
                              )}
                              style={{ width: `${secPct}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium w-12 text-right">{sec.correct}/{sec.total}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* Completion Summary card - Only shown for non-quizzes or quizzes without scoring */}
          {(!isQuiz || !quizScore || quizScore.total === 0) && (
          <motion.div 
            className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 mb-6"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{pct}%</div>
                <div className="text-xs text-muted-foreground">Completion</div>
              </div>
              <div className="w-px h-12 bg-zinc-700" />
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{answeredCount}</div>
                <div className="text-xs text-muted-foreground">Answers</div>
              </div>
              {sections.length > 1 && (
                <>
                  <div className="w-px h-12 bg-zinc-700" />
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white">{sections.length}</div>
                    <div className="text-xs text-muted-foreground">Sections</div>
                  </div>
                </>
              )}
            </div>

            {/* Section breakdown */}
            {sections.length > 1 && (
              <div className="space-y-2 text-left border-t border-zinc-800 pt-4">
                {sections.map((section) => {
                  const answered = sectionAnsweredCount(section, answers);
                  const total = section.questions.length;
                  return (
                    <div key={section.id} className="flex items-center gap-2 text-sm">
                      <span>{section.icon}</span>
                      <span className="flex-1 text-muted-foreground truncate">{section.title}</span>
                      <span className={cn("font-medium", answered === total ? "text-emerald-400" : "text-muted-foreground")}>
                        {answered}/{total}
                      </span>
                      {answered === total && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
          )}

          {/* Action buttons */}
          <motion.div 
            className="flex flex-col gap-3"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              size="lg"
              className={cn("w-full py-6 text-base font-semibold rounded-2xl text-white bg-linear-to-r", theme.gradient)}
              onClick={onClose}
            >
              <span className="flex items-center gap-2">
                {isPreview ? (
                  <><Pencil className="h-5 w-5" />Back to Builder</>
                ) : (
                  <><CheckCircle2 className="h-5 w-5" />Done</>
                )}
              </span>
            </Button>
            
            {!isPreview && (
            <Button variant="outline" size="lg" className="w-full rounded-2xl border-zinc-700" onClick={() => {
              // TODO: Integrate with Pulse/sharing
              if (typeof navigator !== "undefined" && navigator.share) {
                navigator.share({ title: poll.title, text: `I just completed "${poll.title}"!` }).catch(() => {});
              }
            }}>
              <Share2 className="h-4 w-4 mr-2" />
              Share Results
            </Button>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
