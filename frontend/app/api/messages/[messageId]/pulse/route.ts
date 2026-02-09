import { dbPrisma } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';
import { MyLibUserAuth } from '@/lib/user-auth';
import { NextResponse } from 'next/server';

const LOG_PREFIX = '[api/messages/[messageId]/pulse]';

/**
 * POST /api/messages/:messageId/pulse
 *
 * Toggles a heartbeat on a vibe (message). If the user already heartbeated,
 * the heartbeat is removed. Returns the new heartbeat count for that vibe
 * and broadcasts a real-time update via Pusher.
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
      select: { id: true, conversationId: true },
    });

    if (!message) {
      return NextResponse.json({ message: 'Message not found' }, { status: 404 });
    }

    // Check if user already heartbeated this vibe
    const existing = await dbPrisma.messagePulse.findUnique({
      where: { messageId_userId: { messageId, userId } },
    });

    let heartbeated: boolean;
    let heartbeatCount: number;

    if (existing) {
      // Remove heartbeat
      await dbPrisma.$transaction([
        dbPrisma.messagePulse.delete({
          where: { id: existing.id },
        }),
        dbPrisma.message.update({
          where: { id: messageId },
          data: { heartbeatCount: { decrement: 1 } },
        }),
      ]);
      heartbeated = false;
      heartbeatCount = Math.max(
        0,
        (await dbPrisma.message.findUnique({
          where: { id: messageId },
          select: { heartbeatCount: true },
        }))?.heartbeatCount ?? 0,
      );
    } else {
      // Add heartbeat
      await dbPrisma.$transaction([
        dbPrisma.messagePulse.create({
          data: { messageId, userId },
        }),
        dbPrisma.message.update({
          where: { id: messageId },
          data: { heartbeatCount: { increment: 1 } },
        }),
      ]);
      heartbeated = true;
      heartbeatCount =
        (await dbPrisma.message.findUnique({
          where: { id: messageId },
          select: { heartbeatCount: true },
        }))?.heartbeatCount ?? 1;
    }

    // Broadcast to all listeners on this conversation's channel
    await pusherServer.trigger(
      `ConversationChannel_${message.conversationId}`,
      'vibe-heartbeat-update',
      { messageId, heartbeatCount },
    );

    console.log(
      LOG_PREFIX,
      heartbeated ? 'heartbeat added' : 'heartbeat removed',
      `messageId=${messageId} count=${heartbeatCount}`,
    );

    return NextResponse.json({ heartbeated, heartbeatCount }, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'error toggling vibe heartbeat:', error);
    return NextResponse.json(
      { message: 'Failed to toggle heartbeat' },
      { status: 500 },
    );
  }
}
