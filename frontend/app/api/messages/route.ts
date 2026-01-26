import { dbPrisma } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';
import { MyLibUserAuth } from '@/lib/user-auth';
import { canReplyToConversation } from '@/lib/conversation-permissions';
import { NextResponse } from 'next/server';
import { parseJsonOrError, parseQueryOrError } from '@/lib/api-validate';
import { z } from 'zod';

const LOG_PREFIX = '[frontend/app/api/messages/route.ts]'

export const dynamic = 'force-dynamic';

const isDev = process.env.NODE_ENV !== 'production';

const postBodySchema = z
  .object({
    conversationId: z.string().min(1),
    content: z.string().trim().max(5000).optional().nullable(),
    imageUrl: z.string().trim().max(2048).optional().nullable(),
  })
  .refine((val) => {
    const content = val.content?.trim() || '';
    const imageUrl = val.imageUrl?.trim() || '';
    return Boolean(content || imageUrl);
  }, { message: 'Either content or imageUrl must be provided' });

const getQuerySchema = z.object({
  conversationId: z.string().min(1),
});

export async function POST(req: Request) {
  console.log(LOG_PREFIX, 'POST(1/3) - creating message...');
  const session = await MyLibUserAuth();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.id;
  const userRole = session.role;

  const bodyResult = await parseJsonOrError(req, postBodySchema);
  if (!bodyResult.ok) return bodyResult.response;

  const { conversationId, content, imageUrl } = bodyResult.data;

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized ID' }, { status: 401 });
  }

  try {
    // Fetch conversation to check permissions
    const conversation = await dbPrisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
    }

    // Check if user can reply to this conversation
    console.log(LOG_PREFIX, 'POST(2/3) - checking reply permissions...');
    const user = { id: userId, role: userRole };
    const canReply = canReplyToConversation(user, conversation);
    if (!canReply) {
      console.log(LOG_PREFIX, 'POST - user not authorized to reply');
      return NextResponse.json({ message: 'You do not have permission to reply to this conversation' }, { status: 403 });
    }

    const message = await dbPrisma.message.create({
      data: {
        content,
        imageUrl,
        senderId: userId,
        conversationId,
      },
    });

    // Update conversation engagement metrics (for "reach over followers" sorting)
    // Check if this user has replied before to track unique repliers
    const previousReplies = await dbPrisma.message.count({
      where: {
        conversationId,
        senderId: userId,
        id: { not: message.id }, // Exclude the message we just created
      },
    });

    const isNewReplier = previousReplies === 0 && userId !== conversation.userId;

    await dbPrisma.conversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
        lastActivityAt: new Date(),
        replyCount: { increment: 1 },
        ...(isNewReplier ? { uniqueRepliers: { increment: 1 } } : {}),
      },
    });

    // Trigger a Pusher event after message creation
    await pusherServer.trigger(`ConversationChannel_${conversationId}`, 'new-message', {
      conversationId,
      message: {
        id: message.id,
        content: message.content,
        imageUrl: message.imageUrl,
        senderId: message.senderId,
        createdAt: message.createdAt,
      },
    });
    console.log(LOG_PREFIX, 'POST(3/3) - message successfully created, triggering pusher event...', `ConversationChannel_${conversationId} - new-message`);
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error(LOG_PREFIX, 'POST - error creating message:', error);
    return NextResponse.json(
      { message: 'Error sending message', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  console.log(LOG_PREFIX, `GET(1/3) - fetching messages...`);
  const queryResult = parseQueryOrError(req, getQuerySchema);
  if (!queryResult.ok) return queryResult.response;
  const { conversationId } = queryResult.data;

  // Get session - may be null for public conversations
  const session = await MyLibUserAuth();
  const userId = session?.id;
  const userRole = session?.role;

  try {
    // Fetch the conversation
    const conversation = await dbPrisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        repostOfConversation: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            user: { select: { id: true, name: true, image: true } },
            messages: { take: 1, orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
    }

    // Check view permissions
    console.log(LOG_PREFIX, `GET(2/3) - checking view permissions...`);
    const { canViewConversation } = await import('@/lib/conversation-permissions');
    const user = userId && userRole ? { id: userId, role: userRole } : null;
    const canView = canViewConversation(user, conversation);
    if (!canView) {
      console.log(LOG_PREFIX, 'GET - user not authorized to view');
      return NextResponse.json({ message: 'You do not have permission to view this conversation' }, { status: 403 });
    }

    // Fetch the messages
    const messages = await dbPrisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    // Fetch users who are participants in the conversation
    const participantIds = conversation.participants as string[];
    // Also include the creator
    const allUserIds = [...new Set([...participantIds, conversation.userId])];
    const users = await dbPrisma.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, name: true, image: true },
    });

    console.log(LOG_PREFIX, `GET(3/3) - fetched messages successfully`);
    return NextResponse.json({ messages, users, conversation }, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, `GET - error fetching messages:`, error);
    return NextResponse.json(
      { message: 'Error fetching messages', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}