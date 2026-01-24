import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';

const LOG_PREFIX = '[api/polls/vote]';

// POST - Vote on a poll option (toggle: vote or unvote)
export async function POST(req: NextRequest) {
  const currentUser = await MyLibUserAuth();
  if (!currentUser?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { optionId } = body;

    if (!optionId) {
      return NextResponse.json({ message: 'optionId is required' }, { status: 400 });
    }

    // Get the option and its poll
    const option = await dbPrisma.pollOption.findUnique({
      where: { id: optionId },
      include: {
        poll: true,
        votes: { where: { userId: currentUser.id } },
      },
    });

    if (!option) {
      return NextResponse.json({ message: 'Poll option not found' }, { status: 404 });
    }

    // Check if poll has expired
    if (option.poll.expiresAt && new Date(option.poll.expiresAt) < new Date()) {
      return NextResponse.json({ message: 'This poll has expired' }, { status: 400 });
    }

    const hasVoted = option.votes.length > 0;

    if (hasVoted) {
      // Remove the vote (toggle off)
      await dbPrisma.pollVote.delete({
        where: {
          optionId_userId: {
            optionId,
            userId: currentUser.id,
          },
        },
      });

      console.log(LOG_PREFIX, `User ${currentUser.id} removed vote from option ${optionId}`);
      return NextResponse.json({ voted: false, message: 'Vote removed' }, { status: 200 });
    } else {
      // If not allowMultiple, remove any existing votes on other options first
      if (!option.poll.allowMultiple) {
        await dbPrisma.pollVote.deleteMany({
          where: {
            userId: currentUser.id,
            option: { pollId: option.poll.id },
          },
        });
      }

      // Add the vote
      await dbPrisma.pollVote.create({
        data: {
          optionId,
          userId: currentUser.id,
        },
      });

      console.log(LOG_PREFIX, `User ${currentUser.id} voted for option ${optionId}`);
      return NextResponse.json({ voted: true, message: 'Vote recorded' }, { status: 200 });
    }
  } catch (error) {
    console.error(LOG_PREFIX, 'Error voting:', error);
    return NextResponse.json(
      { message: 'Error voting', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

