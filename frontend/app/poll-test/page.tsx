"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SliderQuestion } from "@/components/uicustom/polls/SliderQuestion";
import { ChoiceQuestion } from "@/components/uicustom/polls/ChoiceQuestion";
import { ImagePasteInput } from "@/components/uicustom/polls/ImagePasteInput";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { 
  MessageSquarePlus, 
  ChevronLeft, 
  ChevronRight, 
  Crown,
  Sparkles,
  Check,
  Star,
  Clock,
  Zap,
  Target,
  TrendingUp,
  Info,
  HelpCircle,
  Layers,
  Users,
  Rocket,
  Sliders,
  ListChecks,
  Image as ImageIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  REACH_AUDIT_POLL_CONFIG,
  REACH_AUDIT_POLL_SECTIONS,
  TOTAL_QUESTIONS,
  type AdvancedPollQuestion,
} from "@/lib/data/reach-audit-poll-questions";

// ─── Tooltip Content Definitions ─────────────────────────────────────────────
// Inspirational, forward-looking, data-driven tooltip content

const TOOLTIP_CONTENT = {
  questions: {
    title: "Your Voice Matters",
    description: `Each question is a building block for our future. The more questions you answer, 
    the more your perspective shapes VeggaStare's evolution. This isn't just a survey — 
    it's collaborative innovation.`,
    icon: <Target className="w-4 h-4 text-brand-accent" />
  },
  sections: {
    title: "Journey Through Innovation",
    description: `8 carefully designed sections, each exploring a different facet of social metrics. 
    Complete them all to maximize your impact, or focus on what matters most to you.`,
    icon: <Layers className="w-4 h-4 text-blue-400" />
  },
  time: {
    title: "Dynamic Time Estimate",
    description: (completions: number, avgTime: string) => 
      completions > 0 
        ? `Based on ${completions} completed responses, most users finish in approximately ${avgTime}. 
           Your time may vary based on how deeply you engage with each question.`
        : `Initial estimate: 15-30 minutes. This will become more accurate as more innovators 
           complete the poll. Be among the first to help calibrate this!`,
    icon: <Clock className="w-4 h-4 text-amber-400" />
  },
  boost: {
    title: "Amplified Influence",
    description: (multiplier: number) => 
      `Your voice carries ${multiplier}x weight! As a verified contributor, your responses 
      have amplified impact on the final results. This ensures trusted voices help 
      guide our platform's direction.`,
    icon: <Zap className="w-4 h-4 text-amber-400" />
  },
  pollPower: {
    title: "Your Innovation Score",
    description: (power: number, progress: number) => 
      `Poll Power represents your total contribution to this innovation session. 
      Currently at ${power.toFixed(0)} (${progress}% progress × boost). 
      Higher power means greater influence on feature prioritization!`,
    icon: <TrendingUp className="w-4 h-4 text-purple-400" />
  },
  owner: {
    title: "Platform Architect",
    description: `As the platform owner, your insights are invaluable for understanding 
    the vision and direction. Your responses help calibrate how user feedback aligns 
    with the platform's core mission.`,
    icon: <Crown className="w-4 h-4 text-amber-400" />
  },
  viewMode: {
    all: {
      title: "Full Context View",
      description: `See all questions in this section at once. Perfect for getting an overview 
      and understanding how questions relate to each other. Ideal for comprehensive responses.`
    },
    single: {
      title: "Focused Flow View", 
      description: `One question at a time for deep, focused consideration. 
      Helps you give each question the attention it deserves without distraction.`
    }
  },
  sectionProgress: {
    title: "Section Momentum",
    description: (answered: number, total: number) => 
      `You've thoughtfully answered ${answered} of ${total} questions in this section. 
      ${total - answered > 0 ? `${total - answered} more to go — every answer counts!` : 'Section complete! 🎉'}`
  },
  overallProgress: {
    title: "Your Innovation Journey",
    description: (answered: number, total: number, pct: number) => 
      `${answered} of ${total} questions answered (${pct}% complete). 
      ${pct < 50 ? "You're building momentum!" : pct < 100 ? "Incredible progress — keep going!" : "Amazing! You've completed the full poll!"}`
  },
  comment: {
    title: "Share Deeper Insights",
    description: `Your additional thoughts are gold! Comments help us understand the 'why' 
    behind your answers. These qualitative insights often spark the best innovations.`
  }
};

