import { fetchUserManyDetails } from '@/data/user';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError, parseQueryOrError } from '@/lib/api-validate';
import { NextResponse } from 'next/server';
import {
  ConversationType,
  ConversationVisibility,
  ReplyPermission,
  Prisma
} from '@prisma/client';
import { z } from 'zod';

const LOG_PREFIX = '[api/conversations]';

const isDev = process.env.NODE_ENV !== 'production';

const createConversationSchema = z.object({
  title: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  participants: z.array(z.string().trim().min(1).max(200)).max(50).optional().default([]),
  type: z.nativeEnum(ConversationType).optional().default(ConversationType.PRIVATE_DM),
  visibility: z.nativeEnum(ConversationVisibility).optional().default(ConversationVisibility.PARTICIPANTS),
  replyPermission: z.nativeEnum(ReplyPermission).optional().default(ReplyPermission.PARTICIPANTS),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional().default([]),
  allowedRoles: z.array(z.string().trim().min(1).max(50)).max(20).optional().default([]),
  customViewers: z.array(z.string().trim().min(1).max(200)).max(200).optional().default([]),
  initialMessage: z.string().trim().max(5000).optional().nullable(),
  initialImageUrl: z.string().trim().max(2048).optional().nullable(),
  pollQuestion: z.string().trim().max(500).optional().nullable(),
});

