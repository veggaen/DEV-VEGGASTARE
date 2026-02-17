"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  PieChart,
  List,
  MessageSquare,
  Users,
  TrendingUp,
  Eye,
  Globe,
  Lock,
  RefreshCw,
  Download,
  Share2,
  Filter,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Sparkles,
  Quote,
  Hash,
  Percent,
  Clock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DisplayMode = "summary" | "chart" | "list" | "detailed";

export interface ChoiceResponse {
  optionId: string;
  optionLabel: string;
  count: number;
  percentage: number;
  icon?: string;
}

export interface SliderResponse {
  value: number;
  count: number;
}

export interface TextResponse {
  id: string;
  text: string;
  userId?: string;
  userName?: string;
  timestamp?: Date;
  sentiment?: "positive" | "neutral" | "negative";
}

export interface QuestionResult {
  questionId: string;
  questionText: string;
  questionType: "slider" | "choice" | "multi-choice" | "text" | "ranking" | "open-text";
  totalResponses: number;
  
  // For choice/multi-choice
  choiceResponses?: ChoiceResponse[];
  
  // For slider
  sliderStats?: {
    average: number;
    median: number;
    mode: number;
    min: number;
    max: number;
    distribution: SliderResponse[];
    labels?: string[];
  };
  
  // For text/open-text
  textResponses?: TextResponse[];
  
  // For ranking
  rankingResults?: {
    itemId: string;
    itemLabel: string;
    averageRank: number;
    firstPlaceCount: number;
  }[];
  
  // User's own answer for highlighting
  userAnswer?: any;
  
  // Comments on this question
  comments?: TextResponse[];
}

export interface SectionResult {
  sectionId: string;
  sectionTitle: string;
  questions: QuestionResult[];
  completionRate: number;
}

export interface PollResultsProps {
  pollId: string;
  pollTitle: string;
  sections: SectionResult[];
  totalRespondents: number;
  completionRate: number;
  averageTimeMinutes?: number;
  isPublic?: boolean;
  isRealtime?: boolean;
  lastUpdated?: Date;
  onTogglePublic?: () => void;
  onRefresh?: () => void;
  onExport?: (format: "csv" | "json") => void;
}

// ─── Helper Components ────────────────────────────────────────────────────────

