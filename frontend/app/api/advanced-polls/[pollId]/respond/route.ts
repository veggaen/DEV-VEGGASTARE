import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import {
  PollResponseCreateSchema,
  PollResponseSubmitResponseSchema,
  POLL_SECURITY_CONFIG,
} from '@/lib/types/advanced-polls';
import crypto from 'crypto';

const LOG_PREFIX = '[api/advanced-polls/respond]';
const isDev = process.env.NODE_ENV !== 'production';

const toIsoString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length) return value;
  return new Date(String(value)).toISOString();
};

interface RouteParams {
  params: Promise<{ pollId: string }>;
}

// Hash IP for privacy-preserving tracking
function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + process.env.AUTH_SECRET).digest('hex').slice(0, 16);
}

// Calculate response quality based on completion and patterns
function calculateResponseQuality(
  answers: Array<{ sliderValue?: number; optionId?: string }>,
  totalQuestions: number,
  timeSpentMs: number
): number {
  const completionPct = answers.length / totalQuestions;
  
  // Penalize if too fast (< minTimePerQuestion per question)
  const expectedMinTime = totalQuestions * POLL_SECURITY_CONFIG.minTimePerQuestion;
  const timePenalty = timeSpentMs < expectedMinTime ? 0.5 : 1.0;
  
  // Check for suspicious patterns (all same choice)
  const optionIds = answers.filter(a => a.optionId).map(a => a.optionId);
  const uniqueOptions = new Set(optionIds).size;
  const patternPenalty = (optionIds.length > 3 && uniqueOptions === 1) ? 0.5 : 1.0;
  
  // Check for linear slider pattern
  const sliderValues = answers.filter(a => a.sliderValue !== undefined).map(a => a.sliderValue!);
  let linearPenalty = 1.0;
  if (sliderValues.length > 4) {
    const isLinear = sliderValues.every((v, i) => i === 0 || Math.abs(v - sliderValues[i-1]) <= 15);
    if (isLinear) linearPenalty = 0.7;
  }
  
  return Math.min(1.0, completionPct * timePenalty * patternPenalty * linearPenalty);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/advanced-polls/[pollId]/respond - Submit poll response
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { pollId } = await params;

  try {
    // Get poll and validate it exists and is active
    const poll = await dbPrisma.advancedPoll.findUnique({
      where: { id: pollId },
      include: {
        Questions: {
          where: { parentQuestionId: null },
          select: { id: true, isRequired: true },
        },
      },
    });

    if (!poll) {
      return NextResponse.json({ message: 'Poll not found' }, { status: 404 });
    }

    // Check auth first — unauthenticated users get 401 so they can be redirected to login
    const currentUser = await MyLibUserAuth();
    if (poll.requiresAuth && !currentUser?.id) {
      return NextResponse.json({ message: 'Authentication required for this poll' }, { status: 401 });
    }

    if (!poll.publishedAt) {
      return NextResponse.json({ message: 'Poll is not published' }, { status: 400 });
    }

    if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) {
      return NextResponse.json({ message: 'Poll has expired' }, { status: 400 });
    }

    // Parse request body
    const bodyResult = await parseJsonOrError(req, PollResponseCreateSchema);
    if (!bodyResult.ok) return bodyResult.response;
    const { answers: rawAnswers, isPartial } = bodyResult.data;

    // Validate that all questionIds exist in this poll
    const validQuestionIds = new Set(poll.Questions.map(q => q.id));
    const answers = rawAnswers.filter(a => validQuestionIds.has(a.questionId));
    
    if (answers.length === 0 && rawAnswers.length > 0) {
      console.warn(LOG_PREFIX, `No valid answers for poll ${pollId}. Received questionIds:`, 
        rawAnswers.map(a => a.questionId).slice(0, 5));
      return NextResponse.json({ 
        message: 'No valid answers provided. Question IDs do not match this poll.' 
      }, { status: 400 });
    }

    // Get IP hash and user agent for tracking
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor?.split(',')[0]?.trim() || 'unknown';
    const ipHash = hashIp(ip);
    const userAgent = req.headers.get('user-agent') || null;

    // Rate limiting check
    const recentResponses = await dbPrisma.pollResponse.count({
      where: {
        ipHash,
        startedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
      },
    });

    if (recentResponses >= POLL_SECURITY_CONFIG.maxResponsesPerIpPerHour) {
      return NextResponse.json(
        { message: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Check if user already responded (if authenticated)
    if (currentUser?.id) {
      const existingResponse = await dbPrisma.pollResponse.findUnique({
        where: {
          advancedPollId_userId: {
            advancedPollId: pollId,
            userId: currentUser.id,
          },
        },
      });

      if (existingResponse) {
        // Update existing response
        const startedAt = existingResponse.startedAt;
        const timeSpentMs = Date.now() - startedAt.getTime();
        
        const requiredQuestions = poll.Questions.filter(q => q.isRequired);
        const answeredRequired = answers.filter(a => 
          requiredQuestions.some(q => q.id === a.questionId)
        );
        const completionPct = (answeredRequired.length / requiredQuestions.length) * 100;
        const isComplete = !isPartial && completionPct >= 100;

        const responseQuality = calculateResponseQuality(answers, poll.Questions.length, timeSpentMs);

        // Update response and answers
        await dbPrisma.pollAnswer.deleteMany({
          where: { responseId: existingResponse.id },
        });

        const updatedResponse = await dbPrisma.pollResponse.update({
          where: { id: existingResponse.id },
          data: {
            completionPct,
            completedAt: isComplete ? new Date() : null,
            responseQuality,
            Answers: {
              create: answers.map((a) => ({
                questionId: a.questionId,
                optionId: a.optionId,
                sliderValue: a.sliderValue,
                scaleValue: a.scaleValue,
                textValue: a.textValue,
                comment: a.comment,
                Images: a.images ? {
                  create: a.images.map((img, idx) => ({
                    url: img.url,
                    caption: img.caption,
                    order: img.order ?? idx,
                    width: img.width,
                    height: img.height,
                    aspectRatio: img.aspectRatio,
                  })),
                } : undefined,
              })),
            },
          },
          include: {
            Answers: {
              include: { Images: { orderBy: { order: 'asc' } } },
            },
          },
        });

        // Update poll analytics
        await updatePollAnalytics(pollId);

        const dto = {
          response: {
            id: updatedResponse.id,
            advancedPollId: updatedResponse.advancedPollId,
            userId: updatedResponse.userId,
            sessionId: updatedResponse.sessionId,
            completionPct: updatedResponse.completionPct,
            startedAt: toIsoString(updatedResponse.startedAt),
            completedAt: updatedResponse.completedAt ? toIsoString(updatedResponse.completedAt) : null,
            responseQuality: updatedResponse.responseQuality,
            answers: updatedResponse.Answers.map((a) => ({
              id: a.id,
              responseId: a.responseId,
              questionId: a.questionId,
              optionId: a.optionId,
              sliderValue: a.sliderValue,
              scaleValue: a.scaleValue,
              textValue: a.textValue,
              comment: a.comment,
              images: a.Images.map((img) => ({
                id: img.id,
                answerId: img.answerId,
                url: img.url,
                caption: img.caption,
                order: img.order,
                width: img.width,
                height: img.height,
                aspectRatio: img.aspectRatio,
              })),
            })),
          },
          message: isComplete ? 'Response submitted' : 'Response saved (partial)',
        };

        return NextResponse.json(dto, { status: 200 });
      }
    }

    // Create new response
    const sessionId = crypto.randomUUID();
    const requiredQuestions = poll.Questions.filter(q => q.isRequired);
    const answeredRequired = answers.filter(a => 
      requiredQuestions.some(q => q.id === a.questionId)
    );
    const completionPct = requiredQuestions.length > 0 
      ? (answeredRequired.length / requiredQuestions.length) * 100 
      : 100;
    const isComplete = !isPartial && completionPct >= 100;
    
    // For new responses, estimate time as reasonable (can't penalize first submission)
    const responseQuality = calculateResponseQuality(answers, poll.Questions.length, POLL_SECURITY_CONFIG.minTimePerQuestion * poll.Questions.length * 2);

    const newResponse = await dbPrisma.pollResponse.create({
      data: {
        advancedPollId: pollId,
        userId: currentUser?.id || null,
        sessionId,
        completionPct,
        completedAt: isComplete ? new Date() : null,
        ipHash,
        userAgent,
        responseQuality,
        Answers: {
          create: answers.map((a) => ({
            questionId: a.questionId,
            optionId: a.optionId,
            sliderValue: a.sliderValue,
            scaleValue: a.scaleValue,
            textValue: a.textValue,
            comment: a.comment,
            Images: a.images ? {
              create: a.images.map((img, idx) => ({
                url: img.url,
                caption: img.caption,
                order: img.order ?? idx,
                width: img.width,
                height: img.height,
                aspectRatio: img.aspectRatio,
              })),
            } : undefined,
          })),
        },
      },
      include: {
        Answers: {
          include: { Images: { orderBy: { order: 'asc' } } },
        },
      },
    });

    // Update poll analytics
    await updatePollAnalytics(pollId);

    const dto = {
      response: {
        id: newResponse.id,
        advancedPollId: newResponse.advancedPollId,
        userId: newResponse.userId,
        sessionId: newResponse.sessionId,
        completionPct: newResponse.completionPct,
        startedAt: toIsoString(newResponse.startedAt),
        completedAt: newResponse.completedAt ? toIsoString(newResponse.completedAt) : null,
        responseQuality: newResponse.responseQuality,
        answers: newResponse.Answers.map((a) => ({
          id: a.id,
          responseId: a.responseId,
          questionId: a.questionId,
          optionId: a.optionId,
          sliderValue: a.sliderValue,
          scaleValue: a.scaleValue,
          textValue: a.textValue,
          comment: a.comment,
          images: a.Images.map((img) => ({
            id: img.id,
            answerId: img.answerId,
            url: img.url,
            caption: img.caption,
            order: img.order,
            width: img.width,
            height: img.height,
            aspectRatio: img.aspectRatio,
          })),
        })),
      },
      message: isComplete ? 'Response submitted' : 'Response saved (partial)',
    };

    const parsed = PollResponseSubmitResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error(LOG_PREFIX, 'Invalid POST DTO:', parsed.error);
      return NextResponse.json(
        { message: 'Internal Server Error', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 201 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error submitting response:', error);
    return NextResponse.json(
      { message: 'Error submitting response', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}

// Helper to update poll analytics cache
async function updatePollAnalytics(pollId: string) {
  const responses = await dbPrisma.pollResponse.findMany({
    where: { advancedPollId: pollId },
    select: { completionPct: true },
  });

  const totalResponses = responses.length;
  const avgCompletionPct = totalResponses > 0
    ? responses.reduce((sum, r) => sum + r.completionPct, 0) / totalResponses
    : 0;

  await dbPrisma.advancedPoll.update({
    where: { id: pollId },
    data: { totalResponses, avgCompletionPct },
  });
}
