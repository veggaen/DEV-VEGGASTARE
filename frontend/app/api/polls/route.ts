import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError, parseQueryOrError } from '@/lib/api-validate';
import { z } from 'zod';
import { PollCreateResponseSchema, PollGetResponseSchema } from '@/lib/types/polls';

const LOG_PREFIX = '[api/polls]';

const isDev = process.env.NODE_ENV !== 'production';

const toIsoString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length) return value;
  return new Date(String(value)).toISOString();
};

const createPollSchema = z.object({
  conversationId: z.string().min(1),
  question: z.string().trim().min(1).max(500),
  options: z.array(z.string().trim().min(1).max(200)).min(2).max(20),
  allowMultiple: z.boolean().optional().default(false),
  isAnonymous: z.boolean().optional().default(false),
  expiresAt: z.string().datetime().optional().nullable(),
});

const getPollQuerySchema = z.object({
  conversationId: z.string().min(1),
});

// POST - Create a poll for an existing conversation
export async function POST(req: NextRequest) {
  const currentUser = await MyLibUserAuth();
  if (!currentUser?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bodyResult = await parseJsonOrError(req, createPollSchema);
    if (!bodyResult.ok) return bodyResult.response;

    const { conversationId, question, options, allowMultiple, isAnonymous, expiresAt } = bodyResult.data;

    // Check if conversation exists and user can create a poll
    const conversation = await dbPrisma.conversation.findUnique({
      where: { id: conversationId },
      include: { Poll: true },
    });

    if (!conversation) {
      return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
    }

    // Only the creator can add a poll (for now)
    if (conversation.userId !== currentUser.id && currentUser.role !== 'ADMIN' && currentUser.role !== 'OWNER') {
      return NextResponse.json({ message: 'Only the conversation creator can add a poll' }, { status: 403 });
    }

    // Check if a poll already exists
    if (conversation.Poll) {
      return NextResponse.json({ message: 'This conversation already has a poll' }, { status: 400 });
    }

    // Create the poll with options
    const poll = await dbPrisma.poll.create({
      data: {
        question: question.trim(),
        conversationId,
        creatorId: currentUser.id,
        allowMultiple,
        isAnonymous,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        PollOption: {
          create: options.map((text: string, index: number) => ({
            text: text.trim(),
            order: index,
          })),
        },
      },
      include: {
        PollOption: {
          include: {
            PollVote: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    console.log(LOG_PREFIX, `Created poll "${question}" for conversation ${conversationId}`);

    const now = new Date();
    const totalVotes = poll.PollOption.reduce((sum, opt) => sum + (opt.PollVote?.length ?? 0), 0);
    const userVotedOptionIds: string[] = [];
    const isExpired = poll.expiresAt ? new Date(poll.expiresAt) < now : false;

    const dto = {
      poll: {
        id: String(poll.id),
        question: String(poll.question),
        allowMultiple: Boolean(poll.allowMultiple),
        isAnonymous: Boolean(poll.isAnonymous),
        expiresAt: poll.expiresAt ? toIsoString(poll.expiresAt) : null,
        isExpired,
        totalVotes,
        userVotedOptionIds,
        options: poll.PollOption.map((opt) => {
          const voteCount = opt.PollVote?.length ?? 0;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          return {
            id: String(opt.id),
            text: String(opt.text),
            order: Number(opt.order),
            voteCount,
            percentage,
            hasVoted: false,
            voters: poll.isAnonymous ? [] : (opt.PollVote ?? []).map((v) => String(v.userId)),
          };
        }),
      },
    };

    const parsedDto = PollCreateResponseSchema.safeParse(dto);
    if (!parsedDto.success) {
      console.error(LOG_PREFIX, 'Invalid POST DTO:', parsedDto.error);
      return NextResponse.json(
        { message: 'Internal Server Error', ...(isDev ? { issues: parsedDto.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsedDto.data, { status: 201 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error creating poll:', error);
    return NextResponse.json(
      { message: 'Error creating poll', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}

// GET - Get poll for a conversation
export async function GET(req: NextRequest) {
  const queryResult = parseQueryOrError(req, getPollQuerySchema);
  if (!queryResult.ok) return queryResult.response;
  const { conversationId } = queryResult.data;

  try {
    const poll = await dbPrisma.poll.findUnique({
      where: { conversationId },
      include: {
        PollOption: {
          include: {
            PollVote: true,
            _count: { select: { PollVote: true } },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!poll) {
      const dto = { poll: null };
      const parsedEmpty = PollGetResponseSchema.safeParse(dto);
      if (!parsedEmpty.success) {
        console.error(LOG_PREFIX, 'Invalid GET empty DTO:', parsedEmpty.error);
        return NextResponse.json(
          { message: 'Internal Server Error', ...(isDev ? { issues: parsedEmpty.error.issues } : {}) },
          { status: 500 }
        );
      }
      return NextResponse.json(parsedEmpty.data, { status: 200 });
    }

    // Get current user to check if they've voted
    const currentUser = await MyLibUserAuth();
    const userVotes = currentUser?.id
      ? await dbPrisma.pollVote.findMany({
          where: {
            userId: currentUser.id,
            PollOption: { pollId: poll.id },
          },
          select: { optionId: true },
        })
      : [];

    const userVotedOptionIds = userVotes.map((v) => v.optionId);

    const totalVotes = poll.PollOption.reduce((sum, opt) => sum + opt._count.PollVote, 0);
    const isExpired = poll.expiresAt ? new Date(poll.expiresAt) < new Date() : false;

    const dto = {
      poll: {
        id: String(poll.id),
        question: String(poll.question),
        allowMultiple: Boolean(poll.allowMultiple),
        isAnonymous: Boolean(poll.isAnonymous),
        expiresAt: poll.expiresAt ? toIsoString(poll.expiresAt) : null,
        isExpired,
        totalVotes,
        userVotedOptionIds,
        options: poll.PollOption.map((opt) => ({
          id: String(opt.id),
          text: String(opt.text),
          order: Number(opt.order),
          voteCount: Number(opt._count.PollVote),
          percentage: totalVotes > 0 ? Math.round((opt._count.PollVote / totalVotes) * 100) : 0,
          hasVoted: userVotedOptionIds.includes(opt.id),
          voters: poll.isAnonymous ? [] : opt.PollVote.map((v) => String(v.userId)),
        })),
      },
    };

    const parsedDto = PollGetResponseSchema.safeParse(dto);
    if (!parsedDto.success) {
      console.error(LOG_PREFIX, 'Invalid GET DTO:', parsedDto.error);
      return NextResponse.json(
        { message: 'Internal Server Error', ...(isDev ? { issues: parsedDto.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsedDto.data, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error fetching poll:', error);
    return NextResponse.json(
      { message: 'Error fetching poll', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}

