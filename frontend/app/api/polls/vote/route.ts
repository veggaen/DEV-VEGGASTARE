import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError } from '@/lib/api-validate';
import { z } from 'zod';

const LOG_PREFIX = '[api/polls/vote]';

const isDev = process.env.NODE_ENV !== 'production';

const voteBodySchema = z.object({
  optionId: z.string().min(1),
});

// POST - Vote on a poll option (toggle: vote or unvote)
export async function POST(req: NextRequest) {
  const currentUser = await MyLibUserAuth();
  if (!currentUser?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bodyResult = await parseJsonOrError(req, voteBodySchema);
    if (!bodyResult.ok) return bodyResult.response;
    const { optionId } = bodyResult.data;

    // Get the option and its poll
    const option = await dbPrisma.pollOption.findUnique({
      where: { id: optionId },
      include: {
        Poll: true,
        PollVote: { where: { userId: currentUser.id } },
      },
    });

    if (!option) {
      return NextResponse.json({ message: 'Poll option not found' }, { status: 404 });
    }

    // Check if poll has expired
    if (option.Poll.expiresAt && new Date(option.Poll.expiresAt) < new Date()) {
      return NextResponse.json({ message: 'This poll has expired' }, { status: 400 });
    }

    const hasVoted = option.PollVote.length > 0;

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
      if (!option.Poll.allowMultiple) {
        await dbPrisma.pollVote.deleteMany({
          where: {
            userId: currentUser.id,
            PollOption: { pollId: option.Poll.id },
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
      { message: 'Error voting', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}

