import { dbPrisma } from '@/lib/db';
import { writeMessage } from '@/lib/message-writes';
import { MyLibUserAuth } from '@/lib/user-auth';
import { canViewConversation } from '@/lib/conversation-permissions';
import { NextResponse } from 'next/server';
import { parseQueryOrError } from '@/lib/api-validate';
import { z } from 'zod';
import { MessagesGetResponseSchema } from '@/lib/types/messages';

const LOG_PREFIX = '[frontend/app/api/messages/route.ts]'

export const dynamic = 'force-dynamic';
const privateJson = (...args: Parameters<typeof NextResponse.json>) => {
  const response = NextResponse.json(...args);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Vary', 'Cookie');
  return response;
};

const isDev = process.env.NODE_ENV !== 'production';

const getQuerySchema = z.object({
  conversationId: z.string().min(1),
});

export async function POST(req: Request) { return writeMessage(req, 'create'); }

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
            userId: true, participants: true, type: true, visibility: true,
            replyPermission: true, allowedRoles: true, customViewers: true,
            visibleToUserIds: true, isLocked: true, deletionVisibility: true, deletionRequestedAt: true,
            User: { select: { id: true, name: true, image: true } },
            Message: { take: 1, orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });

    if (!conversation) {
      return privateJson({ message: 'Conversation not found' }, { status: 404 });
    }

    // Check view permissions
    console.log(LOG_PREFIX, `GET(2/3) - checking view permissions...`);
    const user = userId && userRole ? { id: userId, role: userRole } : null;
    const canView = canViewConversation(user, conversation);
    if (!canView) {
      console.log(LOG_PREFIX, 'GET - user not authorized to view');
      return privateJson({ message: 'You do not have permission to view this conversation' }, { status: 403 });
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
        messageCount: messages.length,
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

        Conversation: conversation.Conversation && canViewConversation(user, conversation.Conversation)
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
      return privateJson(
        {
          message: 'Error fetching messages',
          ...(isDev ? { error: 'Invalid DTO', issues: parsed.error.issues } : {}),
        },
        { status: 500 }
      );
    }

    console.log(LOG_PREFIX, `GET(3/3) - fetched messages successfully`);
    return privateJson(parsed.data, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, `GET - error fetching messages:`, error);
    return privateJson(
      { message: 'Error fetching messages', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}
