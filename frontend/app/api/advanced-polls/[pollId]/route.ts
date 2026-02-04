import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import {
  AdvancedPollSchema,
  AdvancedPollUpdateSchema,
  AdvancedPollDetailResponseSchema,
} from '@/lib/types/advanced-polls';

const LOG_PREFIX = '[api/advanced-polls/[pollId]]';
const isDev = process.env.NODE_ENV !== 'production';

const toIsoString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length) return value;
  return new Date(String(value)).toISOString();
};

interface RouteParams {
  params: Promise<{ pollId: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/advanced-polls/[pollId] - Get a single poll with user's response
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
    }

    const mapQuestion = (q: typeof poll.Questions[0]) => ({
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
      options: q.Options.map((o) => ({
        id: o.id,
        questionId: o.questionId,
        text: o.text,
        order: o.order,
        value: o.value,
        imageUrl: o.imageUrl,
      })),
      childQuestions: (q as any).ChildQuestions?.map(mapQuestion) ?? [],
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
