import { dbPrisma } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';

const LOG_PREFIX = '[api/messages/[messageId]/repost]';

/**
 * POST /api/messages/:messageId/repost
 *
 * Toggles a repulse (repost) on a vibe (message). If the user already
 * repulsed, it's removed. Returns the new repost count and broadcasts
 * a real-time update via Pusher.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { messageId } = await params;
  const userId = session.id;

  try {
    // Verify the message exists and get its conversationId
    const message = await dbPrisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true, senderId: true },
    });

    if (!message) {
      return NextResponse.json({ message: 'Message not found' }, { status: 404 });
    }

    // Check if user already repulsed this vibe
    const existing = await dbPrisma.messageRepost.findUnique({
      where: { messageId_userId: { messageId, userId } },
    });

    let repulsed: boolean;
    let repostCount: number;

    if (existing) {
      // Remove repulse
      await dbPrisma.$transaction([
        dbPrisma.messageRepost.delete({
          where: { id: existing.id },
        }),
        dbPrisma.message.update({
          where: { id: messageId },
          data: { repostCount: { decrement: 1 } },
        }),
      ]);
      repulsed = false;
      repostCount = Math.max(
        0,
        (await dbPrisma.message.findUnique({
          where: { id: messageId },
          select: { repostCount: true },
        }))?.repostCount ?? 0,
      );
    } else {
      // Add repulse
      await dbPrisma.$transaction([
        dbPrisma.messageRepost.create({
          data: { messageId, userId },
        }),
        dbPrisma.message.update({
          where: { id: messageId },
          data: { repostCount: { increment: 1 } },
        }),
      ]);
      repulsed = true;
      repostCount =
        (await dbPrisma.message.findUnique({
          where: { id: messageId },
          select: { repostCount: true },
        }))?.repostCount ?? 1;
    }

    // Broadcast to all listeners on this conversation's channel
    await pusherServer.trigger(
      `ConversationChannel_${message.conversationId}`,
      'vibe-repost-update',
      { messageId, repostCount },
    );

    console.log(
      LOG_PREFIX,
      repulsed ? 'repulse added' : 'repulse removed',
      `messageId=${messageId} count=${repostCount}`,
    );

    return NextResponse.json({ repulsed, repostCount }, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'error toggling vibe repost:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
