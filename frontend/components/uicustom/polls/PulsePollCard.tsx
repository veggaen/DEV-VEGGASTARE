"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  MoreHorizontal,
  Edit2,
  Trash2,
  Share2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";

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
  isAdmin?: boolean;
  isOwner?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
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
    color: "bg-linear-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40",
    bgGlow: "from-amber-500/10 via-orange-500/5",
  },
};

export function PulsePollCard({ poll, onClick, isAdmin, isOwner, onEdit, onDelete, onShare }: PulsePollCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const config = TYPE_CONFIG[poll.type];
  const Icon = config.icon;

  const canManage = isAdmin || isOwner;

  const timeAgo = poll.publishedAt
    ? formatDistanceToNowStrict(new Date(poll.publishedAt), { addSuffix: true })
    : "Draft";

  const hasStarted = poll.userResponse && poll.userResponse.completionPct > 0;
  const isCompleted = poll.userResponse?.completedAt != null;
  const progressPct = poll.userResponse?.completionPct || 0;

  const handleCopyLink = () => {
    const url = `${window.location.origin}/feed?poll=${poll.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm("Are you sure you want to delete this poll? This cannot be undone.")) return;
    setIsDeleting(true);
    try {
      await onDelete();
      toast.success("Poll deleted");
    } catch (err) {
      toast.error("Failed to delete poll");
    } finally {
      setIsDeleting(false);
    }
  };

  const estimatedTime = poll.estimatedMinutes || Math.ceil(poll.questionCount * 0.5);

  return (
    <motion.div
      className={cn(
        "group relative rounded-xl border border-border/40 overflow-hidden cursor-pointer",
        "bg-card",
        "hover:border-border hover:shadow-md transition-all duration-200"
      )}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={poll.creator.image || undefined} />
              <AvatarFallback className="text-xs">{poll.creator.name?.[0] || "?"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{poll.creator.name || "Anonymous"}</div>
              <div className="text-xs text-muted-foreground/70">{timeAgo}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("shrink-0 gap-1 text-[11px] font-medium", config.color)}>
              <Icon className="h-3 w-3" />
              {config.label}
            </Badge>

            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={handleCopyLink}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.open(`/feed?poll=${poll.id}`, '_blank')}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </DropdownMenuItem>
                  {onShare && (
                    <DropdownMenuItem onClick={onShare}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share Poll
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {onEdit && (
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit Poll
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem 
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {isDeleting ? "Deleting..." : "Delete Poll"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-1.5">
          <h3 className="font-semibold text-base leading-snug tracking-tight">
            {poll.title}
          </h3>
          {poll.description && (
            <p className="text-sm text-muted-foreground/80 line-clamp-2 leading-relaxed">
              {poll.description}
            </p>
          )}
        </div>

        {/* Stats — subtle inline chips */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground/60">
          <span className="flex items-center gap-1">
            <Target className="h-3.5 w-3.5" />
            {poll.questionCount} Q
          </span>
          <span className="w-px h-3 bg-border" />
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {estimatedTime}m
          </span>
          <span className="w-px h-3 bg-border" />
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {poll.totalResponses}
          </span>
        </div>

        {/* User Progress or CTA */}
        {hasStarted && !isCompleted ? (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground/70">Progress</span>
              <span className="font-medium text-primary">{Math.round(progressPct)}%</span>
            </div>
            <Progress value={progressPct} className="h-1.5" />
            <Button variant="secondary" size="sm" className="w-full gap-2 h-9 text-xs font-medium">
              <PlayCircle className="h-3.5 w-3.5" />
              Continue
            </Button>
          </div>
        ) : isCompleted ? (
          <div className="flex items-center justify-between pt-1">
            <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px]">
              <Sparkles className="h-3 w-3" />
              Completed
            </Badge>
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground h-8">
              Results <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button 
            variant="default" 
            size="sm" 
            className={cn(
              "w-full gap-2 h-9 text-xs font-medium",
              poll.type === "REACH_ASSESSMENT" && "bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            )}
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Start {config.label}
          </Button>
        )}
      </div>
    </motion.div>
  );
}
