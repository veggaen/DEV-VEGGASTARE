import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { PollAnalyticsResponseSchema } from '@/lib/types/advanced-polls';

const LOG_PREFIX = '[api/advanced-polls/analytics]';
const isDev = process.env.NODE_ENV !== 'production';

interface RouteParams {
  params: Promise<{ pollId: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/advanced-polls/[pollId]/analytics - Get poll analytics
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { pollId } = await params;

  try {
    const poll = await dbPrisma.advancedPoll.findUnique({
      where: { id: pollId },
      include: {
        Questions: {
          include: {
            Options: { orderBy: { order: 'asc' } },
            Answers: {
              include: {
                Response: {
                  select: { responseQuality: true },
                },
              },
            },
          },
          where: { parentQuestionId: null },
          orderBy: { order: 'asc' },
        },
        Responses: {
          select: {
            id: true,
            completionPct: true,
            completedAt: true,
            responseQuality: true,
            startedAt: true,
          },
        },
      },
    });

    if (!poll) {
      return NextResponse.json({ message: 'Poll not found' }, { status: 404 });
    }

    // Check if user can view analytics (creator, admin, or poll is non-anonymous)
    const currentUser = await MyLibUserAuth();
    const isCreator = currentUser?.id === poll.creatorId;
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER';
    
    if (!isCreator && !isAdmin && poll.isAnonymous) {
      return NextResponse.json({ message: 'Analytics not available for anonymous polls' }, { status: 403 });
    }

    // Calculate response stats
    const totalResponses = poll.Responses.length;
    const completedResponses = poll.Responses.filter(r => r.completedAt).length;
    const partialResponses = totalResponses - completedResponses;
    const avgCompletionPct = totalResponses > 0
      ? poll.Responses.reduce((sum, r) => sum + r.completionPct, 0) / totalResponses
      : 0;
    const avgResponseQuality = totalResponses > 0
      ? poll.Responses.reduce((sum, r) => sum + r.responseQuality, 0) / totalResponses
      : 0;

    // Responses over time (group by date)
    const responsesOverTime = new Map<string, number>();
    poll.Responses.forEach(r => {
      const date = r.startedAt.toISOString().split('T')[0];
      responsesOverTime.set(date, (responsesOverTime.get(date) || 0) + 1);
    });

    // Question-level analytics
    const questions = poll.Questions.map(q => {
      const answers = q.Answers;
      const totalAnswers = answers.length;

      const baseAnalytics = {
        questionId: q.id,
        questionText: q.text,
        questionType: q.type,
        totalAnswers,
      };

      // For choice questions: option breakdown
      if (q.type === 'SINGLE_CHOICE' || q.type === 'MULTI_CHOICE') {
        const optionCounts = new Map<string, number>();
        q.Options.forEach(o => optionCounts.set(o.id, 0));
        
        answers.forEach(a => {
          if (a.optionId) {
            const weight = a.Response.responseQuality;
            optionCounts.set(a.optionId, (optionCounts.get(a.optionId) || 0) + weight);
          }
        });

        const totalWeighted = Array.from(optionCounts.values()).reduce((a, b) => a + b, 0);

        return {
          ...baseAnalytics,
          optionBreakdown: q.Options.map(o => ({
            optionId: o.id,
            optionText: o.text,
            count: Math.round(optionCounts.get(o.id) || 0),
            percentage: totalWeighted > 0 
              ? Math.round(((optionCounts.get(o.id) || 0) / totalWeighted) * 100)
              : 0,
          })),
        };
      }

      // For slider questions: distribution stats
      if (q.type === 'SLIDER') {
        const values = answers
          .filter(a => a.sliderValue !== null)
          .map(a => ({ value: a.sliderValue!, weight: a.Response.responseQuality }));

        if (values.length === 0) {
          return {
            ...baseAnalytics,
            sliderStats: {
              average: 0,
              median: 0,
              min: 0,
              max: 0,
              distribution: [],
            },
          };
        }

        const weightedSum = values.reduce((sum, v) => sum + v.value * v.weight, 0);
        const weightTotal = values.reduce((sum, v) => sum + v.weight, 0);
        const average = weightedSum / weightTotal;

        const sortedValues = [...values].sort((a, b) => a.value - b.value);
        const median = sortedValues[Math.floor(sortedValues.length / 2)].value;
        const min = sortedValues[0].value;
        const max = sortedValues[sortedValues.length - 1].value;

        // Distribution buckets (0-100 in steps based on slider config)
        const sliderConfig = q.sliderConfig as { steps?: number } | null;
        const steps = sliderConfig?.steps || 7;
        const bucketSize = 100 / steps;
        const distribution: { value: number; count: number }[] = [];
        
        for (let i = 0; i < steps; i++) {
          const bucketMin = i * bucketSize;
          const bucketMax = (i + 1) * bucketSize;
          const count = values.filter(v => v.value >= bucketMin && v.value < bucketMax).length;
          distribution.push({ value: Math.round(bucketMin + bucketSize / 2), count });
        }

        return {
          ...baseAnalytics,
          sliderStats: {
            average: Math.round(average * 10) / 10,
            median: Math.round(median * 10) / 10,
            min,
            max,
            distribution,
          },
        };
      }

      // For scale questions
      if (q.type === 'SCALE') {
        const values = answers
          .filter(a => a.scaleValue !== null)
          .map(a => ({ value: a.scaleValue!, weight: a.Response.responseQuality }));

        if (values.length === 0) {
          return {
            ...baseAnalytics,
            scaleStats: {
              average: 0,
              distribution: Array.from({ length: 10 }, (_, i) => ({ value: i + 1, count: 0 })),
            },
          };
        }

        const weightedSum = values.reduce((sum, v) => sum + v.value * v.weight, 0);
        const weightTotal = values.reduce((sum, v) => sum + v.weight, 0);
        const average = weightedSum / weightTotal;

        const distribution = Array.from({ length: 10 }, (_, i) => ({
          value: i + 1,
          count: values.filter(v => v.value === i + 1).length,
        }));

        return {
          ...baseAnalytics,
          scaleStats: {
            average: Math.round(average * 10) / 10,
            distribution,
          },
        };
      }

      return baseAnalytics;
    });

    const dto = {
      pollId: poll.id,
      pollTitle: poll.title,
      totalResponses,
      avgCompletionPct: Math.round(avgCompletionPct * 10) / 10,
      completedResponses,
      partialResponses,
      avgResponseQuality: Math.round(avgResponseQuality * 100) / 100,
      responsesOverTime: Array.from(responsesOverTime.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      questions,
    };

    const parsed = PollAnalyticsResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error(LOG_PREFIX, 'Invalid GET DTO:', parsed.error);
      return NextResponse.json(
        { message: 'Internal Server Error', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error fetching analytics:', error);
    return NextResponse.json(
      { message: 'Error fetching analytics', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}