// ─── Helper Component: Rich Tooltip ──────────────────────────────────────────

function InfoTooltip({ 
  children, 
  title, 
  description, 
  icon,
  side = "top"
}: { 
  children: React.ReactNode;
  title: string;
  description: string | React.ReactNode;
  icon?: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent 
        side={side} 
        className="max-w-xs bg-surface-3 border-border p-3"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            {icon}
            <span>{title}</span>
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed">{description}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Answer type with comment support
interface QuestionAnswer {
  value: string | string[] | number | undefined;
  comment?: string;
}

// Simulated completion time tracking (in real app, comes from backend)
interface CompletionStats {
  totalCompletions: number;
  averageMinutes: number;
  medianMinutes: number;
}

// Single Question Renderer with comment support
function QuestionRenderer({ 
  question, 
  answer, 
  onAnswer, 
  showComment,
  onToggleComment,
  isOwner = false
}: { 
  question: AdvancedPollQuestion;
  answer: QuestionAnswer | undefined;
  onAnswer: (value: QuestionAnswer) => void;
  showComment: boolean;
  onToggleComment: () => void;
  isOwner?: boolean;
}) {
  const handleValueChange = (value: string | string[] | number | undefined) => {
    onAnswer({ value, comment: answer?.comment });
  };

  const handleCommentChange = (comment: string) => {
    onAnswer({ value: answer?.value ?? '', comment });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-xl border border-border bg-surface-3/50 space-y-4"
    >
      {/* Question Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {question.pillarContext?.icon && (
              <span className="text-xl">{question.pillarContext.icon}</span>
            )}
            <h3 className="font-medium text-foreground">{question.question}</h3>
            {question.required && (
              <InfoTooltip
                title="Required Question"
                description="This question helps us build a complete picture. Your answer is essential for accurate results."
                icon={<Star className="w-3 h-3 text-red-400" />}
              >
                <span className="text-red-400 text-xs cursor-help">*</span>
              </InfoTooltip>
            )}
          </div>
          {question.description && (
            <p className="text-sm text-muted-foreground">{question.description}</p>
          )}
          {question.pillarContext && (
            <InfoTooltip
              title={`${question.pillarContext.pillar} Pillar — Current System Weight`}
              description={
                <div className="space-y-2">
                  <p>This pillar <strong>currently</strong> accounts for {question.pillarContext.currentWeight}% of your Reach score in our system.</p>
                  <p className="text-amber-300">Your vote on this question helps us decide if this weight should change!</p>
                  <p className="text-muted-foreground text-xs">Example: If most users think {question.pillarContext.currentWeight}% is too high, we may reduce it in a future update.</p>
                </div>
              }
              icon={<Target className="w-3 h-3 text-amber-400" />}
            >
              <Badge variant="outline" className="mt-2 border-amber-600/50 text-amber-400 text-xs cursor-help gap-1">
                <Info className="w-3 h-3" />
                System weight: {question.pillarContext.currentWeight}%
              </Badge>
            </InfoTooltip>
          )}
        </div>
        
        {/* Comment Toggle */}
        <InfoTooltip
          title={TOOLTIP_CONTENT.comment.title}
          description={TOOLTIP_CONTENT.comment.description}
          icon={<Sparkles className="w-3 h-3 text-brand-accent" />}
          side="left"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleComment}
            className={cn(
              "shrink-0 transition-colors",
              showComment ? "text-brand-accent bg-brand-accent/30" : "text-muted-foreground hover:text-foreground/80"
            )}
          >
            <MessageSquarePlus className="w-4 h-4" />
          </Button>
        </InfoTooltip>
      </div>

      {/* Question Input */}
      <div className="pt-2">
        {question.type === 'slider' && (
          <SliderQuestion
            questionId={question.id}
            questionText=""
            minValue={1}
            maxValue={7}
            step={1}
            minLabel={question.sliderLabels?.[0] ?? 'A'}
            maxLabel={question.sliderLabels?.[6] ?? 'G'}
            stepLabels={question.sliderLabels}
            value={answer?.value as number | undefined}
            onChange={handleValueChange}
            colorScheme={isOwner ? "reach" : "default"}
          />
        )}

        {(question.type === 'choice' || question.type === 'multi-choice') && (
          <ChoiceQuestion
            questionId={question.id}
            questionText=""
            options={question.options?.map(opt => ({
              id: opt.id,
              text: opt.icon ? `${opt.icon} ${opt.label}` : opt.label,
              description: opt.description,
            })) ?? []}
            selectedValue={
              question.type === 'multi-choice' 
                ? (answer?.value as string[] | undefined)
                : (answer?.value as string | undefined)
            }
            onChange={(v) => handleValueChange(v as string | string[])}
            multiSelect={question.type === 'multi-choice'}
            maxSelections={question.maxSelections}
            variant="card"
          />
        )}

        {question.type === 'text' && (
          <Textarea
            placeholder={question.placeholder ?? "Share your thoughts..."}
            value={(answer?.value as string) ?? ""}
            onChange={(e) => handleValueChange(e.target.value)}
            maxLength={question.maxLength ?? 500}
            className="bg-muted border-border min-h-[100px]"
          />
        )}
      </div>

      {/* Comment Input (expandable) */}
      <AnimatePresence>
        {showComment && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3 border-t border-border">
              <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Add your feedback or suggestion for this question
              </label>
              <Textarea
                placeholder="Your thoughts on this question, suggestions for improvement, or any context you'd like to share..."
                value={answer?.comment ?? ""}
                onChange={(e) => handleCommentChange(e.target.value)}
                className="bg-muted/50 border-border text-sm min-h-[80px]"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Answer indicator */}
      {answer?.value !== undefined && (
        <div className="flex items-center gap-1.5 text-xs text-brand-accent">
          <Check className="w-3 h-3" />
          Answered
          {answer?.comment && <span className="text-muted-foreground">+ comment</span>}
        </div>
      )}
    </motion.div>
  );
}

export default function PollTestPage() {
  const [activeTab, setActiveTab] = useState("audit");
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [sliderValue, setSliderValue] = useState<number | undefined>(4);
  const [choiceValue, setChoiceValue] = useState<string>("");
  const [multiChoiceValue, setMultiChoiceValue] = useState<string[]>([]);
  const [images, setImages] = useState<{ url: string; width: number; height: number; aspectRatio: "portrait" | "landscape" | "square"; size: number }[]>([]);
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'all' | 'single'>('all');
  const [startTime] = useState<number>(() => Date.now());
  
  // Simulated owner status - in real app this comes from auth
  const [isOwner] = useState(true);

  // Simulated completion stats - in real app from backend
  const [completionStats] = useState<CompletionStats>({
    totalCompletions: 0, // Will increase as people complete
    averageMinutes: 0,
    medianMinutes: 0
  });

  // Get current section
  const section = REACH_AUDIT_POLL_SECTIONS[currentSection];
  const sectionQuestions = section?.questions ?? [];
  const currentQuestion = sectionQuestions[currentQuestionIndex];

  // Calculate section progress
  const sectionAnsweredCount = sectionQuestions.filter(q => answers[q.id]?.value !== undefined).length;
  const sectionProgressPct = sectionQuestions.length > 0 
    ? Math.round((sectionAnsweredCount / sectionQuestions.length) * 100) 
    : 0;

  // Calculate overall progress
  const answeredCount = Object.values(answers).filter(a => a.value !== undefined).length;
  const progressPct = Math.round((answeredCount / TOTAL_QUESTIONS) * 100);

  // Owner boost calculation
  const ownerBoostMultiplier = isOwner ? 2.5 : 1.0;
  const pollPower = progressPct * ownerBoostMultiplier;

  // Dynamic time estimate
  const getTimeEstimate = () => {
    if (completionStats.totalCompletions > 0) {
      const avg = completionStats.averageMinutes;
      const min = Math.max(5, Math.floor(avg * 0.7));
      const max = Math.ceil(avg * 1.3);
      return `${min}-${max} min`;
    }
    return "15-30 min";
  };

  // Handle answer update
  const handleAnswer = useCallback((questionId: string, answer: QuestionAnswer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  }, []);

  // Toggle comment visibility
  const toggleComment = useCallback((questionId: string) => {
    setShowComments(prev => ({ ...prev, [questionId]: !prev[questionId] }));
  }, []);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Rocket className="w-8 h-8 text-brand-accent" />
              <h1 className="text-3xl font-bold bg-linear-to-r from-brand-accent to-blue-400 bg-clip-text text-transparent">
                {REACH_AUDIT_POLL_CONFIG.title}
              </h1>
            </div>
            <p className="text-muted-foreground">{REACH_AUDIT_POLL_CONFIG.subtitle}</p>
          </div>
          
          {/* Stats bar with rich tooltips */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <InfoTooltip
              title={TOOLTIP_CONTENT.questions.title}
              description={TOOLTIP_CONTENT.questions.description}
              icon={TOOLTIP_CONTENT.questions.icon}
            >
              <Badge variant="outline" className="border-brand-accent text-brand-accent cursor-help">
                <Target className="w-3 h-3 mr-1" />
                {TOTAL_QUESTIONS} Questions
              </Badge>
            </InfoTooltip>

            <InfoTooltip
              title={TOOLTIP_CONTENT.sections.title}
              description={TOOLTIP_CONTENT.sections.description}
              icon={TOOLTIP_CONTENT.sections.icon}
            >
              <Badge variant="outline" className="border-blue-500 text-blue-500 cursor-help">
                <Layers className="w-3 h-3 mr-1" />
                {REACH_AUDIT_POLL_SECTIONS.length} Sections
              </Badge>
            </InfoTooltip>

            <InfoTooltip
              title={TOOLTIP_CONTENT.time.title}
              description={TOOLTIP_CONTENT.time.description(
                completionStats.totalCompletions, 
                `${completionStats.averageMinutes.toFixed(0)} minutes`
              )}
              icon={TOOLTIP_CONTENT.time.icon}
            >
              <Badge variant="outline" className="border-amber-500 text-amber-500 cursor-help">
                <Clock className="w-3 h-3 mr-1" />
                {getTimeEstimate()}
                {completionStats.totalCompletions > 0 && (
                  <span className="ml-1 text-xs opacity-60">
                    ({completionStats.totalCompletions} responses)
                  </span>
                )}
              </Badge>
            </InfoTooltip>

            <InfoTooltip
              title={TOOLTIP_CONTENT.pollPower.title}
              description={TOOLTIP_CONTENT.pollPower.description(pollPower, progressPct)}
              icon={TOOLTIP_CONTENT.pollPower.icon}
            >
              <Badge variant="outline" className="border-purple-500 text-purple-500 cursor-help">
                <TrendingUp className="w-3 h-3 mr-1" />
                Poll Power: {pollPower.toFixed(0)}
              </Badge>
            </InfoTooltip>

            {/* Owner Status - positioned with Poll Power for context */}
            {isOwner && (
              <InfoTooltip
                title={TOOLTIP_CONTENT.owner.title}
                description={TOOLTIP_CONTENT.owner.description}
                icon={TOOLTIP_CONTENT.owner.icon}
              >
                <Badge variant="outline" className="border-amber-500/70 bg-amber-950/50 text-amber-400 cursor-help">
                  <Crown className="w-3 h-3 mr-1" />
                  Platform Architect
                  <span className="ml-1.5 text-xs text-amber-300">
                    {ownerBoostMultiplier}x
                  </span>
                </Badge>
              </InfoTooltip>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 bg-surface-3 border border-border flex-wrap h-auto p-1 gap-1">
              <InfoTooltip
                title="🚀 Full Innovation Poll"
                description={
                  <div className="space-y-2">
                    <p>The complete {TOTAL_QUESTIONS}-question journey across all 8 sections.</p>
                    <p className="text-brand-accent">Your comprehensive input shapes VeggaStare&apos;s future!</p>
                    <p className="text-xs text-muted-foreground">Includes: Pillar evaluation, Velocity feedback, Auth preferences, UI/UX, and more.</p>
                  </div>
                }
                icon={<Rocket className="w-3 h-3 text-brand-accent" />}
              >
                <TabsTrigger value="audit" className="data-[state=active]:bg-brand-accent/50 gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Full Poll
                </TabsTrigger>
              </InfoTooltip>

              <InfoTooltip
                title="🎚️ Slider Component Demo"
                description={
                  <div className="space-y-2">
                    <p>Test our A→G scale slider component.</p>
                    <p className="text-blue-400">Click, drag, or use keyboard arrows to adjust!</p>
                    <p className="text-xs text-muted-foreground">Supports: Touch gestures, keyboard nav, smooth animations.</p>
                  </div>
                }
                icon={<Zap className="w-3 h-3 text-blue-400" />}
              >
                <TabsTrigger value="slider" className="data-[state=active]:bg-blue-900/50 gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  Slider
                </TabsTrigger>
              </InfoTooltip>

              <InfoTooltip
                title="✅ Choice Component Demo"
                description={
                  <div className="space-y-2">
                    <p>Test single and multi-choice question components.</p>
                    <p className="text-purple-400">Card-style options with descriptions and icons!</p>
                    <p className="text-xs text-muted-foreground">Supports: Single select, multi-select with limits, emoji icons.</p>
                  </div>
                }
                icon={<Check className="w-3 h-3 text-purple-400" />}
              >
                <TabsTrigger value="choice" className="data-[state=active]:bg-purple-900/50 gap-1.5">
                  <ListChecks className="w-3.5 h-3.5" />
                  Choice
                </TabsTrigger>
              </InfoTooltip>

              <InfoTooltip
                title="📸 Image Paste Demo"
                description={
                  <div className="space-y-2">
                    <p>Test our screenshot capture component.</p>
                    <p className="text-amber-400">Press Ctrl+V or drag & drop images!</p>
                    <p className="text-xs text-muted-foreground">Pro tip: Take a screenshot (Win+Shift+S) then paste directly.</p>
                  </div>
                }
                icon={<ImageIcon className="w-3 h-3 text-amber-400" />}
              >
                <TabsTrigger value="images" className="data-[state=active]:bg-amber-900/50 gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Image Paste
                </TabsTrigger>
              </InfoTooltip>
            </TabsList>

          {/* Full Audit Poll Tab */}
          <TabsContent value="audit" className="space-y-6">
            {/* Overall Progress with tooltip */}
            <InfoTooltip
              title={TOOLTIP_CONTENT.overallProgress.title}
              description={TOOLTIP_CONTENT.overallProgress.description(answeredCount, TOTAL_QUESTIONS, progressPct)}
              icon={<TrendingUp className="w-3 h-3 text-brand-accent" />}
              side="bottom"
            >
              <div className="bg-surface-3 rounded-lg p-4 border border-border cursor-help">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Rocket className="w-4 h-4 text-brand-accent" />
                    Innovation Progress
                  </span>
                  <span className="text-sm font-medium">
                    {answeredCount}/{TOTAL_QUESTIONS} 
                    <span className="text-brand-accent ml-1">({progressPct}%)</span>
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-linear-to-r from-brand-accent to-brand-accent-hover"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
                {progressPct > 0 && progressPct < 100 && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {progressPct < 25 ? "Great start! Every answer matters." : 
                     progressPct < 50 ? "Building momentum! Keep going." :
                     progressPct < 75 ? "Incredible progress! You're making a difference." :
                     "Almost there! The finish line is in sight."}
                  </p>
                )}
              </div>
            </InfoTooltip>

            {/* View Mode Toggle with tooltips */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <HelpCircle className="w-3 h-3" />
                View Mode:
              </span>
              <InfoTooltip
                title={TOOLTIP_CONTENT.viewMode.all.title}
                description={TOOLTIP_CONTENT.viewMode.all.description}
                icon={<Layers className="w-3 h-3 text-brand-accent" />}
              >
                <Button
                  variant={viewMode === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('all')}
                  className={viewMode === 'all' ? 'bg-brand-accent-hover' : 'border-border'}
                >
                  <Layers className="w-3 h-3 mr-1" />
                  Full Context
                </Button>
              </InfoTooltip>
              <InfoTooltip
                title={TOOLTIP_CONTENT.viewMode.single.title}
                description={TOOLTIP_CONTENT.viewMode.single.description}
                icon={<Target className="w-3 h-3 text-blue-400" />}
              >
                <Button
                  variant={viewMode === 'single' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('single')}
                  className={viewMode === 'single' ? 'bg-brand-accent-hover' : 'border-border'}
                >
                  <Target className="w-3 h-3 mr-1" />
                  Focused Flow
                </Button>
              </InfoTooltip>
            </div>

            {/* Section Navigation with tooltips */}
            <div className="flex flex-wrap gap-2">
              {REACH_AUDIT_POLL_SECTIONS.map((s, i) => {
                const sectionAnswers = s.questions.filter(q => answers[q.id]?.value !== undefined).length;
                const isComplete = sectionAnswers === s.questions.length;
                const sectionPct = Math.round((sectionAnswers / s.questions.length) * 100);
                
                return (
                  <InfoTooltip
                    key={s.id}
                    title={s.title}
                    description={
                      <div className="space-y-1">
                        <p>{s.description}</p>
                        <p className="text-brand-accent font-medium">
                          {sectionAnswers}/{s.questions.length} answered ({sectionPct}%)
                        </p>
                        {isComplete && <p className="text-amber-400">✨ Section complete!</p>}
                      </div>
                    }
                    icon={<Layers className="w-3 h-3 text-blue-400" />}
                    side="bottom"
                  >
                    <Button
                      variant={i === currentSection ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setCurrentSection(i);
                        setCurrentQuestionIndex(0);
                      }}
                      className={cn(
                        i === currentSection ? "bg-brand-accent-hover hover:bg-brand-accent-hover" : "border-border",
                        isComplete && i !== currentSection && "border-brand-accent/50 text-brand-accent"
                      )}
                    >
                      {isComplete && <Check className="w-3 h-3 mr-1" />}
                      {i + 1}. {s.title}
                      <span className="ml-1.5 text-xs opacity-60">
                        ({sectionAnswers}/{s.questions.length})
                      </span>
                    </Button>
                  </InfoTooltip>
                );
              })}
            </div>

            {/* Current Section Header with tooltip */}
            {section && (
              <InfoTooltip
                title={TOOLTIP_CONTENT.sectionProgress.title}
                description={TOOLTIP_CONTENT.sectionProgress.description(sectionAnsweredCount, sectionQuestions.length)}
                icon={<Target className="w-3 h-3 text-brand-accent" />}
                side="bottom"
              >
                <div className="bg-linear-to-r from-brand-accent/30 to-transparent rounded-lg p-4 border border-brand-accent/50 cursor-help">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-brand-accent/20 flex items-center justify-center text-brand-accent font-bold">
                      {currentSection + 1}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-brand-accent-light">{section.title}</h2>
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-xs text-muted-foreground">
                      Section Progress: {sectionAnsweredCount}/{sectionQuestions.length} ({sectionProgressPct}%)
                    </span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-xs">
                      <motion.div 
                        className="h-full bg-brand-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${sectionProgressPct}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                </div>
              </InfoTooltip>
            )}

            {/* Questions */}
            {section && viewMode === 'all' && (
              <div className="space-y-4">
                {sectionQuestions.map((q, i) => (
                  <QuestionRenderer
                    key={q.id}
                    question={q}
                    answer={answers[q.id]}
                    onAnswer={(answer) => handleAnswer(q.id, answer)}
                    showComment={showComments[q.id] ?? false}
                    onToggleComment={() => toggleComment(q.id)}
                    isOwner={isOwner}
                  />
                ))}
              </div>
            )}

            {/* Single Question View */}
            {section && viewMode === 'single' && currentQuestion && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Question {currentQuestionIndex + 1} of {sectionQuestions.length}</span>
                  <div className="flex gap-1">
                    {sectionQuestions.map((q, i) => (
                      <button
                        key={q.id}
                        onClick={() => setCurrentQuestionIndex(i)}
                        className={cn(
                          "w-2.5 h-2.5 rounded-full transition",
                          i === currentQuestionIndex
                            ? "bg-brand-accent scale-125"
                            : answers[q.id]?.value !== undefined
                            ? "bg-brand-accent/50"
                            : "bg-muted hover:bg-muted"
                        )}
                      />
                    ))}
                  </div>
                </div>

                <QuestionRenderer
                  question={currentQuestion}
                  answer={answers[currentQuestion.id]}
                  onAnswer={(answer) => handleAnswer(currentQuestion.id, answer)}
                  showComment={showComments[currentQuestion.id] ?? false}
                  onToggleComment={() => toggleComment(currentQuestion.id)}
                  isOwner={isOwner}
                />

                {/* Single Question Navigation */}
                <div className="flex justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                    disabled={currentQuestionIndex === 0}
                    className="border-border"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    onClick={() => {
                      if (currentQuestionIndex < sectionQuestions.length - 1) {
                        setCurrentQuestionIndex(currentQuestionIndex + 1);
                      } else if (currentSection < REACH_AUDIT_POLL_SECTIONS.length - 1) {
                        setCurrentSection(currentSection + 1);
                        setCurrentQuestionIndex(0);
                      }
                    }}
                    className="bg-brand-accent-hover hover:bg-brand-accent-hover"
                  >
                    {currentQuestionIndex < sectionQuestions.length - 1 ? (
                      <>Next <ChevronRight className="w-4 h-4 ml-1" /></>
                    ) : currentSection < REACH_AUDIT_POLL_SECTIONS.length - 1 ? (
                      <>Next Section <ChevronRight className="w-4 h-4 ml-1" /></>
                    ) : (
                      <>Complete <Check className="w-4 h-4 ml-1" /></>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Section navigation buttons */}
            <div className="flex justify-between pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentSection(Math.max(0, currentSection - 1));
                  setCurrentQuestionIndex(0);
                }}
                disabled={currentSection === 0}
                className="border-border"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous Section
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentSection(Math.min(REACH_AUDIT_POLL_SECTIONS.length - 1, currentSection + 1));
                  setCurrentQuestionIndex(0);
                }}
                disabled={currentSection === REACH_AUDIT_POLL_SECTIONS.length - 1}
                className="border-border"
              >
                Next Section
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </TabsContent>

          {/* Slider Component Test */}
          <TabsContent value="slider">
            <div className="space-y-8">
              <div className="p-6 border border-border rounded-lg bg-surface-3">
                <h2 className="text-xl font-semibold mb-4">Default Slider (A→G Scale)</h2>
                <SliderQuestion
                  questionId="test-slider-1"
                  questionText="Rate the importance of Velocity tracking"
                  description="A = Not important, G = Critical"
                  minValue={1}
                  maxValue={7}
                  step={1}
                  minLabel="Not Important"
                  maxLabel="Critical"
                  value={sliderValue}
                  onChange={setSliderValue}
                />
                <div className="mt-4 p-3 bg-muted/50 rounded text-sm">
                  Current: <span className="text-brand-accent font-mono">{sliderValue ?? 'Not set'}</span>
                  {sliderValue && <span className="text-muted-foreground ml-2">({['A','B','C','D','E','F','G'][sliderValue - 1]})</span>}
                </div>
              </div>

              <div className="p-6 border border-border rounded-lg bg-surface-3">
                <h2 className="text-xl font-semibold mb-4">Pillar Importance Ratings</h2>
                <div className="space-y-6">
                  <SliderQuestion
                    questionId="pillar-visibility"
                    questionText="👁️ Visibility (20%)"
                    description="Unique exposures deduped across sessions"
                    minValue={1}
                    maxValue={7}
                    step={1}
                    minLabel="Too High"
                    maxLabel="Too Low"
                    value={4}
                    onChange={() => {}}
                  />
                  <SliderQuestion
                    questionId="pillar-engagement"
                    questionText="💬 Engagement Depth (30%)"
                    description="Quality interactions beyond likes"
                    minValue={1}
                    maxValue={7}
                    step={1}
                    minLabel="Too High"
                    maxLabel="Too Low"
                    value={4}
                    onChange={() => {}}
                  />
                  <SliderQuestion
                    questionId="pillar-velocity"
                    questionText="⚡ Velocity (NEW - 10%)"
                    description="Realtime engagement momentum"
                    minValue={1}
                    maxValue={7}
                    step={1}
                    minLabel="Don't Add"
                    maxLabel="Essential"
                    value={5}
                    onChange={() => {}}
                    colorScheme="reach"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Choice Component Test */}
          <TabsContent value="choice">
            <div className="space-y-8">
              <div className="p-6 border border-border rounded-lg bg-surface-3">
                <h2 className="text-xl font-semibold mb-4">Single Choice</h2>
                <ChoiceQuestion
                  questionId="test-choice-1"
                  questionText="What's your primary role on VeggaStare?"
                  description="Choose one option"
                  options={[
                    { id: "creator", text: "Content Creator", description: "I primarily create and share content" },
                    { id: "consumer", text: "Content Consumer", description: "I mostly browse and engage" },
                    { id: "seller", text: "Marketplace Seller", description: "I sell products/services" },
                    { id: "hybrid", text: "Hybrid User", description: "I do a mix of everything" },
                  ]}
                  selectedValue={choiceValue}
                  onChange={(v) => setChoiceValue(v as string)}
                />
              </div>

              <div className="p-6 border border-border rounded-lg bg-surface-3">
                <h2 className="text-xl font-semibold mb-4">Multi Choice (max 3)</h2>
                <ChoiceQuestion
                  questionId="test-choice-2"
                  questionText="Which verifications have you completed?"
                  description="Select all that apply"
                  options={[
                    { id: "email", text: "📧 Email verified" },
                    { id: "google", text: "🔵 Google OAuth" },
                    { id: "github", text: "⚫ GitHub OAuth" },
                    { id: "wallet", text: "🔗 Web3 Wallet" },
                    { id: "payment", text: "💳 Payment card" },
                    { id: "crypto", text: "🪙 Crypto purchase" },
                  ]}
                  selectedValue={multiChoiceValue}
                  onChange={(v) => setMultiChoiceValue(v as string[])}
                  multiSelect
                  maxSelections={3}
                  variant="card"
                />
                <div className="mt-4 p-3 bg-muted/50 rounded text-sm">
                  Selected: <span className="text-brand-accent">{multiChoiceValue.join(', ') || 'None'}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Image Paste Test */}
          <TabsContent value="images">
            <div className="p-6 border border-border rounded-lg bg-surface-3">
              <h2 className="text-xl font-semibold mb-4">Image Paste Input</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Try pressing Ctrl+V with an image in your clipboard, or drag and drop!
              </p>
              <ImagePasteInput
                questionId="test-images"
                label="Share a mockup or screenshot"
                description="Upload any visual feedback for the Reach system"
                value={images}
                onChange={setImages}
                maxImages={4}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer info */}
        <div className="mt-8 pt-6 border-t border-border text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Rocket className="w-4 h-4 text-brand-accent" />
            <p className="text-foreground/80">VeggaStare Innovation Poll System</p>
          </div>
          <p className="text-xs">
            Building the future of social metrics, together.
          </p>
          <p className="mt-2">
            <code className="bg-muted px-2 py-1 rounded text-xs">/lib/data/reach-audit-poll-questions.ts</code>
          </p>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