function ProgressBar({
  value,
  max = 100,
  color = "primary",
  showLabel = true,
  height = "h-3",
}: {
  value: number;
  max?: number;
  color?: string;
  showLabel?: boolean;
  height?: string;
}) {
  const percentage = Math.round((value / max) * 100);
  
  return (
    <div className="flex items-center gap-2 w-full">
      <div className={cn("flex-1 bg-muted rounded-full overflow-hidden", height)}>
        <motion.div
          className={cn("h-full rounded-full", `bg-${color}`)}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ backgroundColor: color.startsWith("#") ? color : undefined }}
        />
      </div>
      {showLabel && (
        <span className="text-sm text-muted-foreground min-w-[3rem] text-right">
          {percentage}%
        </span>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color = "primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
    >
      <div className={cn(
        "p-2 rounded-lg",
        `bg-${color}/10 text-${color}`
      )}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
        {subValue && (
          <p className="text-xs text-muted-foreground">{subValue}</p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Choice Results Chart ─────────────────────────────────────────────────────

function ChoiceChart({
  responses,
  userAnswer,
  mode = "bar",
}: {
  responses: ChoiceResponse[];
  userAnswer?: string | string[];
  mode?: "bar" | "pie";
}) {
  const colors = [
    "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444",
    "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
  ];

  const isUserSelected = (optionId: string) => {
    if (!userAnswer) return false;
    if (Array.isArray(userAnswer)) {
      return userAnswer.includes(optionId);
    }
    return userAnswer === optionId;
  };

  if (mode === "pie") {
    const total = responses.reduce((sum, r) => sum + r.count, 0);
    const segments = responses.map((response, idx) => {
      const angle = total > 0 ? (response.count / total) * 360 : 0;
      const startAngle = responses
        .slice(0, idx)
        .reduce((sum, current) => sum + (total > 0 ? (current.count / total) * 360 : 0), 0);
      return { response, idx, angle, startAngle };
    });

    return (
      <div className="flex items-center gap-6">
        {/* Pie Chart SVG */}
        <svg viewBox="0 0 100 100" className="w-32 h-32">
          {segments.map(({ response, idx, angle, startAngle }) => {

            // Calculate arc path
            const startRad = (startAngle - 90) * (Math.PI / 180);
            const endRad = (startAngle + angle - 90) * (Math.PI / 180);
            const x1 = 50 + 40 * Math.cos(startRad);
            const y1 = 50 + 40 * Math.sin(startRad);
            const x2 = 50 + 40 * Math.cos(endRad);
            const y2 = 50 + 40 * Math.sin(endRad);
            const largeArc = angle > 180 ? 1 : 0;

            return (
              <motion.path
                key={response.optionId}
                d={`M50,50 L${x1},${y1} A40,40 0 ${largeArc},1 ${x2},${y2} Z`}
                fill={colors[idx % colors.length]}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
                className={cn(
                  "transition-opacity cursor-pointer",
                  isUserSelected(response.optionId) && "stroke-white stroke-2"
                )}
              />
            );
          })}
        </svg>

        {/* Legend */}
        <div className="flex-1 space-y-1.5">
          {responses.map((response, idx) => (
            <div
              key={response.optionId}
              className={cn(
                "flex items-center gap-2 text-sm",
                isUserSelected(response.optionId) && "font-semibold"
              )}
            >
              <div
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: colors[idx % colors.length] }}
              />
              <span className="truncate flex-1">
                {response.icon && <span className="mr-1">{response.icon}</span>}
                {response.optionLabel}
              </span>
              <span className="text-muted-foreground">
                {response.percentage}%
              </span>
              {isUserSelected(response.optionId) && (
                <Badge variant="outline" className="text-xs py-0">You</Badge>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Bar chart (default)
  return (
    <div className="space-y-3">
      {responses.map((response, idx) => (
        <motion.div
          key={response.optionId}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.05 }}
          className={cn(
            "space-y-1",
            isUserSelected(response.optionId) && "pl-2 border-l-2 border-primary"
          )}
        >
          <div className="flex items-center justify-between text-sm">
            <span className={cn(
              "flex items-center gap-1.5",
              isUserSelected(response.optionId) && "font-semibold"
            )}>
              {response.icon && <span>{response.icon}</span>}
              {response.optionLabel}
              {isUserSelected(response.optionId) && (
                <Badge variant="outline" className="text-xs py-0 ml-1">Your choice</Badge>
              )}
            </span>
            <span className="text-muted-foreground">
              {response.count} ({response.percentage}%)
            </span>
          </div>
          <div className="h-6 bg-muted rounded overflow-hidden">
            <motion.div
              className="h-full rounded flex items-center justify-end pr-2"
              style={{ backgroundColor: colors[idx % colors.length] }}
              initial={{ width: 0 }}
              animate={{ width: `${response.percentage}%` }}
              transition={{ duration: 0.5, delay: idx * 0.05 }}
            >
              {response.percentage > 10 && (
                <span className="text-xs text-white font-medium">
                  {response.percentage}%
                </span>
              )}
            </motion.div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Slider Results Chart ─────────────────────────────────────────────────────

function SliderChart({
  stats,
  userAnswer,
}: {
  stats: QuestionResult["sliderStats"];
  userAnswer?: number;
}) {
  if (!stats) return null;

  const maxCount = Math.max(...stats.distribution.map((d) => d.count));

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Average:</span>
          <span className="font-semibold">{stats.average.toFixed(1)}</span>
          {stats.labels && stats.labels[Math.round(stats.average) - 1] && (
            <Badge variant="secondary" className="text-xs">
              {stats.labels[Math.round(stats.average) - 1]}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Median:</span>
          <span className="font-semibold">{stats.median}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Mode:</span>
          <span className="font-semibold">{stats.mode}</span>
        </div>
      </div>

      {/* Distribution chart */}
      <div className="flex items-end gap-1 h-24">
        {stats.distribution.map((d, idx) => {
          const height = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
          const isUserValue = userAnswer === d.value;

          return (
            <Tooltip key={d.value}>
              <TooltipTrigger asChild>
                <motion.div
                  className={cn(
                    "flex-1 rounded-t cursor-pointer transition-colors",
                    isUserValue
                      ? "bg-primary"
                      : "bg-primary/30 hover:bg-primary/50"
                  )}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.5, delay: idx * 0.05 }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {stats.labels?.[d.value - 1] || `Value: ${d.value}`}
                  <br />
                  {d.count} responses ({Math.round((d.count / stats.distribution.reduce((sum, x) => sum + x.count, 0)) * 100)}%)
                  {isUserValue && <><br /><span className="text-primary">Your answer</span></>}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Labels */}
      {stats.labels && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{stats.labels[0]}</span>
          <span>{stats.labels[stats.labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}

// ─── Text Responses List ──────────────────────────────────────────────────────

function TextResponsesList({
  responses,
  title = "Responses",
  showSentiment = false,
  maxVisible = 5,
}: {
  responses: TextResponse[];
  title?: string;
  showSentiment?: boolean;
  maxVisible?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleResponses = expanded ? responses : responses.slice(0, maxVisible);

  const sentimentColors = {
    positive: "text-green-500",
    neutral: "text-muted-foreground",
    negative: "text-red-500",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          {title}
          <Badge variant="secondary" className="text-xs">
            {responses.length}
          </Badge>
        </h4>
      </div>

      <ScrollArea className={cn(expanded ? "max-h-[400px]" : "max-h-[250px]")}>
        <div className="space-y-2">
          {visibleResponses.map((response, idx) => (
            <motion.div
              key={response.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="p-3 rounded-lg bg-muted/50 border border-border/30"
            >
              <div className="flex items-start gap-2">
                <Quote className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{response.text}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    {response.userName && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {response.userName}
                      </span>
                    )}
                    {response.timestamp && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(response.timestamp).toLocaleDateString()}
                      </span>
                    )}
                    {showSentiment && response.sentiment && (
                      <span className={cn(
                        "capitalize",
                        sentimentColors[response.sentiment]
                      )}>
                        {response.sentiment}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollArea>

      {responses.length > maxVisible && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full"
        >
          {expanded ? (
            <>Show less <ChevronDown className="ml-1 w-4 h-4" /></>
          ) : (
            <>Show all {responses.length} responses <ChevronRight className="ml-1 w-4 h-4" /></>
          )}
        </Button>
      )}
    </div>
  );
}

// ─── Question Result Card ─────────────────────────────────────────────────────

function QuestionResultCard({
  result,
  displayMode,
}: {
  result: QuestionResult;
  displayMode: DisplayMode;
}) {
  const [chartMode, setChartMode] = useState<"bar" | "pie">("bar");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl border border-border/50 bg-card/50 space-y-4"
    >
      {/* Question header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium">{result.questionText}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {result.totalResponses} responses • {result.questionType}
          </p>
        </div>
        
        {/* Chart mode toggle for choice questions */}
        {(result.questionType === "choice" || result.questionType === "multi-choice") && 
         displayMode === "chart" && (
          <div className="flex items-center gap-1">
            <Button
              variant={chartMode === "bar" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setChartMode("bar")}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant={chartMode === "pie" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setChartMode("pie")}
            >
              <PieChart className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Results content */}
      {(result.questionType === "choice" || result.questionType === "multi-choice") && 
       result.choiceResponses && (
        <ChoiceChart
          responses={result.choiceResponses}
          userAnswer={result.userAnswer}
          mode={displayMode === "chart" ? chartMode : "bar"}
        />
      )}

      {result.questionType === "slider" && result.sliderStats && (
        <SliderChart stats={result.sliderStats} userAnswer={result.userAnswer} />
      )}

      {(result.questionType === "text" || result.questionType === "open-text") && 
       result.textResponses && (
        <TextResponsesList
          responses={result.textResponses}
          title="Text Responses"
        />
      )}

      {/* Comments section */}
      {result.comments && result.comments.length > 0 && (
        <div className="pt-3 border-t border-border/50">
          <TextResponsesList
            responses={result.comments}
            title="Comments"
            maxVisible={3}
          />
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PollResultsDisplay({
  pollId,
  pollTitle,
  sections,
  totalRespondents,
  completionRate,
  averageTimeMinutes,
  isPublic = false,
  isRealtime = false,
  lastUpdated,
  onTogglePublic,
  onRefresh,
  onExport,
}: PollResultsProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("chart");
  const [selectedSection, setSelectedSection] = useState<string | "all">("all");
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const filteredSections = useMemo(() => {
    if (selectedSection === "all") return sections;
    return sections.filter((s) => s.sectionId === selectedSection);
  }, [sections, selectedSection]);

  const totalQuestions = sections.reduce((sum, s) => sum + s.questions.length, 0);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              {pollTitle} Results
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {totalRespondents} respondents • {totalQuestions} questions
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Visibility toggle */}
            {onTogglePublic && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isPublic ? "default" : "outline"}
                    size="sm"
                    onClick={onTogglePublic}
                    className="gap-1.5"
                  >
                    {isPublic ? (
                      <><Globe className="w-4 h-4" /> Public</>
                    ) : (
                      <><Lock className="w-4 h-4" /> Private</>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {isPublic ? "Results are publicly visible" : "Only you can see results"}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Realtime indicator */}
            {isRealtime && (
              <Badge variant="outline" className="gap-1 border-green-500/50 text-green-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </Badge>
            )}

            {/* Refresh */}
            {onRefresh && (
              <Button variant="outline" size="icon" onClick={onRefresh}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}

            {/* Share */}
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1.5">
              {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {copied ? "Copied!" : "Share"}
            </Button>

            {/* Export */}
            {onExport && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => onExport("csv")}>
                    <Download className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Export results</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={Users}
            label="Total Respondents"
            value={totalRespondents}
          />
          <StatCard
            icon={Percent}
            label="Completion Rate"
            value={`${completionRate}%`}
          />
          <StatCard
            icon={Hash}
            label="Questions"
            value={totalQuestions}
            subValue={`${sections.length} sections`}
          />
          {averageTimeMinutes && (
            <StatCard
              icon={Clock}
              label="Avg. Time"
              value={`${averageTimeMinutes}m`}
            />
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Section filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="bg-muted border border-border rounded-md px-2 py-1 text-sm"
            >
              <option value="all">All Sections</option>
              {sections.map((section) => (
                <option key={section.sectionId} value={section.sectionId}>
                  {section.sectionTitle}
                </option>
              ))}
            </select>
          </div>

          {/* Display mode */}
          <Tabs value={displayMode} onValueChange={(v) => setDisplayMode(v as DisplayMode)}>
            <TabsList className="h-8">
              <TabsTrigger value="chart" className="text-xs px-2 py-1 gap-1">
                <BarChart3 className="w-3.5 h-3.5" /> Charts
              </TabsTrigger>
              <TabsTrigger value="summary" className="text-xs px-2 py-1 gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Summary
              </TabsTrigger>
              <TabsTrigger value="list" className="text-xs px-2 py-1 gap-1">
                <List className="w-3.5 h-3.5" /> List
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Last updated */}
        {lastUpdated && (
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(lastUpdated).toLocaleString()}
          </p>
        )}

        {/* Results by section */}
        <div className="space-y-8">
          {filteredSections.map((section, sectionIdx) => (
            <motion.div
              key={section.sectionId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sectionIdx * 0.1 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
                    {sections.indexOf(section) + 1}
                  </span>
                  {section.sectionTitle}
                </h3>
                <Badge variant="outline" className="text-xs">
                  {section.completionRate}% completion
                </Badge>
              </div>

              <div className="space-y-4">
                {section.questions.map((question) => (
                  <QuestionResultCard
                    key={question.questionId}
                    result={question}
                    displayMode={displayMode}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty state */}
        {filteredSections.length === 0 && (
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No results to display</p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default PollResultsDisplay;
