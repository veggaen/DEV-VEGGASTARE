import { dbPrisma } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';
import { MyLibUserAuth } from '@/lib/user-auth';
import { canReplyToConversation, canViewConversation } from '@/lib/conversation-permissions';
import { NextResponse } from 'next/server';
import { parseJsonOrError, parseQueryOrError } from '@/lib/api-validate';
import { z } from 'zod';
import { MessageResponseSchema, MessagesGetResponseSchema } from '@/lib/types/messages';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';

const LOG_PREFIX = '[frontend/app/api/messages/route.ts]'

export const dynamic = 'force-dynamic';

const isDev = process.env.NODE_ENV !== 'production';

const postBodySchema = z
  .object({
    conversationId: z.string().min(1),
    content: z.string().trim().max(5000).optional().nullable(),
    imageUrl: z.string().trim().max(2048).optional().nullable(),
    parentId: z.string().min(1).optional().nullable(),
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

  // Rate limit — prevent message spam
  const rl = await checkRateLimit(getClientIdentifier(req, session.id), 'message');
  if (!rl.success) return rateLimitedResponse(rl);

  const userId = session.id;
  const userRole = session.role;

  const bodyResult = await parseJsonOrError(req, postBodySchema);
  if (!bodyResult.ok) return bodyResult.response;

  const { conversationId, content, imageUrl, parentId } = bodyResult.data;

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
        content: content ?? '',
        imageUrl: imageUrl ?? undefined,
        senderId: userId,
        conversationId,
        ...(parentId ? { parentId } : {}),
      },
      include: {
        User: {
          select: { id: true, name: true, image: true },
        },
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

    // If this is a reply to another message, increment the parent's replyCount
    if (parentId) {
      await dbPrisma.message.update({
        where: { id: parentId },
        data: { replyCount: { increment: 1 } },
      }).catch(() => { /* parent may have been deleted */ });
    }

    // Trigger a Pusher event after message creation (include sender info so
    // real-time listeners can render the author name immediately)
    await pusherServer.trigger(`ConversationChannel_${conversationId}`, 'new-message', {
      conversationId,
      message: {
        id: message.id,
        content: message.content,
        imageUrl: message.imageUrl,
        senderId: message.senderId,
        createdAt: message.createdAt,
        heartbeatCount: 0,
        hasHeartbeated: false,
        parentId: message.parentId ?? null,
        replyCount: 0,
        repostCount: 0,
        hasRepulsed: false,
        sender: message.User
          ? { id: message.User.id, name: message.User.name, image: message.User.image ?? null }
          : null,
      },
    });
    console.log(LOG_PREFIX, 'POST(3/3) - message successfully created, triggering pusher event...', `ConversationChannel_${conversationId} - new-message`);

    const dto = {
      id: message.id,
      content: message.content,
      imageUrl: message.imageUrl ?? null,
      senderId: message.senderId,
      conversationId: message.conversationId,
      createdAt: message.createdAt,
      editedAt: message.editedAt ?? null,
      User: message.User
        ? {
            id: message.User.id,
            name: message.User.name,
            image: message.User.image ?? null,
          }
        : null,
      sender: message.User
        ? {
            id: message.User.id,
            name: message.User.name,
            image: message.User.image ?? null,
          }
        : null,
    };

    const parsed = MessageResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error(LOG_PREFIX, 'POST - invalid DTO:', parsed.error.issues);
      return NextResponse.json(
        {
          message: 'Error sending message',
          ...(isDev ? { error: 'Invalid DTO', issues: parsed.error.issues } : {}),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 201 });
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
    // Fetch the conversation with the creator's user data
    const conversation = await dbPrisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        User: {
          select: { id: true, name: true, image: true },
        },
        Conversation: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            User: { select: { id: true, name: true, image: true } },
            Message: { take: 1, orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
    }

    // Check view permissions
    console.log(LOG_PREFIX, `GET(2/3) - checking view permissions...`);
    const user = userId && userRole ? { id: userId, role: userRole } : null;
    const canView = canViewConversation(user, conversation);
    if (!canView) {
      console.log(LOG_PREFIX, 'GET - user not authorized to view');
      return NextResponse.json({ message: 'You do not have permission to view this conversation' }, { status: 403 });
    }

    // Fetch the messages with sender info + heartbeat count
    const messages = await dbPrisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: {
        User: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    // Participants (creator included).
    const participantIds = conversation.participants as string[];
    const allUserIds = [...new Set([...participantIds, conversation.userId])];
    const messageIds = messages.map((m) => m.id);

    // Run the independent follow-up queries in parallel rather than serially —
    // pulses, reposts and participant lookups don't depend on each other.
    const heartbeatedMessageIds = new Set<string>();
    const repulsedMessageIds = new Set<string>();
    const [userPulses, userReposts, users] = await Promise.all([
      userId
        ? dbPrisma.messagePulse.findMany({
            where: { messageId: { in: messageIds }, userId },
            select: { messageId: true },
          })
        : Promise.resolve([]),
      userId
        ? dbPrisma.messageRepost.findMany({
            where: { messageId: { in: messageIds }, userId },
            select: { messageId: true },
          })
        : Promise.resolve([]),
      dbPrisma.user.findMany({
        where: { id: { in: allUserIds } },
        select: { id: true, name: true, image: true },
      }),
    ]);
    for (const p of userPulses) heartbeatedMessageIds.add(p.messageId);
    for (const r of userReposts) repulsedMessageIds.add(r.messageId);

    // Normalize response shape + validate contract.
    const creator = conversation.User
      ? {
          id: conversation.User.id,
          name: conversation.User.name,
          image: conversation.User.image ?? null,
        }
      : null;

    const dto = {
      messages: messages.map((m) => ({
        id: m.id,
        content: m.content,
        imageUrl: m.imageUrl ?? null,
        senderId: m.senderId,
        conversationId: m.conversationId,
        createdAt: m.createdAt,
        editedAt: m.editedAt ?? null,
        heartbeatCount: m.heartbeatCount ?? 0,
        hasHeartbeated: heartbeatedMessageIds.has(m.id),
        parentId: m.parentId ?? null,
        replyCount: m.replyCount ?? 0,
        repostCount: m.repostCount ?? 0,
        hasRepulsed: repulsedMessageIds.has(m.id),
        User: m.User
          ? {
              id: m.User.id,
              name: m.User.name,
              image: m.User.image ?? null,
            }
          : null,
        sender: m.User
          ? {
              id: m.User.id,
              name: m.User.name,
              image: m.User.image ?? null,
            }
          : null,
      })),
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        image: u.image ?? null,
      })),
      conversation: {
        id: conversation.id,
        title: conversation.title,
        description: (conversation as any).description ?? null,
        tags: Array.isArray((conversation as any).tags) ? (conversation as any).tags : [],
        messageCount: typeof (conversation as any).messageCount === 'number' ? (conversation as any).messageCount : undefined,
        viewCount: typeof (conversation as any).viewCount === 'number' ? (conversation as any).viewCount : undefined,
        uniqueViewCount:
          typeof (conversation as any).uniqueViewCount === 'number' ? (conversation as any).uniqueViewCount : undefined,
        repostCount: typeof (conversation as any).repostCount === 'number' ? (conversation as any).repostCount : undefined,
        positivePulseCount:
          typeof (conversation as any).positivePulseCount === 'number' ? (conversation as any).positivePulseCount : undefined,
        hasPoll: typeof (conversation as any).hasPoll === 'boolean' ? (conversation as any).hasPoll : undefined,

        type: conversation.type,
        userId: conversation.userId,
        originalUserId: (conversation as any).originalUserId ?? null,

        deletionRequestedAt: (conversation as any).deletionRequestedAt ?? null,
        deletionScheduledFor: (conversation as any).deletionScheduledFor ?? null,
        deletionVisibility: (conversation as any).deletionVisibility ?? null,
        isAnonymized: !!(conversation as any).isAnonymized,

        createdAt: (conversation as any).createdAt,
        updatedAt: (conversation as any).updatedAt,

        participants: Array.isArray((conversation as any).participants) ? (conversation as any).participants : [],
        participantDetails: users.map((u) => ({ id: u.id, name: u.name, image: u.image ?? null })),

        User: creator,
        user: creator,

        Conversation: (conversation as any).Conversation
          ? {
              id: (conversation as any).Conversation.id,
              title: (conversation as any).Conversation.title ?? null,
              createdAt: (conversation as any).Conversation.createdAt,
              User: (conversation as any).Conversation.User
                ? {
                    id: (conversation as any).Conversation.User.id,
                    name: (conversation as any).Conversation.User.name,
                    image: (conversation as any).Conversation.User.image ?? null,
                  }
                : null,
              Message: Array.isArray((conversation as any).Conversation.Message)
                ? (conversation as any).Conversation.Message.map((mm: any) => ({
                    id: typeof mm?.id === 'string' ? mm.id : undefined,
                    content: typeof mm?.content === 'string' ? mm.content : undefined,
                    createdAt: mm?.createdAt,
                  }))
                : undefined,
            }
          : null,
      },
    };

    const parsed = MessagesGetResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error(LOG_PREFIX, 'GET - invalid DTO:', parsed.error.issues);
      return NextResponse.json(
        {
          message: 'Error fetching messages',
          ...(isDev ? { error: 'Invalid DTO', issues: parsed.error.issues } : {}),
        },
        { status: 500 }
      );
    }

    console.log(LOG_PREFIX, `GET(3/3) - fetched messages successfully`);
    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, `GET - error fetching messages:`, error);
    return NextResponse.json(
      { message: 'Error fetching messages', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}