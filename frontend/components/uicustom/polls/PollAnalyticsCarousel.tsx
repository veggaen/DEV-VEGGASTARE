"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Bar, Pie, Radar, Line } from "react-chartjs-2";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { motion } from "framer-motion";
import {
  BarChart3,
  PieChart,
  Activity,
  Target,
  TrendingUp,
  Users,
  Calendar,
  Percent,
} from "lucide-react";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Tooltip,
  Legend,
  Filler
);

// Types
interface OptionBreakdown {
  optionId: string;
  text: string;
  count: number;
  percentage: number;
  weightedCount: number;
}

interface SliderStats {
  mean: number;
  median: number;
  mode: number;
  distribution: { value: number; count: number }[];
}

interface ScaleStats {
  mean: number;
  distribution: { value: number; count: number }[];
}

interface QuestionAnalytics {
  questionId: string;
  questionText: string;
  type: string;
  totalAnswers: number;
  optionBreakdown?: OptionBreakdown[];
  sliderStats?: SliderStats;
  scaleStats?: ScaleStats;
}

interface ResponseOverTime {
  date: string;
  count: number;
  cumulativeCount: number;
}

interface PollAnalytics {
  pollId: string;
  pollTitle: string;
  pollType: string;
  totalResponses: number;
  completedResponses: number;
  partialResponses: number;
  averageCompletionRate: number;
  averageQualityScore: number;
  questions: QuestionAnalytics[];
  responsesOverTime: ResponseOverTime[];
  demographicBreakdown?: Record<string, number>;
}

interface PollAnalyticsCarouselProps {
  analytics: PollAnalytics;
  className?: string;
  autoPlay?: boolean;
}

// Chart color palette
const COLORS = {
  primary: "rgba(124, 58, 237, 1)", // violet-600
  primaryLight: "rgba(124, 58, 237, 0.5)",
  secondary: "rgba(236, 72, 153, 1)", // pink-500
  accent: "rgba(34, 211, 238, 1)", // cyan-400
  success: "rgba(34, 197, 94, 1)", // green-500
  warning: "rgba(234, 179, 8, 1)", // yellow-500
  error: "rgba(239, 68, 68, 1)", // red-500
  muted: "rgba(148, 163, 184, 0.5)",
  background: "rgba(30, 41, 59, 0.8)",
  text: "#e5e7eb",
  grid: "rgba(148, 163, 184, 0.12)",
};

const CHART_PALETTE = [
  "rgba(124, 58, 237, 0.8)",
  "rgba(236, 72, 153, 0.8)",
  "rgba(34, 211, 238, 0.8)",
  "rgba(34, 197, 94, 0.8)",
  "rgba(234, 179, 8, 0.8)",
  "rgba(239, 68, 68, 0.8)",
  "rgba(99, 102, 241, 0.8)",
  "rgba(16, 185, 129, 0.8)",
];

// Common chart options
const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: COLORS.text,
        font: { size: 11 },
      },
    },
    tooltip: {
      backgroundColor: COLORS.background,
      titleColor: COLORS.text,
      bodyColor: COLORS.text,
      borderColor: COLORS.muted,
      borderWidth: 1,
    },
  },
};

