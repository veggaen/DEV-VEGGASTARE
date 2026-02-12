import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import {
  AdvancedPollSchema,
  AdvancedPollUpdateSchema,
  AdvancedPollDetailResponseSchema,
} from '@/lib/types/advanced-polls';
import { fetchPollWithRawSql } from '@/lib/advanced-polls-fetch';

const LOG_PREFIX = '[api/advanced-polls/[pollId]]';
const isDev = process.env.NODE_ENV !== 'production';

const toIsoString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length) return value;
  return new Date(String(value)).toISOString();
};

const resolveQuizMeta = (
  raw: unknown,
  options: { id: string }[],
): { correctAnswer?: string | string[] | null; explanation?: string | null; wrongExplanation?: string | null; deepExplanation?: string | null; commitRequired?: boolean; trickQuestion?: boolean } => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const cfg = raw as Record<string, unknown>;
  let correctAnswer: string | string[] | undefined;
  if (typeof cfg.correctAnswerIndex === 'number' && options[cfg.correctAnswerIndex]) {
    correctAnswer = options[cfg.correctAnswerIndex].id;
  } else if (Array.isArray(cfg.correctAnswerIndices)) {
    const ids = cfg.correctAnswerIndices
      .filter((i): i is number => typeof i === 'number')
      .map((i) => options[i]?.id)
      .filter((id): id is string => !!id);
    correctAnswer = ids.length > 0 ? ids : undefined;
  } else if (typeof cfg.correctAnswer === 'string') {
    correctAnswer = cfg.correctAnswer;
  } else if (Array.isArray(cfg.correctAnswer)) {
    correctAnswer = cfg.correctAnswer.filter((v): v is string => typeof v === 'string');
  }
  return {
    correctAnswer,
    explanation: typeof cfg.explanation === 'string' ? cfg.explanation : undefined,
    wrongExplanation: typeof cfg.wrongExplanation === 'string' ? cfg.wrongExplanation : undefined,
    deepExplanation: typeof cfg.deepExplanation === 'string' ? cfg.deepExplanation : undefined,
    commitRequired: typeof cfg.commitRequired === 'boolean' ? cfg.commitRequired : undefined,
    trickQuestion: typeof cfg.trickQuestion === 'boolean' ? cfg.trickQuestion : undefined,
  };
};

