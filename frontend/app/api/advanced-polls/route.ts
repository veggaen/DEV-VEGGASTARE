import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError, parseQueryOrError } from '@/lib/api-validate';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
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
  conversationId: z.string().min(1).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const queryResult = parseQueryOrError(req, listQuerySchema);
    if (!queryResult.ok) return queryResult.response;
    const { type, creatorId, conversationId } = queryResult.data;
    const page = queryResult.data.page ?? 1;
    const pageSize = queryResult.data.pageSize ?? 20;

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (creatorId) where.creatorId = creatorId;
    if (conversationId) where.conversationId = conversationId;
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
          // Quiz metadata from both sliderConfig JSON and direct columns
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

    const buildQuestionConfig = (q: (typeof questions)[number]): Prisma.InputJsonValue | undefined => {
      const base = (q.sliderConfig && typeof q.sliderConfig === 'object')
        ? { ...(q.sliderConfig as Record<string, unknown>) }
        : {};
      // Prefer indices—option IDs from builder don't exist in DB after create
      if (q.correctAnswerIndex !== undefined) base.correctAnswerIndex = q.correctAnswerIndex;
      else if (q.correctAnswerIndices !== undefined) base.correctAnswerIndices = q.correctAnswerIndices;
      else if (q.correctAnswer !== undefined) base.correctAnswer = q.correctAnswer;
      if (q.explanation !== undefined) base.explanation = q.explanation;
      if (q.wrongExplanation !== undefined) base.wrongExplanation = q.wrongExplanation;
      if (q.deepExplanation !== undefined) base.deepExplanation = q.deepExplanation;
      if (q.commitRequired !== undefined) base.commitRequired = q.commitRequired;
      if (q.trickQuestion !== undefined) base.trickQuestion = q.trickQuestion;
      return Object.keys(base).length > 0 ? (base as Prisma.InputJsonValue) : undefined;
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

    // Create the poll with questions and options (auto-publish so creators can test immediately)
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
        publishedAt: new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        Questions: {
          create: questions.map((q, qIndex) => ({
            text: q.text.trim(),
            description: q.description?.trim(),
            type: q.type ?? 'SINGLE_CHOICE',
            order: q.order ?? qIndex,
            isRequired: q.isRequired ?? true,
            allowImages: q.allowImages ?? false,
            allowComments: q.allowComments ?? false,
            sliderConfig: buildQuestionConfig(q),
            // Quiz/assessment fields (stored directly on question, not in JSON)
            shapeMatchPreset: q.shapeMatchPreset,
            trickQuestion: q.trickQuestion ?? false,
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
      questions: (poll as any).Questions.map((q: any) => ({
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
        options: q.Options.map((o: any) => ({
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