export function PollAnalyticsCarousel({
  analytics,
  className,
  autoPlay = false,
}: PollAnalyticsCarouselProps) {
  // Prepare overview stats
  const overviewStats = useMemo(
    () => [
      {
        label: "Total Responses",
        value: analytics.totalResponses,
        icon: Users,
        color: "text-primary",
      },
      {
        label: "Completion Rate",
        value: `${Math.round(analytics.averageCompletionRate)}%`,
        icon: Percent,
        color: "text-green-500",
      },
      {
        label: "Quality Score",
        value: analytics.averageQualityScore.toFixed(2),
        icon: Target,
        color: "text-yellow-500",
      },
      {
        label: "Completed",
        value: analytics.completedResponses,
        icon: Activity,
        color: "text-cyan-400",
      },
    ],
    [analytics]
  );

  // Prepare responses over time chart data
  const timeSeriesData: ChartData<"line"> = useMemo(() => {
    return {
      labels: analytics.responsesOverTime.map((r) =>
        new Date(r.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      ),
      datasets: [
        {
          label: "Daily Responses",
          data: analytics.responsesOverTime.map((r) => r.count),
          borderColor: COLORS.primary,
          backgroundColor: COLORS.primaryLight,
          fill: true,
          tension: 0.4,
        },
        {
          label: "Cumulative",
          data: analytics.responsesOverTime.map((r) => r.cumulativeCount),
          borderColor: COLORS.accent,
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
        },
      ],
    };
  }, [analytics.responsesOverTime]);

  const timeSeriesOptions: ChartOptions<"line"> = {
    ...commonOptions,
    scales: {
      x: {
        ticks: { color: COLORS.text },
        grid: { color: COLORS.grid },
      },
      y: {
        ticks: { color: COLORS.text },
        grid: { color: COLORS.grid },
        beginAtZero: true,
      },
    },
  };

  // Generate question charts
  const questionCharts = useMemo(() => {
    return analytics.questions.map((q) => {
      if (
        q.type === "SINGLE_CHOICE" ||
        q.type === "MULTI_CHOICE" ||
        q.optionBreakdown
      ) {
        // Bar chart for choice questions
        const barData: ChartData<"bar"> = {
          labels: q.optionBreakdown?.map((o) => o.text) || [],
          datasets: [
            {
              label: "Responses",
              data: q.optionBreakdown?.map((o) => o.count) || [],
              backgroundColor: CHART_PALETTE,
              borderRadius: 4,
            },
          ],
        };

        const pieData: ChartData<"pie"> = {
          labels: q.optionBreakdown?.map((o) => o.text) || [],
          datasets: [
            {
              data: q.optionBreakdown?.map((o) => o.percentage) || [],
              backgroundColor: CHART_PALETTE,
              borderWidth: 2,
              borderColor: "rgba(30, 41, 59, 1)",
            },
          ],
        };

        return {
          question: q,
          type: "choice" as const,
          barData,
          pieData,
        };
      }

      if (q.type === "SLIDER" && q.sliderStats) {
        // Distribution bar chart for slider
        const distributionData: ChartData<"bar"> = {
          labels: q.sliderStats.distribution.map((d) => d.value.toString()),
          datasets: [
            {
              label: "Distribution",
              data: q.sliderStats.distribution.map((d) => d.count),
              backgroundColor: CHART_PALETTE.slice(0, q.sliderStats.distribution.length),
              borderRadius: 4,
            },
          ],
        };

        return {
          question: q,
          type: "slider" as const,
          distributionData,
          stats: q.sliderStats,
        };
      }

      if (q.type === "SCALE" && q.scaleStats) {
        // Distribution for scale questions
        const scaleData: ChartData<"bar"> = {
          labels: q.scaleStats.distribution.map((d) => d.value.toString()),
          datasets: [
            {
              label: "Responses",
              data: q.scaleStats.distribution.map((d) => d.count),
              backgroundColor: CHART_PALETTE,
              borderRadius: 4,
            },
          ],
        };

        return {
          question: q,
          type: "scale" as const,
          scaleData,
          stats: q.scaleStats,
        };
      }

      return null;
    }).filter(Boolean);
  }, [analytics.questions]);

  // Radar chart for Reach assessment
  const radarData: ChartData<"radar"> | null = useMemo(() => {
    if (analytics.pollType !== "REACH_ASSESSMENT") return null;

    const sliderQuestions = analytics.questions.filter(
      (q) => q.type === "SLIDER" && q.sliderStats
    );

    if (sliderQuestions.length < 3) return null;

    return {
      labels: sliderQuestions.map((q) =>
        q.questionText.length > 20
          ? q.questionText.substring(0, 20) + "..."
          : q.questionText
      ),
      datasets: [
        {
          label: "Average Score",
          data: sliderQuestions.map((q) => q.sliderStats?.mean || 0),
          backgroundColor: COLORS.primaryLight,
          borderColor: COLORS.primary,
          borderWidth: 2,
          pointBackgroundColor: COLORS.primary,
        },
      ],
    };
  }, [analytics.pollType, analytics.questions]);

  const radarOptions: ChartOptions<"radar"> = {
    ...commonOptions,
    scales: {
      r: {
        angleLines: { color: COLORS.grid },
        grid: { color: COLORS.grid },
        pointLabels: { color: COLORS.text, font: { size: 10 } },
        ticks: { color: COLORS.text, backdropColor: "transparent" },
        suggestedMin: 0,
        suggestedMax: 7,
      },
    },
  };

  const barOptions: ChartOptions<"bar"> = {
    ...commonOptions,
    indexAxis: "y" as const,
    scales: {
      x: {
        ticks: { color: COLORS.text },
        grid: { color: COLORS.grid },
        beginAtZero: true,
      },
      y: {
        ticks: { color: COLORS.text },
        grid: { display: false },
      },
    },
    plugins: {
      ...commonOptions.plugins,
      legend: { display: false },
    },
  };

  const pieOptions: ChartOptions<"pie"> = {
    ...commonOptions,
    plugins: {
      ...commonOptions.plugins,
      legend: {
        position: "right" as const,
        labels: {
          color: COLORS.text,
          font: { size: 10 },
          boxWidth: 12,
        },
      },
    },
  };

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Analytics: {analytics.pollTitle}
        </h3>
        <span className="text-sm text-muted-foreground">
          {analytics.totalResponses} total responses
        </span>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {overviewStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-4 rounded-lg bg-muted/50 border"
          >
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={cn("w-4 h-4", stat.color)} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <span className="text-2xl font-bold">{stat.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Charts Carousel */}
      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {/* Responses Over Time */}
          <CarouselItem className="pl-2 md:pl-4 md:basis-1/2 lg:basis-2/3">
            <div className="p-4 rounded-lg border bg-card h-[300px]">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Responses Over Time
              </h4>
              <div className="h-[240px]">
                <Line data={timeSeriesData} options={timeSeriesOptions} />
              </div>
            </div>
          </CarouselItem>

          {/* Radar Chart for Reach Assessment */}
          {radarData && (
            <CarouselItem className="pl-2 md:pl-4 md:basis-1/2">
              <div className="p-4 rounded-lg border bg-card h-[300px]">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Reach Dimensions
                </h4>
                <div className="h-[240px]">
                  <Radar data={radarData} options={radarOptions} />
                </div>
              </div>
            </CarouselItem>
          )}

          {/* Question Charts */}
          {questionCharts.map((chart) => {
            if (!chart) return null;

            if (chart.type === "choice") {
              return (
                <CarouselItem
                  key={chart.question.questionId}
                  className="pl-2 md:pl-4 md:basis-1/2"
                >
                  <div className="p-4 rounded-lg border bg-card h-[300px]">
                    <h4 className="text-sm font-medium mb-3 truncate">
                      {chart.question.questionText}
                    </h4>
                    <div className="grid grid-cols-2 gap-4 h-[240px]">
                      <div className="h-full">
                        <Bar data={chart.barData} options={barOptions} />
                      </div>
                      <div className="h-full">
                        <Pie data={chart.pieData} options={pieOptions} />
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              );
            }

            if (chart.type === "slider") {
              return (
                <CarouselItem
                  key={chart.question.questionId}
                  className="pl-2 md:pl-4 md:basis-1/2"
                >
                  <div className="p-4 rounded-lg border bg-card h-[300px]">
                    <h4 className="text-sm font-medium mb-2 truncate">
                      {chart.question.questionText}
                    </h4>
                    <div className="flex gap-4 text-xs text-muted-foreground mb-2">
                      <span>Mean: <strong>{chart.stats.mean.toFixed(2)}</strong></span>
                      <span>Median: <strong>{chart.stats.median}</strong></span>
                      <span>Mode: <strong>{chart.stats.mode}</strong></span>
                    </div>
                    <div className="h-[200px]">
                      <Bar
                        data={chart.distributionData}
                        options={{
                          ...commonOptions,
                          scales: {
                            x: {
                              ticks: { color: COLORS.text },
                              grid: { display: false },
                            },
                            y: {
                              ticks: { color: COLORS.text },
                              grid: { color: COLORS.grid },
                              beginAtZero: true,
                            },
                          },
                          plugins: {
                            ...commonOptions.plugins,
                            legend: { display: false },
                          },
                        }}
                      />
                    </div>
                  </div>
                </CarouselItem>
              );
            }

            if (chart.type === "scale") {
              return (
                <CarouselItem
                  key={chart.question.questionId}
                  className="pl-2 md:pl-4 md:basis-1/2"
                >
                  <div className="p-4 rounded-lg border bg-card h-[300px]">
                    <h4 className="text-sm font-medium mb-2 truncate">
                      {chart.question.questionText}
                    </h4>
                    <div className="text-xs text-muted-foreground mb-2">
                      Average: <strong>{chart.stats.mean.toFixed(2)}</strong>
                    </div>
                    <div className="h-[220px]">
                      <Bar
                        data={chart.scaleData}
                        options={{
                          ...commonOptions,
                          scales: {
                            x: {
                              ticks: { color: COLORS.text },
                              grid: { display: false },
                            },
                            y: {
                              ticks: { color: COLORS.text },
                              grid: { color: COLORS.grid },
                              beginAtZero: true,
                            },
                          },
                          plugins: {
                            ...commonOptions.plugins,
                            legend: { display: false },
                          },
                        }}
                      />
                    </div>
                  </div>
                </CarouselItem>
              );
            }

            return null;
          })}
        </CarouselContent>
        <CarouselPrevious className="left-0" />
        <CarouselNext className="right-0" />
      </Carousel>

      {/* Question Breakdown Summary */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">
          Question Summary
        </h4>
        <div className="space-y-2">
          {analytics.questions.map((q, i) => (
            <div
              key={q.questionId}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-sm truncate max-w-[200px] md:max-w-[400px]">
                  {q.questionText}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="px-2 py-1 rounded bg-muted">
                  {q.type.replace("_", " ")}
                </span>
                <span className="font-medium text-foreground">
                  {q.totalAnswers} answers
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PollAnalyticsCarousel;
