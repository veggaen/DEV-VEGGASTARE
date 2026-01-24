import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';

const LOG_PREFIX = '[api/polls]';

// POST - Create a poll for an existing conversation
export async function POST(req: NextRequest) {
  const currentUser = await MyLibUserAuth();
  if (!currentUser?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { conversationId, question, options, allowMultiple, isAnonymous, expiresAt } = body;

    // Validate required fields
    if (!conversationId || !question || !options || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { message: 'conversationId, question, and at least 2 options are required' },
        { status: 400 }
      );
    }

    // Check if conversation exists and user can create a poll
    const conversation = await dbPrisma.conversation.findUnique({
      where: { id: conversationId },
      include: { poll: true },
    });

    if (!conversation) {
      return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
    }

    // Only the creator can add a poll (for now)
    if (conversation.userId !== currentUser.id && currentUser.role !== 'ADMIN' && currentUser.role !== 'OWNER') {
      return NextResponse.json({ message: 'Only the conversation creator can add a poll' }, { status: 403 });
    }

    // Check if a poll already exists
    if (conversation.poll) {
      return NextResponse.json({ message: 'This conversation already has a poll' }, { status: 400 });
    }

    // Create the poll with options
    const poll = await dbPrisma.poll.create({
      data: {
        question: question.trim(),
        conversationId,
        creatorId: currentUser.id,
        allowMultiple: allowMultiple || false,
        isAnonymous: isAnonymous || false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        options: {
          create: options.map((text: string, index: number) => ({
            text: text.trim(),
            order: index,
          })),
        },
      },
      include: {
        options: {
          include: {
            votes: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    console.log(LOG_PREFIX, `Created poll "${question}" for conversation ${conversationId}`);

    return NextResponse.json({ poll }, { status: 201 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error creating poll:', error);
    return NextResponse.json(
      { message: 'Error creating poll', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET - Get poll for a conversation
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('conversationId');

  if (!conversationId) {
    return NextResponse.json({ message: 'conversationId is required' }, { status: 400 });
  }

  try {
    const poll = await dbPrisma.poll.findUnique({
      where: { conversationId },
      include: {
        options: {
          include: {
            votes: true,
            _count: { select: { votes: true } },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!poll) {
      return NextResponse.json({ poll: null }, { status: 200 });
    }

    // Get current user to check if they've voted
    const currentUser = await MyLibUserAuth();
    const userVotes = currentUser?.id
      ? await dbPrisma.pollVote.findMany({
          where: {
            userId: currentUser.id,
            option: { pollId: poll.id },
          },
          select: { optionId: true },
        })
      : [];

    const userVotedOptionIds = userVotes.map((v) => v.optionId);

    // Calculate total votes
    const totalVotes = poll.options.reduce((sum, opt) => sum + opt._count.votes, 0);

    // Format response
    const formattedPoll = {
      ...poll,
      totalVotes,
      userVotedOptionIds,
      isExpired: poll.expiresAt ? new Date(poll.expiresAt) < new Date() : false,
      options: poll.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        order: opt.order,
        voteCount: opt._count.votes,
        percentage: totalVotes > 0 ? Math.round((opt._count.votes / totalVotes) * 100) : 0,
        hasVoted: userVotedOptionIds.includes(opt.id),
        // Only include voter IDs if not anonymous
        voters: poll.isAnonymous ? [] : opt.votes.map((v) => v.userId),
      })),
    };

    return NextResponse.json({ poll: formattedPoll }, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error fetching poll:', error);
    return NextResponse.json(
      { message: 'Error fetching poll', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