interface RouteParams {
  params: Promise<{ pollId: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/advanced-polls/[pollId] - Get a single poll with user's response
// ─────────────────────────────────────────────────────────────────────────────

async function fetchPoll(pollId: string) {
  try {
    return await dbPrisma.advancedPoll.findUnique({
      where: { id: pollId },
      include: {
        Questions: {
          include: {
            Options: { orderBy: { order: 'asc' } },
            ChildQuestions: {
              include: {
                Options: { orderBy: { order: 'asc' } },
              },
              orderBy: { order: 'asc' },
            },
          },
          where: { parentQuestionId: null },
          orderBy: { order: 'asc' },
        },
        Creator: {
          select: { id: true, name: true, image: true },
        },
      },
    });
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
    if (code === 'P2022') {
      console.warn(LOG_PREFIX, 'Prisma P2022 (column mismatch), using raw SQL fallback. Run: npx prisma generate');
      const raw = await fetchPollWithRawSql(dbPrisma, pollId);
      return raw?.poll ?? null;
    }
    throw err;
  }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { pollId } = await params;

  try {
    const poll = await fetchPoll(pollId);

    if (!poll) {
      return NextResponse.json({ message: 'Poll not found' }, { status: 404 });
    }

    // Check if user can view (unpublished polls only visible to creator)
    const currentUser = await MyLibUserAuth();
    if (!poll.publishedAt && poll.creatorId !== currentUser?.id) {
      return NextResponse.json({ message: 'Poll not found' }, { status: 404 });
    }

    // Get user's response if logged in
    let userResponse = null;
    if (currentUser?.id) {
      try {
        const response = await dbPrisma.pollResponse.findUnique({
          where: {
            advancedPollId_userId: {
              advancedPollId: pollId,
              userId: currentUser.id,
            },
          },
          include: {
            Answers: {
              include: {
                Images: { orderBy: { order: 'asc' } },
              },
            },
          },
        });
        if (response) {
          userResponse = {
            id: response.id,
            advancedPollId: response.advancedPollId,
            userId: response.userId,
            sessionId: response.sessionId,
            completionPct: response.completionPct,
            startedAt: toIsoString(response.startedAt),
            completedAt: response.completedAt ? toIsoString(response.completedAt) : null,
            responseQuality: response.responseQuality,
            answers: response.Answers.map((a) => ({
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
          };
        }
      } catch {
        // userResponse stays null if pollResponse fails (e.g. same P2022)
      }
    }

    type QuestionInput = {
      id: string;
      advancedPollId: string;
      parentQuestionId: string | null;
      text: string;
      description: string | null;
      type: string;
      order: number;
      isRequired: boolean;
      allowImages: boolean;
      allowComments: boolean;
      sliderConfig: unknown;
      shapeMatchPreset?: string | null;
      trickQuestion?: boolean;
      Options: { id: string; questionId: string; text: string; order: number; value: number | null; imageUrl: string | null }[];
      ChildQuestions?: QuestionInput[];
    };
    const mapQuestion = (q: QuestionInput): Record<string, unknown> => ({
      id: q.id,
      advancedPollId: q.advancedPollId,
      parentQuestionId: q.parentQuestionId,
      text: q.text,
      description: q.description,
      type: q.type,
      order: q.order,
      isRequired: q.isRequired,
      allowImages: q.allowImages,
      allowComments: q.allowComments,
      sliderConfig: q.sliderConfig,
      ...resolveQuizMeta(q.sliderConfig, q.Options ?? []),
      // Direct column fields (override sliderConfig values if set)
      ...(q.shapeMatchPreset && { shapeMatchPreset: q.shapeMatchPreset }),
      ...(q.trickQuestion && { trickQuestion: q.trickQuestion }),
      options: q.Options.map((o) => ({
        id: o.id,
        questionId: o.questionId,
        text: o.text,
        order: o.order,
        value: o.value,
        imageUrl: o.imageUrl,
      })),
      childQuestions: (q.ChildQuestions ?? []).map((c) => mapQuestion(c)),
    });

    const dto = {
      poll: {
        id: poll.id,
        title: poll.title,
        description: poll.description,
        type: poll.type,
        creatorId: poll.creatorId,
        conversationId: poll.conversationId,
        isAnonymous: poll.isAnonymous,
        allowPartial: poll.allowPartial,
        requiresAuth: poll.requiresAuth,
        expiresAt: poll.expiresAt ? toIsoString(poll.expiresAt) : null,
        publishedAt: poll.publishedAt ? toIsoString(poll.publishedAt) : null,
        createdAt: toIsoString(poll.createdAt),
        updatedAt: toIsoString(poll.updatedAt),
        totalResponses: poll.totalResponses,
        avgCompletionPct: poll.avgCompletionPct,
        questions: poll.Questions.map(mapQuestion),
      },
      userResponse,
    };

    const parsed = AdvancedPollDetailResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error(LOG_PREFIX, 'Invalid GET DTO:', parsed.error);
      return NextResponse.json(
        { message: 'Internal Server Error', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error fetching poll:', error);
    return NextResponse.json(
      { message: 'Error fetching poll', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/advanced-polls/[pollId] - Update poll settings
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { pollId } = await params;
  const currentUser = await MyLibUserAuth();
  if (!currentUser?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const poll = await dbPrisma.advancedPoll.findUnique({
      where: { id: pollId },
      select: { creatorId: true },
    });

    if (!poll) {
      return NextResponse.json({ message: 'Poll not found' }, { status: 404 });
    }

    if (poll.creatorId !== currentUser.id && currentUser.role !== 'ADMIN' && currentUser.role !== 'OWNER') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const bodyResult = await parseJsonOrError(req, AdvancedPollUpdateSchema);
    if (!bodyResult.ok) return bodyResult.response;
    const updates = bodyResult.data;

    const updated = await dbPrisma.advancedPoll.update({
      where: { id: pollId },
      data: {
        ...(updates.title !== undefined && { title: updates.title.trim() }),
        ...(updates.description !== undefined && { description: updates.description?.trim() }),
        ...(updates.isAnonymous !== undefined && { isAnonymous: updates.isAnonymous }),
        ...(updates.allowPartial !== undefined && { allowPartial: updates.allowPartial }),
        ...(updates.requiresAuth !== undefined && { requiresAuth: updates.requiresAuth }),
        ...(updates.expiresAt !== undefined && { expiresAt: updates.expiresAt ? new Date(updates.expiresAt) : null }),
        ...(updates.publishedAt !== undefined && { publishedAt: updates.publishedAt ? new Date(updates.publishedAt) : null }),
      },
      include: {
        Questions: {
          include: { Options: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
          where: { parentQuestionId: null },
        },
      },
    });

    const dto = {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      type: updated.type,
      creatorId: updated.creatorId,
      conversationId: updated.conversationId,
      isAnonymous: updated.isAnonymous,
      allowPartial: updated.allowPartial,
      requiresAuth: updated.requiresAuth,
      expiresAt: updated.expiresAt ? toIsoString(updated.expiresAt) : null,
      publishedAt: updated.publishedAt ? toIsoString(updated.publishedAt) : null,
      createdAt: toIsoString(updated.createdAt),
      updatedAt: toIsoString(updated.updatedAt),
      totalResponses: updated.totalResponses,
      avgCompletionPct: updated.avgCompletionPct,
      questions: updated.Questions.map((q) => ({
        id: q.id,
        advancedPollId: q.advancedPollId,
        parentQuestionId: q.parentQuestionId,
        text: q.text,
        description: q.description,
        type: q.type,
        order: q.order,
        isRequired: q.isRequired,
        allowImages: q.allowImages,
        allowComments: q.allowComments,
        sliderConfig: q.sliderConfig,
        ...resolveQuizMeta(q.sliderConfig, q.Options ?? []),
        options: q.Options.map((o) => ({
          id: o.id,
          questionId: o.questionId,
          text: o.text,
          order: o.order,
          value: o.value,
          imageUrl: o.imageUrl,
        })),
        childQuestions: [],
      })),
    };

    const parsed = AdvancedPollSchema.safeParse(dto);
    if (!parsed.success) {
      console.error(LOG_PREFIX, 'Invalid PATCH DTO:', parsed.error);
      return NextResponse.json(
        { message: 'Internal Server Error', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json({ poll: parsed.data, message: 'Poll updated' }, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error updating poll:', error);
    return NextResponse.json(
      { message: 'Error updating poll', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/advanced-polls/[pollId] - Delete a poll
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { pollId } = await params;
  const currentUser = await MyLibUserAuth();
  if (!currentUser?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const poll = await dbPrisma.advancedPoll.findUnique({
      where: { id: pollId },
      select: { creatorId: true },
    });

    if (!poll) {
      return NextResponse.json({ message: 'Poll not found' }, { status: 404 });
    }

    if (poll.creatorId !== currentUser.id && currentUser.role !== 'ADMIN' && currentUser.role !== 'OWNER') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    await dbPrisma.advancedPoll.delete({ where: { id: pollId } });

    return NextResponse.json({ message: 'Poll deleted' }, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error deleting poll:', error);
    return NextResponse.json(
      { message: 'Error deleting poll', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}
