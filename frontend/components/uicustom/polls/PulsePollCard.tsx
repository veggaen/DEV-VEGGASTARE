"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  Clock,
  Users,
  Zap,
  ChevronRight,
  Star,
  Target,
  Sparkles,
  PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";

export interface PulsePollData {
  id: string;
  title: string;
  description?: string | null;
  type: "SIMPLE" | "SURVEY" | "QUIZ" | "FEEDBACK" | "REACH_ASSESSMENT";
  creator: {
    id: string;
    name: string | null;
    image?: string | null;
  };
  questionCount: number;
  totalResponses: number;
  avgCompletionPct: number;
  publishedAt: string | null;
  expiresAt: string | null;
  conversationId?: string | null;
  userResponse?: {
    completionPct: number;
    completedAt: string | null;
  } | null;
  estimatedMinutes?: number;
}

interface PulsePollCardProps {
  poll: PulsePollData;
  onClick: () => void;
}

const TYPE_CONFIG = {
  SIMPLE: {
    label: "Quick Poll",
    icon: BarChart3,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    bgGlow: "from-blue-500/5",
  },
  SURVEY: {
    label: "Survey",
    icon: Target,
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    bgGlow: "from-purple-500/5",
  },
  QUIZ: {
    label: "Quiz",
    icon: Star,
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    bgGlow: "from-amber-500/5",
  },
  FEEDBACK: {
    label: "Feedback",
    icon: Users,
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    bgGlow: "from-emerald-500/5",
  },
  REACH_ASSESSMENT: {
    label: "Innovation Poll",
    icon: Zap,
    color: "bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40",
    bgGlow: "from-amber-500/10 via-orange-500/5",
  },
};

export function PulsePollCard({ poll, onClick }: PulsePollCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const config = TYPE_CONFIG[poll.type];
  const Icon = config.icon;

  const timeAgo = poll.publishedAt
    ? formatDistanceToNowStrict(new Date(poll.publishedAt), { addSuffix: true })
    : "Draft";

  const hasStarted = poll.userResponse && poll.userResponse.completionPct > 0;
  const isCompleted = poll.userResponse?.completedAt != null;
  const progressPct = poll.userResponse?.completionPct || 0;

  const estimatedTime = poll.estimatedMinutes || Math.ceil(poll.questionCount * 0.5);

  return (
    <motion.div
      className={cn(
        "relative rounded-2xl border border-border/60 overflow-hidden cursor-pointer",
        "bg-gradient-to-br from-card via-card to-muted/20",
        "hover:border-primary/40 hover:shadow-lg transition-all duration-300"
      )}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Glow effect for special polls */}
      {poll.type === "REACH_ASSESSMENT" && (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5 pointer-events-none" />
      )}

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10 shrink-0 ring-2 ring-primary/20">
              <AvatarImage src={poll.creator.image || undefined} />
              <AvatarFallback>{poll.creator.name?.[0] || "?"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-medium truncate">{poll.creator.name || "Anonymous"}</div>
              <div className="text-xs text-muted-foreground">{timeAgo}</div>
            </div>
          </div>

          <Badge variant="outline" className={cn("shrink-0 gap-1", config.color)}>
            <Icon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>

        {/* Title & Description */}
        <div className="space-y-1">
          <h3 className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors">
            {poll.title}
          </h3>
          {poll.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {poll.description}
            </p>
          )}
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Target className="h-4 w-4" />
            {poll.questionCount} questions
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            ~{estimatedTime} min
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {poll.totalResponses} responses
          </span>
        </div>

        {/* User Progress or CTA */}
        {hasStarted && !isCompleted ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your progress</span>
              <span className="font-medium text-primary">{Math.round(progressPct)}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
            <Button variant="secondary" size="sm" className="w-full gap-2">
              <PlayCircle className="h-4 w-4" />
              Continue
            </Button>
          </div>
        ) : isCompleted ? (
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-3 w-3" />
              Completed
            </Badge>
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              View Results <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button 
            variant="default" 
            size="sm" 
            className={cn(
              "w-full gap-2",
              poll.type === "REACH_ASSESSMENT" && "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            )}
          >
            <PlayCircle className="h-4 w-4" />
            Start {config.label}
          </Button>
        )}
      </div>

      {/* Animated arrow on hover */}
      <motion.div
        className="absolute right-3 top-1/2 -translate-y-1/2"
        animate={{ x: isHovered ? 4 : 0, opacity: isHovered ? 1 : 0 }}
      >
        <ChevronRight className="h-5 w-5 text-primary" />
      </motion.div>
    </motion.div>
  );
}
