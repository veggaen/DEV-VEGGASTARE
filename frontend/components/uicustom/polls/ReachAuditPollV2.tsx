"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  User,
  BarChart3,
  Zap,
  Shield,
  Eye,
  Palette,
  Rocket,
  MessageSquare,
  X,
  ArrowRight,
  Trophy,
  Target,
  Heart,
  TrendingUp,
  Lock,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PollOption {
  id: string;
  text: string;
  icon?: string;
  description?: string;
}

interface PollQuestion {
  id: string;
  type: "single-choice" | "multi-choice" | "yes-no" | "slider" | "rating" | "text" | "drag-rank" | "toggle-grid";
  question: string;
  subtitle?: string;
  options?: PollOption[];
  sliderConfig?: {
    min: number;
    max: number;
    minLabel?: string;
    maxLabel?: string;
    showValue?: boolean;
  };
  required?: boolean;
  maxSelections?: number;
  visual?: "cards" | "pills" | "icons" | "minimal";
}

interface Phase {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  questions: PollQuestion[];
}

interface QuestionAnswer {
  value: string | string[] | number | boolean | undefined;
  comment?: string;
}

interface ReachAuditPollV2Props {
  pollId: string | null;
  onClose: () => void;
  onComplete?: (responseId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Types - Questions loaded from database
// ─────────────────────────────────────────────────────────────────────────────

interface ApiOption {
  id: string;
  text: string;
  order: number;
  value?: number | null;
}

interface ApiQuestion {
  id: string;
  text: string;
  description?: string | null;
  type: string;
  order: number;
  isRequired: boolean;
  sliderConfig?: {
    phaseId?: string;
    phaseTitle?: string;
    phaseSubtitle?: string;
    phaseIcon?: string;
    phaseColor?: string;
    localId?: string;
    visual?: string;
    min?: number;
    max?: number;
    minLabel?: string;
    maxLabel?: string;
    showValue?: boolean;
  } | null;
  options: ApiOption[];
}

interface ApiPoll {
  id: string;
  title: string;
  description?: string | null;
  questions: ApiQuestion[];
}

// Transform API questions into Phase structure
function transformToPhases(questions: ApiQuestion[]): Phase[] {
  const phaseMap = new Map<string, Phase>();
  const iconMap: Record<string, React.ElementType> = {
    User,
    Target,
    Zap,
    Shield,
    Eye,
    Palette,
    Rocket,
    MessageSquare,
    BarChart3,
  };

  for (const q of questions) {
    const config = q.sliderConfig || {};
    const phaseId = config.phaseId || 'default';
    
    if (!phaseMap.has(phaseId)) {
      phaseMap.set(phaseId, {
        id: phaseId,
        title: config.phaseTitle || 'Questions',
        subtitle: config.phaseSubtitle || '',
        icon: iconMap[config.phaseIcon || 'Target'] || Target,
        color: config.phaseColor || 'blue',
        questions: [],
      });
    }

    const phase = phaseMap.get(phaseId)!;
    
    // Map question type
    let type: PollQuestion['type'] = 'single-choice';
    if (q.type === 'SLIDER') type = 'slider';
    else if (q.type === 'MULTI_CHOICE') type = 'multi-choice';
    else if (q.type === 'TEXT') type = 'text';
    else if (q.type === 'SINGLE_CHOICE') type = 'single-choice';
    
    // Check for yes-no pattern
    if (q.options.length === 2 && type === 'single-choice') {
      const texts = q.options.map(o => o.text.toLowerCase());
      if (texts.some(t => t.includes('yes')) && texts.some(t => t.includes('no'))) {
        type = 'yes-no';
      }
    }

    phase.questions.push({
      id: q.id,
      type,
      question: q.text,
      subtitle: q.description || undefined,
      visual: (config.visual as 'cards' | 'pills' | 'icons' | 'minimal') || 'cards',
      required: q.isRequired,
      sliderConfig: config.min !== undefined ? {
        min: config.min,
        max: config.max || 5,
        minLabel: config.minLabel,
        maxLabel: config.maxLabel,
        showValue: config.showValue,
      } : undefined,
      options: q.options.map(o => ({
        id: o.id,
        text: o.text.replace(/^[^\s]+\s/, ''), // Remove emoji prefix
        icon: o.text.match(/^([^\s]+)/)?.[1], // Extract emoji
        description: undefined,
      })),
    });
  }

  // Return phases in order
  const phaseOrder = ['about-you', 'reach-pillars', 'velocity', 'verification', 'ux-design', 'features', 'open-feedback'];
  const sortedPhases: Phase[] = [];
  for (const id of phaseOrder) {
    const phase = phaseMap.get(id);
    if (phase) sortedPhases.push(phase);
  }
  // Add any remaining phases
  for (const [id, phase] of phaseMap) {
    if (!phaseOrder.includes(id)) sortedPhases.push(phase);
  }
  
  return sortedPhases;
}

// Fallback hardcoded phases (used if API fails)
const FALLBACK_PHASES: Phase[] = [
  {
    id: "about-you",
    title: "About You",
    subtitle: "Help us understand your perspective",
    icon: User,
    color: "emerald",
    questions: [
      {
        id: "role",
        type: "single-choice",
        question: "What brings you to VeggaStare?",
        subtitle: "Pick the one that fits best — you can do multiple things!",
        visual: "cards",
        options: [
          { id: "creator", text: "I create content", icon: "🎨", description: "Posts, art, products, music" },
          { id: "explorer", text: "I discover & engage", icon: "🔍", description: "Browse, like, comment, share" },
          { id: "seller", text: "I sell things", icon: "🏪", description: "Products, services, digital items" },
          { id: "buyer", text: "I shop & collect", icon: "🛒", description: "Buy products, trade items" },
          { id: "networker", text: "I connect people", icon: "🤝", description: "Community building, collaborations" },
          { id: "observer", text: "Just exploring", icon: "👀", description: "New here, checking things out" },
        ],
        required: true,
      },
      {
        id: "contribute",
        type: "yes-no",
        question: "Would you like to help build VeggaStare?",
        subtitle: "We're always looking for passionate contributors!",
        required: false,
      },
      {
        id: "familiarity",
        type: "slider",
        question: "How well do you know VeggaStare's features?",
        subtitle: "Be honest — there's no wrong answer!",
        sliderConfig: {
          min: 1,
          max: 5,
          minLabel: "Brand new",
          maxLabel: "Power user",
          showValue: true,
        },
        required: true,
      },
    ],
  },
  {
    id: "reach-pillars",
    title: "The Reach System",
    subtitle: "Rate what matters most to you",
    icon: Target,
    color: "blue",
    questions: [
      {
        id: "pillar-visibility",
        type: "rating",
        question: "How important is knowing how many people see your content?",
        subtitle: "Views, impressions, and reach",
        sliderConfig: { min: 1, max: 5, showValue: true },
        required: true,
      },
      {
        id: "pillar-engagement",
        type: "rating",
        question: "How important are meaningful interactions?",
        subtitle: "Comments, saves, time spent — not just likes",
        sliderConfig: { min: 1, max: 5, showValue: true },
        required: true,
      },
      {
        id: "pillar-conversion",
        type: "rating",
        question: "How important is turning viewers into customers?",
        subtitle: "Profile visits → follows, clicks → purchases",
        sliderConfig: { min: 1, max: 5, showValue: true },
        required: true,
      },
      {
        id: "pillar-loyalty",
        type: "rating",
        question: "How important is having repeat supporters?",
        subtitle: "People who come back again and again",
        sliderConfig: { min: 1, max: 5, showValue: true },
        required: true,
      },
      {
        id: "pillar-growth",
        type: "rating",
        question: "How important is organic growth from your posts?",
        subtitle: "New followers discovered through your content",
        sliderConfig: { min: 1, max: 5, showValue: true },
        required: true,
      },
    ],
  },
  {
    id: "velocity",
    title: "Velocity & Momentum",
    subtitle: "Should we track when content goes viral?",
    icon: Zap,
    color: "amber",
    questions: [
      {
        id: "velocity-want",
        type: "yes-no",
        question: "Would you like to know when your content is trending?",
        subtitle: "Real-time alerts when engagement spikes",
        required: true,
      },
      {
        id: "velocity-importance",
        type: "slider",
        question: "How important is real-time momentum tracking?",
        subtitle: "See engagement as it happens, not just totals",
        sliderConfig: { min: 1, max: 5, minLabel: "Nice to have", maxLabel: "Essential" },
        required: true,
      },
      {
        id: "velocity-features",
        type: "multi-choice",
        question: "Which momentum features interest you?",
        subtitle: "Select all that sound useful",
        visual: "pills",
        maxSelections: 4,
        options: [
          { id: "realtime-graph", text: "Live engagement graph", icon: "📈" },
          { id: "trend-alerts", text: "Trending alerts", icon: "🔔" },
          { id: "best-times", text: "Best posting times", icon: "⏰" },
          { id: "viral-score", text: "Viral potential score", icon: "🚀" },
          { id: "cross-platform", text: "Cross-platform tracking", icon: "🌐" },
        ],
        required: false,
      },
    ],
  },
  {
    id: "verification",
    title: "Trust & Verification",
    subtitle: "How should identity affect influence?",
    icon: Shield,
    color: "purple",
    questions: [
      {
        id: "verify-fair",
        type: "slider",
        question: "Should verified users have more influence in polls?",
        subtitle: "Currently: More verification = stronger vote",
        sliderConfig: { min: 1, max: 5, minLabel: "Everyone equal", maxLabel: "Verified = more power" },
        required: true,
      },
      {
        id: "verify-methods",
        type: "multi-choice",
        question: "Which verifications should boost credibility most?",
        subtitle: "Pick up to 3",
        visual: "cards",
        maxSelections: 3,
        options: [
          { id: "wallet", text: "Crypto Wallet", icon: "🔗", description: "Blockchain identity" },
          { id: "social", text: "Social Accounts", icon: "🔵", description: "Google, X, Discord" },
          { id: "payment", text: "Payment Card", icon: "💳", description: "Financial verification" },
          { id: "phone", text: "Phone Number", icon: "📱", description: "SMS verification" },
          { id: "history", text: "Account History", icon: "📜", description: "Time on platform" },
        ],
        required: true,
      },
      {
        id: "owner-power",
        type: "single-choice",
        question: "Should platform builders have extra voting power?",
        subtitle: "People who invest time building VeggaStare",
        visual: "minimal",
        options: [
          { id: "yes-big", text: "Yes, significantly more", icon: "👑" },
          { id: "yes-little", text: "Yes, a small boost", icon: "✨" },
          { id: "equal", text: "No, everyone's equal", icon: "⚖️" },
          { id: "less", text: "Actually, they should vote less", icon: "🤐" },
        ],
        required: true,
      },
    ],
  },
  {
    id: "anti-gaming",
    title: "Keeping It Real",
    subtitle: "How should we prevent fake engagement?",
    icon: Eye,
    color: "red",
    questions: [
      {
        id: "view-quality",
        type: "yes-no",
        question: "Should quick scrolls count as views?",
        subtitle: "Currently requires 500ms on screen",
        required: true,
      },
      {
        id: "bot-measures",
        type: "multi-choice",
        question: "Which anti-bot measures do you support?",
        subtitle: "Select all you think are fair",
        visual: "pills",
        options: [
          { id: "rate-limit", text: "Rate limiting", icon: "⏱️" },
          { id: "captcha", text: "CAPTCHA challenges", icon: "🤖" },
          { id: "pattern", text: "Pattern detection", icon: "🔍" },
          { id: "device", text: "Device fingerprinting", icon: "📱" },
        ],
        required: true,
        maxSelections: 4,
      },
      {
        id: "transparency",
        type: "slider",
        question: "How transparent should our anti-gaming be?",
        subtitle: "Should we explain exactly how we detect fakes?",
        sliderConfig: { min: 1, max: 5, minLabel: "Keep it secret", maxLabel: "Explain everything" },
        required: true,
      },
    ],
  },
  {
    id: "ui-design",
    title: "Look & Feel",
    subtitle: "How should we display your Reach?",
    icon: Palette,
    color: "pink",
    questions: [
      {
        id: "chart-type",
        type: "single-choice",
        question: "How should we visualize your Reach score?",
        subtitle: "Pick your favorite style",
        visual: "cards",
        options: [
          { id: "radar", text: "Radar Chart", icon: "🕸️", description: "Spider web showing all pillars" },
          { id: "bars", text: "Progress Bars", icon: "📊", description: "Simple horizontal bars" },
          { id: "number", text: "Single Score", icon: "🔢", description: "Just show the total" },
          { id: "badges", text: "Achievement Badges", icon: "🏆", description: "Gamified level system" },
        ],
        required: true,
      },
      {
        id: "score-visibility",
        type: "single-choice",
        question: "Who should see your Reach score?",
        subtitle: "Privacy is important",
        visual: "minimal",
        options: [
          { id: "public", text: "Everyone", icon: "🌍" },
          { id: "followers", text: "Only followers", icon: "👥" },
          { id: "private", text: "Only me", icon: "🔒" },
          { id: "optional", text: "Let me choose", icon: "⚙️" },
        ],
        required: true,
      },
      {
        id: "insights-wanted",
        type: "multi-choice",
        question: "What insights would help you most?",
        subtitle: "Select all that interest you",
        visual: "pills",
        maxSelections: 5,
        options: [
          { id: "trends", text: "Score trends over time", icon: "📈" },
          { id: "tips", text: "How to improve", icon: "💡" },
          { id: "compare", text: "Compare to others", icon: "👥" },
          { id: "milestones", text: "Achievement alerts", icon: "🎉" },
          { id: "export", text: "Export my data", icon: "📥" },
        ],
        required: false,
      },
    ],
  },
  {
    id: "features",
    title: "What's Next?",
    subtitle: "Help us prioritize features",
    icon: Rocket,
    color: "cyan",
    questions: [
      {
        id: "feature-rank",
        type: "drag-rank",
        question: "Drag to rank these features",
        subtitle: "Top = most important to you",
        options: [
          { id: "velocity", text: "Real-time trending", icon: "⚡" },
          { id: "scheduling", text: "Post scheduling", icon: "📅" },
          { id: "video", text: "Video support", icon: "🎬" },
          { id: "ai", text: "AI insights", icon: "🤖" },
          { id: "mobile", text: "Mobile app", icon: "📱" },
          { id: "api", text: "Developer API", icon: "🔧" },
        ],
        required: true,
      },
      {
        id: "premium",
        type: "yes-no",
        question: "Would you pay for advanced analytics?",
        subtitle: "Premium features like detailed history, API access",
        required: true,
      },
      {
        id: "price-range",
        type: "single-choice",
        question: "What would you pay monthly?",
        subtitle: "If premium analytics were available",
        visual: "pills",
        options: [
          { id: "free", text: "Keep it free", icon: "🆓" },
          { id: "low", text: "$2-5", icon: "💵" },
          { id: "mid", text: "$5-10", icon: "💵💵" },
          { id: "high", text: "$10+", icon: "💎" },
        ],
        required: false,
      },
    ],
  },
  {
    id: "open-feedback",
    title: "Your Voice",
    subtitle: "Share your thoughts freely",
    icon: MessageSquare,
    color: "orange",
    questions: [
      {
        id: "one-change",
        type: "text",
        question: "If you could change ONE thing about VeggaStare?",
        subtitle: "Your most important suggestion",
        required: false,
      },
      {
        id: "daily-use",
        type: "text",
        question: "What would make you visit every day?",
        subtitle: "What's missing that you'd love?",
        required: false,
      },
      {
        id: "nps",
        type: "rating",
        question: "Would you recommend VeggaStare to a friend?",
        subtitle: "1 = Never, 5 = Absolutely!",
        sliderConfig: { min: 1, max: 5 },
        required: true,
      },
    ],
  },
];

// Calculate total questions - will be recalculated with actual data
const FALLBACK_TOTAL_QUESTIONS = FALLBACK_PHASES.reduce((sum, phase) => sum + phase.questions.length, 0);

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Components
// ─────────────────────────────────────────────────────────────────────────────

// Welcome Screen
function WelcomeScreen({ onStart, phases }: { onStart: () => void; phases: Phase[] }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center"
    >
      {/* Animated Logo */}
      <motion.div
        className="relative mb-8"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring" }}
      >
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 flex items-center justify-center shadow-2xl shadow-emerald-500/20">
          <Target className="w-12 h-12 text-white" />
        </div>
        <motion.div
          className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
        >
          <Sparkles className="w-4 h-4 text-white" />
        </motion.div>
      </motion.div>

      {/* Title */}
      <motion.h1
        className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Shape the Future of Reach
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        className="text-lg text-muted-foreground max-w-md mb-8"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        Help us build a better way to measure true social impact. 
        Your feedback directly shapes what we build next.
      </motion.p>

      {/* Stats Row */}
      <motion.div
        className="flex gap-6 mb-10"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">{phases.length}</div>
          <div className="text-xs text-muted-foreground">Sections</div>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">~5</div>
          <div className="text-xs text-muted-foreground">Minutes</div>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-500">100%</div>
          <div className="text-xs text-muted-foreground">Your voice</div>
        </div>
      </motion.div>

      {/* Phase Preview */}
      <motion.div
        className="flex flex-wrap justify-center gap-2 mb-10 max-w-lg"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        {phases.map((phase, i) => {
          const Icon = phase.icon;
          return (
            <motion.div
              key={phase.id}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                "bg-muted/50 text-muted-foreground border border-border/50"
              )}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.7 + i * 0.05 }}
            >
              <Icon className="w-3 h-3" />
              {phase.title}
            </motion.div>
          );
        })}
      </motion.div>

      {/* Start Button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        <Button
          size="lg"
          onClick={onStart}
          className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-8 py-6 text-lg rounded-2xl shadow-xl shadow-emerald-500/20 group"
        >
          Let's Begin
          <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </motion.div>

      <motion.p
        className="text-xs text-muted-foreground mt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        Skip any question you don't want to answer
      </motion.p>
    </motion.div>
  );
}

// Phase Selection Screen
function PhaseSelector({
  phases,
  currentPhase,
  completedPhases,
  answeredQuestions,
  onSelectPhase,
}: {
  phases: Phase[];
  currentPhase: number;
  completedPhases: Set<number>;
  answeredQuestions: Record<string, QuestionAnswer>;
  onSelectPhase: (index: number) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6"
    >
      <h2 className="text-xl font-bold text-center mb-2">Choose Your Path</h2>
      <p className="text-sm text-muted-foreground text-center mb-6">
        Complete all sections to reach 100% — or jump to what interests you most
      </p>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {phases.map((phase, index) => {
          const Icon = phase.icon;
          const isCompleted = completedPhases.has(index);
          const isCurrent = index === currentPhase;
          
          // Calculate phase progress
          const phaseAnswered = phase.questions.filter(
            q => answeredQuestions[q.id]?.value !== undefined
          ).length;
          const phaseProgress = phase.questions.length > 0 
            ? Math.round((phaseAnswered / phase.questions.length) * 100)
            : 0;

          return (
            <motion.button
              key={phase.id}
              onClick={() => onSelectPhase(index)}
              className={cn(
                "relative p-4 rounded-2xl border-2 text-left transition-all",
                "hover:scale-[1.02] active:scale-[0.98]",
                isCompleted
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : isCurrent
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30"
              )}
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              {isCompleted && (
                <div className="absolute top-2 right-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                </div>
              )}
              
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                `bg-${phase.color}-500/10`
              )}>
                <Icon className={cn("w-5 h-5", `text-${phase.color}-500`)} />
              </div>
              
              <h3 className="font-semibold text-sm mb-1">{phase.title}</h3>
              <p className="text-xs text-muted-foreground line-clamp-1">{phase.subtitle}</p>
              
              {/* Progress bar */}
              <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    isCompleted ? "bg-emerald-500" : "bg-primary"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${phaseProgress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {phaseAnswered}/{phase.questions.length} answered
              </p>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// Yes/No Question
function YesNoQuestion({
  question,
  answer,
  onAnswer,
}: {
  question: PollQuestion;
  answer?: QuestionAnswer;
  onAnswer: (val: QuestionAnswer) => void;
}) {
  const selected = answer?.value as boolean | undefined;

  return (
    <div className="space-y-6">
      <div className="flex gap-4 justify-center">
        {[
          { value: true, label: "Yes", icon: "👍", color: "emerald" },
          { value: false, label: "No", icon: "👎", color: "rose" },
        ].map(({ value, label, icon, color }) => (
          <motion.button
            key={label}
            onClick={() => onAnswer({ value })}
            className={cn(
              "relative flex flex-col items-center gap-2 p-6 rounded-2xl border-2 min-w-[120px]",
              "transition-all",
              selected === value
                ? `border-${color}-500 bg-${color}-500/10 shadow-lg shadow-${color}-500/10`
                : "border-border hover:border-muted-foreground/50"
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="text-4xl">{icon}</span>
            <span className={cn(
              "font-semibold",
              selected === value ? `text-${color}-500` : "text-foreground"
            )}>
              {label}
            </span>
            {selected === value && (
              <motion.div
                className={`absolute -top-1 -right-1 w-6 h-6 rounded-full bg-${color}-500 flex items-center justify-center`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                <Check className="w-4 h-4 text-white" />
              </motion.div>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// Rating Question (Stars or dots)
function RatingQuestion({
  question,
  answer,
  onAnswer,
}: {
  question: PollQuestion;
  answer?: QuestionAnswer;
  onAnswer: (val: QuestionAnswer) => void;
}) {
  const config = question.sliderConfig || { min: 1, max: 5 };
  const selected = answer?.value as number | undefined;
  const count = config.max - config.min + 1;

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2">
        {Array.from({ length: count }, (_, i) => i + config.min).map((value) => (
          <motion.button
            key={value}
            onClick={() => onAnswer({ value })}
            className={cn(
              "w-12 h-12 rounded-full border-2 flex items-center justify-center text-lg font-bold",
              "transition-all",
              selected !== undefined && value <= selected
                ? "border-amber-500 bg-amber-500 text-white"
                : "border-border hover:border-amber-500/50 text-muted-foreground"
            )}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {value}
          </motion.button>
        ))}
      </div>
      {config.minLabel && config.maxLabel && (
        <div className="flex justify-between text-xs text-muted-foreground px-2">
          <span>{config.minLabel}</span>
          <span>{config.maxLabel}</span>
        </div>
      )}
    </div>
  );
}

// Slider Question (Continuous)
function SliderQuestionV2({
  question,
  answer,
  onAnswer,
}: {
  question: PollQuestion;
  answer?: QuestionAnswer;
  onAnswer: (val: QuestionAnswer) => void;
}) {
  const config = question.sliderConfig || { min: 1, max: 5 };
  const selected = (answer?.value as number) ?? config.min;
  const percentage = ((selected - config.min) / (config.max - config.min)) * 100;

  return (
    <div className="space-y-4 px-4">
      {/* Value display */}
      {config.showValue && (
        <div className="text-center">
          <span className="text-4xl font-bold text-primary">{selected}</span>
          <span className="text-muted-foreground">/{config.max}</span>
        </div>
      )}
      
      {/* Custom slider track */}
      <div className="relative h-3 bg-muted rounded-full">
        <motion.div
          className="absolute h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          min={config.min}
          max={config.max}
          step={1}
          value={selected}
          onChange={(e) => onAnswer({ value: parseInt(e.target.value) })}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
        {/* Thumb indicator */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow-lg border-2 border-primary"
          style={{ left: `calc(${percentage}% - 12px)` }}
          initial={false}
          animate={{ left: `calc(${percentage}% - 12px)` }}
        />
      </div>

      {/* Labels */}
      {config.minLabel && config.maxLabel && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{config.minLabel}</span>
          <span>{config.maxLabel}</span>
        </div>
      )}
    </div>
  );
}

// Choice Question (Single or Multi)
function ChoiceQuestionV2({
  question,
  answer,
  onAnswer,
}: {
  question: PollQuestion;
  answer?: QuestionAnswer;
  onAnswer: (val: QuestionAnswer) => void;
}) {
  const isMulti = question.type === "multi-choice";
  const selectedArray: string[] = Array.isArray(answer?.value)
    ? answer.value
    : answer?.value
    ? [answer.value as string]
    : [];

  const handleSelect = (optionId: string) => {
    if (isMulti) {
      const newSelection = selectedArray.includes(optionId)
        ? selectedArray.filter((id) => id !== optionId)
        : question.maxSelections && selectedArray.length >= question.maxSelections
        ? selectedArray
        : [...selectedArray, optionId];
      onAnswer({ value: newSelection });
    } else {
      onAnswer({ value: optionId });
    }
  };

  const visual = question.visual || "cards";

  if (visual === "pills") {
    return (
      <div className="flex flex-wrap justify-center gap-2">
        {question.options?.map((option) => {
          const isSelected = selectedArray.includes(option.id);
          return (
            <motion.button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full border-2 text-sm font-medium",
                "transition-all",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary/50"
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {option.icon && <span>{option.icon}</span>}
              {option.text}
              {isSelected && <Check className="w-4 h-4" />}
            </motion.button>
          );
        })}
      </div>
    );
  }

  if (visual === "minimal") {
    return (
      <div className="space-y-2 max-w-md mx-auto">
        {question.options?.map((option) => {
          const isSelected = selectedArray.includes(option.id);
          return (
            <motion.button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl border text-left",
                "transition-all",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30"
              )}
              whileHover={{ x: 4 }}
            >
              {option.icon && <span className="text-xl">{option.icon}</span>}
              <span className="flex-1 font-medium">{option.text}</span>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check className="w-3 h-3 text-white" />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>
    );
  }

  // Cards visual (default)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
      {question.options?.map((option) => {
        const isSelected = selectedArray.includes(option.id);
        return (
          <motion.button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            className={cn(
              "relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 text-center",
              "transition-all",
              isSelected
                ? "border-primary bg-primary/5 shadow-lg"
                : "border-border hover:border-primary/30"
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isSelected && (
              <motion.div
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                <Check className="w-4 h-4 text-white" />
              </motion.div>
            )}
            {option.icon && <span className="text-3xl">{option.icon}</span>}
            <span className="font-semibold">{option.text}</span>
            {option.description && (
              <span className="text-xs text-muted-foreground">{option.description}</span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// Text Question
function TextQuestion({
  question,
  answer,
  onAnswer,
}: {
  question: PollQuestion;
  answer?: QuestionAnswer;
  onAnswer: (val: QuestionAnswer) => void;
}) {
  return (
    <div className="max-w-lg mx-auto">
      <textarea
        value={(answer?.value as string) || ""}
        onChange={(e) => onAnswer({ value: e.target.value })}
        placeholder="Share your thoughts..."
        className={cn(
          "w-full h-32 p-4 rounded-2xl border-2 resize-none",
          "bg-background text-foreground placeholder:text-muted-foreground",
          "focus:border-primary focus:ring-0 focus:outline-none",
          "transition-colors"
        )}
      />
      <p className="text-xs text-muted-foreground text-right mt-2">
        {((answer?.value as string) || "").length} characters
      </p>
    </div>
  );
}

// Drag Ranking Question
function DragRankQuestion({
  question,
  answer,
  onAnswer,
}: {
  question: PollQuestion;
  answer?: QuestionAnswer;
  onAnswer: (val: QuestionAnswer) => void;
}) {
  const options = question.options || [];
  const ranked = (answer?.value as string[]) || options.map((o) => o.id);

  const moveItem = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= ranked.length) return;
    
    const newRanked = [...ranked];
    [newRanked[fromIndex], newRanked[toIndex]] = [newRanked[toIndex], newRanked[fromIndex]];
    onAnswer({ value: newRanked });
  };

  return (
    <div className="max-w-md mx-auto space-y-2">
      {ranked.map((optionId, index) => {
        const option = options.find((o) => o.id === optionId);
        if (!option) return null;
        
        return (
          <motion.div
            key={optionId}
            layout
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border bg-card",
              "transition-shadow hover:shadow-md"
            )}
          >
            <span className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
              index === 0 ? "bg-amber-500 text-white" :
              index === 1 ? "bg-zinc-400 text-white" :
              index === 2 ? "bg-amber-700 text-white" :
              "bg-muted text-muted-foreground"
            )}>
              {index + 1}
            </span>
            {option.icon && <span className="text-xl">{option.icon}</span>}
            <span className="flex-1 font-medium">{option.text}</span>
            <div className="flex flex-col">
              <button
                onClick={() => moveItem(index, "up")}
                disabled={index === 0}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4 rotate-90" />
              </button>
              <button
                onClick={() => moveItem(index, "down")}
                disabled={index === ranked.length - 1}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4 rotate-90" />
              </button>
            </div>
          </motion.div>
        );
      })}
      <p className="text-xs text-muted-foreground text-center mt-4">
        Use arrows to reorder — top = most important
      </p>
    </div>
  );
}

// Question Wrapper
function QuestionWrapper({
  question,
  answer,
  onAnswer,
  questionNumber,
  totalQuestions,
}: {
  question: PollQuestion;
  answer?: QuestionAnswer;
  onAnswer: (val: QuestionAnswer) => void;
  questionNumber: number;
  totalQuestions: number;
}) {
  const renderQuestion = () => {
    switch (question.type) {
      case "yes-no":
        return <YesNoQuestion question={question} answer={answer} onAnswer={onAnswer} />;
      case "rating":
        return <RatingQuestion question={question} answer={answer} onAnswer={onAnswer} />;
      case "slider":
        return <SliderQuestionV2 question={question} answer={answer} onAnswer={onAnswer} />;
      case "single-choice":
      case "multi-choice":
        return <ChoiceQuestionV2 question={question} answer={answer} onAnswer={onAnswer} />;
      case "text":
        return <TextQuestion question={question} answer={answer} onAnswer={onAnswer} />;
      case "drag-rank":
        return <DragRankQuestion question={question} answer={answer} onAnswer={onAnswer} />;
      default:
        return <div>Unknown question type</div>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col items-center px-4"
    >
      {/* Question text */}
      <motion.h2
        className="text-2xl md:text-3xl font-bold text-center mb-3 max-w-2xl"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {question.question}
      </motion.h2>
      
      {question.subtitle && (
        <motion.p
          className="text-muted-foreground text-center mb-8 max-w-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {question.subtitle}
        </motion.p>
      )}

      {/* Question content */}
      <motion.div
        className="w-full max-w-2xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
      >
        {renderQuestion()}
      </motion.div>

      {/* Skip option */}
      {!question.required && (
        <motion.p
          className="text-xs text-muted-foreground mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          This question is optional — feel free to skip
        </motion.p>
      )}
    </motion.div>
  );
}

// Completion Screen
function CompletionScreen({ 
  answeredCount,
  totalQuestions,
  onSubmit,
  onClose,
  isSubmitting,
}: {
  answeredCount: number;
  totalQuestions: number;
  onSubmit: () => void;
  onClose: () => void;
  isSubmitting: boolean;
}) {
  const percentage = Math.round((answeredCount / totalQuestions) * 100);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.2 }}
        className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mb-6"
      >
        <Trophy className="w-12 h-12 text-white" />
      </motion.div>

      <motion.h2
        className="text-3xl font-bold mb-2"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {percentage === 100 ? "Perfect Score!" : "Great Progress!"}
      </motion.h2>

      <motion.p
        className="text-muted-foreground mb-8"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        You answered {answeredCount} out of {totalQuestions} questions ({percentage}%)
      </motion.p>

      {/* Progress ring */}
      <motion.div
        className="relative w-32 h-32 mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted"
          />
          <motion.circle
            cx="64"
            cy="64"
            r="56"
            fill="none"
            stroke="url(#gradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={352}
            initial={{ strokeDashoffset: 352 }}
            animate={{ strokeDashoffset: 352 - (352 * percentage) / 100 }}
            transition={{ duration: 1, delay: 0.5 }}
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold">{percentage}%</span>
        </div>
      </motion.div>

      <motion.div
        className="flex gap-4"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        <Button
          variant="outline"
          onClick={onClose}
          className="px-6"
        >
          Save for Later
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isSubmitting || answeredCount === 0}
          className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-6"
        >
          {isSubmitting ? "Submitting..." : "Submit Feedback"}
          {!isSubmitting && <Sparkles className="ml-2 w-4 h-4" />}
        </Button>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function ReachAuditPollV2({ pollId, onClose, onComplete }: ReachAuditPollV2Props) {
  const [screen, setScreen] = useState<"loading" | "welcome" | "phases" | "question" | "complete">("loading");
  const [currentPhase, setCurrentPhase] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phases, setPhases] = useState<Phase[]>(FALLBACK_PHASES);
  const [totalQuestions, setTotalQuestions] = useState(FALLBACK_TOTAL_QUESTIONS);

  // Fetch poll data from API
  useEffect(() => {
    if (!pollId) return;
    
    const fetchPoll = async () => {
      try {
        const res = await fetch(`/api/advanced-polls/${pollId}`);
        if (!res.ok) throw new Error('Failed to load poll');
        const data = await res.json();
        
        if (data.poll?.questions?.length > 0) {
          const dynamicPhases = transformToPhases(data.poll.questions);
          setPhases(dynamicPhases);
          const total = dynamicPhases.reduce((sum, p) => sum + p.questions.length, 0);
          setTotalQuestions(total);
        }
        
        setScreen("welcome");
      } catch (err) {
        console.error('Failed to load poll, using fallback:', err);
        setScreen("welcome");
      }
    };
    
    fetchPoll();
  }, [pollId]);

  const phase = phases[currentPhase];
  const question = phase?.questions[currentQuestion];

  // Calculate completed phases
  const completedPhases = useMemo(() => {
    const completed = new Set<number>();
    phases.forEach((phase, index) => {
      const allAnswered = phase.questions.every(
        (q) => !q.required || answers[q.id]?.value !== undefined
      );
      if (allAnswered && phase.questions.some(q => answers[q.id]?.value !== undefined)) {
        completed.add(index);
      }
    });
    return completed;
  }, [answers, phases]);

  // Calculate overall progress
  const answeredCount = Object.values(answers).filter((a) => a.value !== undefined).length;
  const overallProgress = Math.round((answeredCount / totalQuestions) * 100);

  // Handle answer
  const handleAnswer = useCallback((val: QuestionAnswer) => {
    if (question) {
      setAnswers((prev) => ({ ...prev, [question.id]: val }));
    }
  }, [question]);

  // Navigation
  const goNext = () => {
    if (currentQuestion < phase.questions.length - 1) {
      setCurrentQuestion((q) => q + 1);
    } else if (currentPhase < phases.length - 1) {
      // Phase complete, show phase selector or go to next
      setScreen("phases");
    } else {
      // All done
      setScreen("complete");
    }
  };

  const goPrev = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((q) => q - 1);
    } else if (currentPhase > 0) {
      setCurrentPhase((p) => p - 1);
      setCurrentQuestion(phases[currentPhase - 1].questions.length - 1);
    }
  };

  const selectPhase = (index: number) => {
    setCurrentPhase(index);
    setCurrentQuestion(0);
    setScreen("question");
  };

  // Submit
  const handleSubmit = async () => {
    if (!pollId) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const formattedAnswers = Object.entries(answers)
        .filter(([_, a]) => a.value !== undefined)
        .map(([questionId, answer]) => ({
          questionId,
          sliderValue: typeof answer.value === "number" ? answer.value : undefined,
          optionId: typeof answer.value === "string" ? answer.value : undefined,
          textValue: typeof answer.value === "string" && !phases.flatMap(p => p.questions).find(q => q.id === questionId && q.type !== "text") 
            ? answer.value 
            : undefined,
        }));

      const res = await fetch(`/api/advanced-polls/${pollId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: formattedAnswers, isPartial: answeredCount < totalQuestions }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to submit");
      }

      const data = await res.json();
      onComplete?.(data.response.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!pollId) return null;

  return (
    <Dialog open={!!pollId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border/50" accessibleTitle="REACH Feedback Poll">
        {/* Top bar */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            {screen === "question" && (
              <Button variant="ghost" size="sm" onClick={() => setScreen("phases")}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Sections
              </Button>
            )}
            {screen !== "welcome" && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${overallProgress}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground">{overallProgress}%</span>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="min-h-[500px] max-h-[calc(90vh-120px)] overflow-y-auto">
          <AnimatePresence mode="wait">
            {screen === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center min-h-[60vh] p-8"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mb-4 animate-pulse">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <p className="text-muted-foreground">Loading poll...</p>
              </motion.div>
            )}

            {screen === "welcome" && (
              <WelcomeScreen key="welcome" onStart={() => setScreen("phases")} phases={phases} />
            )}

            {screen === "phases" && (
              <PhaseSelector
                key="phases"
                phases={phases}
                currentPhase={currentPhase}
                completedPhases={completedPhases}
                answeredQuestions={answers}
                onSelectPhase={selectPhase}
              />
            )}

            {screen === "question" && question && (
              <div key={`${phase.id}-${question.id}`} className="py-12">
                {/* Phase indicator */}
                <motion.div
                  className="flex items-center justify-center gap-2 mb-8"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <phase.icon className={cn("w-5 h-5", `text-${phase.color}-500`)} />
                  <span className="text-sm font-medium text-muted-foreground">
                    {phase.title} • {currentQuestion + 1}/{phase.questions.length}
                  </span>
                </motion.div>

                <QuestionWrapper
                  question={question}
                  answer={answers[question.id]}
                  onAnswer={handleAnswer}
                  questionNumber={currentQuestion + 1}
                  totalQuestions={phase.questions.length}
                />
              </div>
            )}

            {screen === "complete" && (
              <CompletionScreen
                key="complete"
                answeredCount={answeredCount}
                totalQuestions={totalQuestions}
                onSubmit={handleSubmit}
                onClose={onClose}
                isSubmitting={isSubmitting}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Error display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center"
          >
            {error}
          </motion.div>
        )}

        {/* Bottom navigation for questions */}
        {screen === "question" && (
          <div className="flex items-center justify-between p-4 border-t border-border/50 bg-muted/30">
            <Button
              variant="ghost"
              onClick={goPrev}
              disabled={currentPhase === 0 && currentQuestion === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>

            <div className="flex gap-1">
              {phase.questions.map((_, idx) => (
                <motion.div
                  key={idx}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    idx === currentQuestion
                      ? "bg-primary"
                      : answers[phase.questions[idx].id]?.value !== undefined
                      ? "bg-emerald-500"
                      : "bg-muted-foreground/30"
                  )}
                  animate={{ scale: idx === currentQuestion ? 1.2 : 1 }}
                />
              ))}
            </div>

            <Button onClick={goNext}>
              {currentQuestion < phase.questions.length - 1 ? (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              ) : currentPhase < phases.length - 1 ? (
                <>
                  Next Section
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  Finish
                  <Check className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ReachAuditPollV2;