const listConversationsQuerySchema = z.object({
  filter: z.enum(['mine', 'public', 'all']).optional().default('mine'),
  sort: z.enum(['recent', 'reach', 'active', 'replies']).optional().default('recent'),
  limit: z
    .preprocess((v) => (typeof v === 'string' ? Number.parseInt(v, 10) : v), z.number().int().min(1).max(100))
    .optional()
    .default(50),
  cursor: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const session = await MyLibUserAuth();

  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.id;

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized ID' }, { status: 401 });
  }

  try {
    const bodyResult = await parseJsonOrError(req, createConversationSchema);
    if (!bodyResult.ok) return bodyResult.response;

    const {
      title,
      description,
      participants,
      type,
      visibility,
      replyPermission,
      tags,
      allowedRoles,
      customViewers,
      initialMessage,
      initialImageUrl,
      pollQuestion,
    } = bodyResult.data;

    // Process participants - can be user IDs or emails
    let participantIds: string[] = [];

    if (participants.length > 0) {
      const participantData = await Promise.all(
        participants.map(async (participant: string) => {
          // Check if participant is an email or a user ID
          const user = await dbPrisma.user.findFirst({
            where: {
              OR: [
                { email: { equals: participant, mode: 'insensitive' } },
                { id: participant }
              ],
            },
            select: { id: true },
          });
          return user ? user.id : null;
        })
      );
      participantIds = participantData.filter((id): id is string => id !== null);
    }

    // For PUBLIC_THREAD, creator is not automatically a participant
    // For DM/GROUP/RESTRICTED, add creator to participants
    let allParticipants: string[];
    if (type === 'PUBLIC_THREAD') {
      allParticipants = participantIds;
    } else {
      allParticipants = Array.from(new Set([...participantIds, userId]));

      // For DM and GROUP, we need at least 2 participants
      if ((type === 'PRIVATE_DM' || type === 'GROUP') && allParticipants.length < 2) {
        return NextResponse.json({ message: 'At least one other participant is required' }, { status: 400 });
      }
    }

    // Generate title if not provided
    let finalTitle = title?.trim() || '';
    if (!finalTitle) {
      // Use first ~50 chars of initial message as title if provided
      const trimmedMessage = typeof initialMessage === 'string' ? initialMessage.trim() : '';
      const trimmedPollQuestion = typeof pollQuestion === 'string' ? pollQuestion.trim() : '';

      if (trimmedMessage) {
        finalTitle = trimmedMessage.slice(0, 50);
        if (trimmedMessage.length > 50) finalTitle += '...';
      } else if (trimmedPollQuestion) {
        // Use poll question as title if no message provided
        finalTitle = trimmedPollQuestion.slice(0, 50);
        if (trimmedPollQuestion.length > 50) finalTitle += '...';
      } else if (type === 'PUBLIC_THREAD') {
        finalTitle = 'New Thread';
      } else if (participantIds.length > 0) {
        // Fetch participant names for auto-title
        const participantUsers = await dbPrisma.user.findMany({
          where: { id: { in: participantIds } },
          select: { name: true },
        });
        const names = participantUsers.map(u => u.name).filter(Boolean);
        if (type === 'PRIVATE_DM') {
          finalTitle = `Chat with ${names.join(', ') || 'user'}`;
        } else {
          finalTitle = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '');
        }
      } else {
        finalTitle = `New ${type.replace('_', ' ').toLowerCase()}`;
      }
    }

    console.log(LOG_PREFIX, `Creating ${type} conversation: "${finalTitle}" with ${allParticipants.length} participants`);

    const conversation = await dbPrisma.conversation.create({
      data: {
        title: finalTitle,
        description: description?.trim() || null,
        userId,
        participants: allParticipants,
        type,
        visibility,
        replyPermission,
        tags,
        allowedRoles,
        customViewers,
      },
    });

    // Create initial message if provided (for any conversation type)
    const messageContent = typeof initialMessage === 'string' ? initialMessage.trim() : '';
    const messageImageUrl = typeof initialImageUrl === 'string' ? initialImageUrl : null;

    // Create message if there's content or an image
    if (messageContent || messageImageUrl) {
      await dbPrisma.message.create({
        data: {
          content: messageContent || '', // Content can be empty if there's an image
          imageUrl: messageImageUrl,
          senderId: userId,
          conversationId: conversation.id,
        },
      });

      // Update reply count for the initial message
      await dbPrisma.conversation.update({
        where: { id: conversation.id },
        data: {
          replyCount: 1,
          lastActivityAt: new Date(),
        },
      });

      console.log(LOG_PREFIX, `Created initial message for conversation ${conversation.id}${messageImageUrl ? ' (with image)' : ''}`);
    }

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error creating conversation:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { message: 'Error creating conversation', ...(isDev ? { error: message } : {}) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const session = await MyLibUserAuth();

  const queryResult = parseQueryOrError(req, listConversationsQuerySchema);
  if (!queryResult.ok) return queryResult.response;

  const { filter, sort, limit, cursor } = queryResult.data;

  // For public feed, authentication is optional
  const userId = session?.id;
  const userRole = session?.role;

  try {
    let whereClause: Record<string, unknown>;

    if (filter === 'public') {
      // Public conversations - anyone can see
      whereClause = { visibility: 'PUBLIC' };
    } else if (filter === 'mine' && userId) {
      // User's conversations (created by or participant in)
      whereClause = {
        OR: [
          { userId },
          { participants: { has: userId } },
        ],
      };
    } else if (filter === 'all' && userId) {
      // All conversations the user can access (using permission helper logic inline)
      if (userRole === 'OWNER' || userRole === 'ADMIN') {
        // Admins see everything
        whereClause = {};
      } else {
        whereClause = {
          OR: [
            { visibility: 'PUBLIC' },
            { userId },
            { participants: { has: userId } },
            {
              AND: [
                { visibility: 'ROLE_BASED' },
                { allowedRoles: { has: userRole } },
              ],
            },
            {
              AND: [
                { visibility: 'CUSTOM' },
                { customViewers: { has: userId } },
              ],
            },
          ],
        };
      }
    } else if (!userId) {
      // Not authenticated - only show public
      whereClause = { visibility: 'PUBLIC' };
    } else {
      whereClause = {};
    }

    // Build orderBy based on sort parameter
    // "Reach over followers" philosophy: prioritize actual engagement over vanity metrics
    let orderBy: Prisma.ConversationOrderByWithRelationInput[];

    switch (sort) {
      case 'reach':
        // Richard's insight: "reach count" over "follower count"
        // Sort by actual views and unique engagement, not just reply count
        orderBy = [
          { isPinned: 'desc' },
          { viewCount: 'desc' },
          { uniqueRepliers: 'desc' },
          { reposts: { _count: 'desc' } },
          { quoteReposts: { _count: 'desc' } },
          { lastActivityAt: 'desc' },
        ];
        break;
      case 'active':
        // Most recently active (last message/interaction)
        orderBy = [
          { isPinned: 'desc' },
          { lastActivityAt: 'desc' },
        ];
        break;
      case 'replies':
        // Most discussed (reply count)
        orderBy = [
          { isPinned: 'desc' },
          { replyCount: 'desc' },
          { lastActivityAt: 'desc' },
        ];
        break;
      case 'recent':
      default:
        // Most recently created
        orderBy = [
          { isPinned: 'desc' },
          { createdAt: 'desc' },
        ];
        break;
    }

    const conversations = await dbPrisma.conversation.findMany({
      where: whereClause,
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        repostOfConversation: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            user: {
              select: { id: true, name: true, image: true },
            },
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        user: {
          select: { id: true, name: true, image: true },
        },
        poll: {
          // Feed needs the question to show a longer preview than the truncated title.
          select: { id: true, question: true },
        },
        _count: {
          select: { messages: true, reposts: true, quoteReposts: true },
        },
      },
      orderBy,
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    // If logged in, also compute whether the current user has reposted each conversation
    const repostedSet = new Set<string>();
    if (userId && conversations.length > 0) {
      const reposts = await dbPrisma.conversationRepost.findMany({
        where: {
          userId,
          conversationId: { in: conversations.map((c) => c.id) },
        },
        select: { conversationId: true },
      });
      for (const r of reposts) repostedSet.add(r.conversationId);
    }

    // Extract all participant IDs from all conversations
    const allParticipantIds = Array.from(
      new Set(conversations.flatMap((conversation) => conversation.participants as string[]))
    );

    // Fetch details for all participants
    const users = await fetchUserManyDetails(allParticipantIds);

    // Add participant details to each conversation
    const conversationsWithUserDetails = conversations.map((conversation) => {
      const participantDetails = (conversation.participants as string[]).map((id) =>
        users.find((user) => user.id === id)
      ).filter(Boolean);

      return {
        ...conversation,
        participantDetails, // Keep original participants array, add details separately
        lastMessage: conversation.messages[0] || null,
        repostOfLastMessage: conversation.repostOfConversation?.messages?.[0] || null,
        messageCount: conversation._count.messages,
        repostCount: conversation._count.reposts,
        quoteRepostCount: conversation._count.quoteReposts,
        hasReposted: userId ? repostedSet.has(conversation.id) : false,
        hasPoll: !!conversation.poll, // Boolean indicator for poll existence
      };
    });

    // Return with next cursor for pagination
    const nextCursor = conversations.length === limit
      ? conversations[conversations.length - 1]?.id
      : null;

    return NextResponse.json({
      conversations: conversationsWithUserDetails,
      nextCursor,
    }, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error fetching conversations:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { message: 'Error fetching conversations', ...(isDev ? { error: error.message } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Unknown error occurred' }, { status: 500 });
  }
}