import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError, parseQueryOrError } from '@/lib/api-validate';
import { z } from 'zod';
import {
  AdvancedPollCreateSchema,
  AdvancedPollSchema,
  AdvancedPollListResponseSchema,
  POLL_SECURITY_CONFIG,
  type PollQuestionOptionCreate,
} from '@/lib/types/advanced-polls';

const LOG_PREFIX = '[api/advanced-polls]';
const isDev = process.env.NODE_ENV !== 'production';

const toIsoString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length) return value;
  return new Date(String(value)).toISOString();
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/advanced-polls - List polls
// Query params: page, pageSize, type, creatorId
// ─────────────────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['SIMPLE', 'SURVEY', 'QUIZ', 'FEEDBACK', 'REACH_ASSESSMENT']).optional(),
  creatorId: z.string().min(1).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const queryResult = parseQueryOrError(req, listQuerySchema);
    if (!queryResult.ok) return queryResult.response;
    const { type, creatorId } = queryResult.data;
    const page = queryResult.data.page ?? 1;
    const pageSize = queryResult.data.pageSize ?? 20;

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (creatorId) where.creatorId = creatorId;
    // Only show published polls to non-creators
    const currentUser = await MyLibUserAuth();
    if (!currentUser?.id || currentUser.id !== creatorId) {
      where.publishedAt = { not: null };
    }

    const [polls, total] = await Promise.all([
      dbPrisma.advancedPoll.findMany({
        where,
        include: {
          Questions: {
            include: {
              Options: { orderBy: { order: 'asc' } },
            },
            orderBy: { order: 'asc' },
            where: { parentQuestionId: null }, // Only top-level questions
          },
          Creator: {
            select: { id: true, name: true, image: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      dbPrisma.advancedPoll.count({ where }),
    ]);

    const dto = {
      polls: polls.map((poll) => ({
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
        // Include Creator data for display
        Creator: poll.Creator ? {
          id: poll.Creator.id,
          name: poll.Creator.name,
          image: poll.Creator.image,
        } : null,
        questions: poll.Questions.map((q) => ({
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
          childQuestions: [], // Would need recursive fetch for nested
        })),
      })),
      total,
      page,
      pageSize,
    };

    const parsed = AdvancedPollListResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error(LOG_PREFIX, 'Invalid GET DTO:', parsed.error);
      return NextResponse.json(
        { message: 'Internal Server Error', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error listing polls:', error);
    return NextResponse.json(
      { message: 'Error listing polls', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/advanced-polls - Create a new poll
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const currentUser = await MyLibUserAuth();
  if (!currentUser?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bodyResult = await parseJsonOrError(req, AdvancedPollCreateSchema);
    if (!bodyResult.ok) return bodyResult.response;
    const { title, description, type, conversationId, isAnonymous, allowPartial, requiresAuth, expiresAt, questions } = bodyResult.data;

    // Check if requiresAuth for certain types
    if (type && POLL_SECURITY_CONFIG.requireAuthForTypes.includes(type) && !requiresAuth) {
      return NextResponse.json(
        { message: `Poll type ${type} requires authentication` },
        { status: 400 }
      );
    }

    // If linking to conversation, verify ownership
    if (conversationId) {
      const conversation = await dbPrisma.conversation.findUnique({
        where: { id: conversationId },
        select: { userId: true, AdvancedPoll: true },
      });
      if (!conversation) {
        return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
      }
      if (conversation.userId !== currentUser.id && currentUser.role !== 'ADMIN' && currentUser.role !== 'OWNER') {
        return NextResponse.json({ message: 'Only the conversation creator can add a poll' }, { status: 403 });
      }
      if (conversation.AdvancedPoll) {
        return NextResponse.json({ message: 'Conversation already has an advanced poll' }, { status: 400 });
      }
    }

    // Create the poll with questions and options
    const poll = await dbPrisma.advancedPoll.create({
      data: {
        title: title.trim(),
        description: description?.trim(),
        type,
        creatorId: currentUser.id,
        conversationId,
        isAnonymous,
        allowPartial,
        requiresAuth,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        Questions: {
          create: questions.map((q, qIndex) => ({
            text: q.text.trim(),
            description: q.description?.trim(),
            type: q.type,
            order: q.order ?? qIndex,
            isRequired: q.isRequired ?? true,
            allowImages: q.allowImages ?? false,
            allowComments: q.allowComments ?? false,
            sliderConfig: q.sliderConfig ?? undefined,
            Options: q.options ? {
              create: q.options.map((o, oIndex) => ({
                text: o.text.trim(),
                order: o.order ?? oIndex,
                value: o.value,
                imageUrl: o.imageUrl,
              })),
            } : undefined,
          })),
        },
      },
      include: {
        Questions: {
          include: {
            Options: { orderBy: { order: 'asc' } },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    const dto = {
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
      questions: poll.Questions.map((q) => ({
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
      console.error(LOG_PREFIX, 'Invalid POST DTO:', parsed.error);
      return NextResponse.json(
        { message: 'Internal Server Error', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json({ poll: parsed.data, message: 'Poll created successfully' }, { status: 201 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error creating poll:', error);
    return NextResponse.json(
      { message: 'Error creating poll', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}
