import { fetchUserManyDetails } from '@/data/user';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseJsonOrError, parseQueryOrError } from '@/lib/api-validate';
import { pusherServer } from '@/lib/pusher';
import { NextResponse } from 'next/server';
import {
  ConversationType,
  ConversationVisibility,
  ReplyPermission,
  Prisma
} from '@/generated/prisma/browser';
import { z } from 'zod';
import {
  ConversationsListResponseSchema,
  ConversationListItemSchema,
  type ConversationsListResponse,
} from '@/lib/types/conversations';
import { ConversationAdminResponseSchema } from '@/lib/types/conversations';

const LOG_PREFIX = '[api/conversations]';

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date(String(value)).toISOString();
}

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
  filter: z.enum(['mine', 'public', 'all', 'created', 'participated', 'private']).optional().default('mine'),
  sort: z.enum(['recent', 'reach', 'active', 'replies', 'popular', 'discussed']).optional().default('recent'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().min(1).optional(),
  // Filter by specific user - for profile pages
  creatorId: z.string().min(1).optional(),
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

    if (participants && participants.length > 0) {
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
        finalTitle = `New ${(type ?? 'conversation').replace('_', ' ').toLowerCase()}`;
      }
    }

    const conversationType = type ?? 'PRIVATE_DM';
    
    // ─── Duplicate DM detection ─────────────────────────────────────────────
    // Prevent creating multiple DMs with the same person
    if (conversationType === 'PRIVATE_DM' && allParticipants.length === 2) {
      const otherUserId = allParticipants.find(id => id !== userId)!;
      const existingDm = await dbPrisma.conversation.findFirst({
        where: {
          type: 'PRIVATE_DM',
          AND: [
            { participants: { has: userId } },
            { participants: { has: otherUserId } },
          ],
        },
        select: { id: true },
      });
      if (existingDm) {
        return NextResponse.json(
          { id: existingDm.id, message: 'Existing conversation found', existing: true },
          { status: 200 }
        );
      }
    }
    // ────────────────────────────────────────────────────────────────────────
    
    console.log(LOG_PREFIX, `Creating ${conversationType} conversation: "${finalTitle}" with ${allParticipants.length} participants`);

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

    const created = await dbPrisma.conversation.findUnique({
      where: { id: conversation.id },
      include: {
        User: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    if (!created) {
      return NextResponse.json({ message: 'Error creating conversation' }, { status: 500 });
    }

    const dto = {
      id: created.id,
      companyId: (created as any).companyId ?? null,

      title: created.title,
      description: created.description ?? null,

      userId: created.userId,
      participants: (created.participants as string[]) ?? [],

      createdAt: toIsoString(created.createdAt),
      updatedAt: toIsoString(created.updatedAt),
      editedAt: created.editedAt ? toIsoString(created.editedAt) : null,

      allowedRoles: (created.allowedRoles as string[]) ?? [],
      customViewers: (created.customViewers as string[]) ?? [],

      isLocked: created.isLocked,
      isPinned: created.isPinned,
      replyPermission: created.replyPermission,
      tags: (created.tags as string[]) ?? [],
      type: created.type,
      visibility: created.visibility,

      lastActivityAt: created.lastActivityAt ? toIsoString(created.lastActivityAt) : undefined,

      replyCount: created.replyCount ?? undefined,
      uniqueRepliers: (created as any).uniqueRepliers ?? undefined,
      viewCount: created.viewCount ?? undefined,
      uniqueViewCount: (created as any).uniqueViewCount ?? undefined,

      deletionRequestedAt: created.deletionRequestedAt ? toIsoString(created.deletionRequestedAt) : null,
      deletionScheduledFor: created.deletionScheduledFor ? toIsoString(created.deletionScheduledFor) : null,
      deletionVisibility: (created as any).deletionVisibility ?? null,

      isAnonymized: (created as any).isAnonymized ?? false,
      originalUserId: (created as any).originalUserId ?? null,

      suspiciousActivity: (created as any).suspiciousActivity ?? undefined,
      suspiciousReason: (created as any).suspiciousReason ?? null,

      repostOfConversationId: (created as any).repostOfConversationId ?? null,

      uniqueIpCount: (created as any).uniqueIpCount ?? undefined,
      loggedInViewCount: (created as any).loggedInViewCount ?? undefined,
      anonymousViewCount: (created as any).anonymousViewCount ?? undefined,
      reachScore: (created as any).reachScore ?? undefined,

      positivePulseCount: created.positivePulseCount ?? undefined,
      negativePulseCount: created.negativePulseCount ?? undefined,
      repulseCount: (created as any).repulseCount ?? undefined,

      User: {
        id: created.User.id,
        name: created.User.name,
        email: created.User.email ?? null,
        image: created.User.image ?? null,
      },
      user: {
        id: created.User.id,
        name: created.User.name,
        email: created.User.email ?? null,
        image: created.User.image ?? null,
      },
    };

    // Broadcast new pulse to public feed for real-time updates
    if (type === 'PUBLIC_THREAD') {
      try {
        await pusherServer.trigger('public-pulse-feed', 'new-pulse', {
          conversationId: created.id,
          userId: created.userId,
          title: created.title,
          createdAt: toIsoString(created.createdAt),
        });
        console.log(LOG_PREFIX, `Broadcasted new pulse to public feed: ${created.id}`);
      } catch (pusherError) {
        // Don't fail the request if Pusher fails - just log it
        console.error(LOG_PREFIX, 'Failed to broadcast new pulse:', pusherError);
      }
    }

    const validated = ConversationAdminResponseSchema.safeParse(dto);
    if (!validated.success) {
      console.error(LOG_PREFIX, 'Invalid create conversation DTO:', validated.error);
      return NextResponse.json(
        { message: 'Internal Server Error', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data, { status: 201 });
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

  const { filter, sort, limit, cursor, creatorId } = queryResult.data;

  // For public feed, authentication is optional
  const userId = session?.id;
  const userRole = session?.role;

  try {
    let whereClause: Record<string, unknown>;

    // If creatorId is specified, filter by that user's created posts
    if (creatorId) {
      if (filter === 'created') {
        // Only posts created by this user (for profile "Posts" tab)
        whereClause = {
          userId: creatorId,
          visibility: 'PUBLIC', // Only show public posts on profile
        };
      } else if (filter === 'participated') {
        // Posts this user has interacted with (commented, pulsed/liked) - for "Activity" tab
        // Get conversations where user has sent messages OR given a pulse (excluding their own posts)
        whereClause = {
          visibility: 'PUBLIC',
          OR: [
            // User sent messages/comments on the post
            {
              Message: {
                some: {
                  senderId: creatorId,
                },
              },
            },
            // User gave a pulse (like/dislike) to the post
            {
              Pulse: {
                some: {
                  userId: creatorId,
                },
              },
            },
          ],
          NOT: {
            userId: creatorId, // Exclude their own posts
          },
        };
      } else {
        // Default: show user's public posts
        whereClause = {
          userId: creatorId,
          visibility: 'PUBLIC',
        };
      }
    } else if (filter === 'public') {
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
    } else if (filter === 'private' && userId) {
      // User's private conversations only (DMs, Groups, Restricted - excludes PUBLIC_THREAD)
      // This is for the /conversations page - private messages only
      whereClause = {
        AND: [
          {
            OR: [
              { userId },
              { participants: { has: userId } },
            ],
          },
          {
            type: { not: 'PUBLIC_THREAD' },
          },
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
        // 7-Pillar Reach: sort by momentum (decaying score reflecting current vitality)
        // Falls back to viewCount for older pulses without momentum data
        orderBy = [
          { pinnedToFeed: 'desc' },
          { isPinned: 'desc' },
          { reachMomentum: 'desc' },
          { viewCount: 'desc' },
          { uniqueRepliers: 'desc' },
          { lastActivityAt: 'desc' },
        ];
        break;
      case 'popular':
        // Most positive pulses (likes)
        orderBy = [
          { pinnedToFeed: 'desc' },
          { isPinned: 'desc' },
          { positivePulseCount: 'desc' },
          { viewCount: 'desc' },
          { lastActivityAt: 'desc' },
        ];
        break;
      case 'discussed':
        // Most messages/comments
        orderBy = [
          { pinnedToFeed: 'desc' },
          { isPinned: 'desc' },
          { Message: { _count: 'desc' } },
          { lastActivityAt: 'desc' },
        ];
        break;
      case 'active':
        // Most recently active (last message/interaction)
        orderBy = [
          { pinnedToFeed: 'desc' },
          { isPinned: 'desc' },
          { lastActivityAt: 'desc' },
        ];
        break;
      case 'replies':
        // Most discussed (reply count)
        orderBy = [
          { pinnedToFeed: 'desc' },
          { isPinned: 'desc' },
          { replyCount: 'desc' },
          { lastActivityAt: 'desc' },
        ];
        break;
      case 'recent':
      default:
        // Most recently created
        orderBy = [
          { pinnedToFeed: 'desc' },
          { isPinned: 'desc' },
          { createdAt: 'desc' },
        ];
        break;
    }

    const conversations = await dbPrisma.conversation.findMany({
      where: whereClause,
      include: {
        Message: {
          take: 1,
          orderBy: { createdAt: 'asc' },  // Get FIRST message (original pulse), not last (comment)
        },
        Conversation: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            User: {
              select: { id: true, name: true, email: true, image: true },
            },
            Message: {
              take: 1,
              orderBy: { createdAt: 'asc' },  // Get FIRST message (original pulse), not last (comment)
            },
          },
        },
        User: {
          select: { id: true, name: true, email: true, image: true },
        },
        Poll: {
          // Feed needs the question to show a longer preview than the truncated title.
          select: { id: true, question: true },
        },
        AdvancedPoll: {
          // Include advanced polls (surveys, REACH feedback, etc.)
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            totalResponses: true,
            avgCompletionPct: true,
          },
        },
        ProfilePins: {
          // Check if pinned to any profiles - we'll filter by user later
          select: {
            userId: true,
            pinnedAt: true,
          },
        },
        ContentFlags: {
          where: { isActive: true },
          select: {
            id: true,
            type: true,
            reason: true,
          },
        },
        _count: {
          select: { Message: true, ConversationRepost: true },
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

    // Get user's pulses on these conversations
    const userPulseMap = new Map<string, 'POSITIVE' | 'NEGATIVE'>();
    if (userId && conversations.length > 0) {
      const pulses = await dbPrisma.pulse.findMany({
        where: {
          userId,
          conversationId: { in: conversations.map((c) => c.id) },
        },
        select: { conversationId: true, type: true },
      });
      for (const p of pulses) userPulseMap.set(p.conversationId, p.type);
    }

    // Extract all participant IDs from all conversations
    const allParticipantIds = Array.from(
      new Set(conversations.flatMap((conversation) => conversation.participants as string[]))
    );

    // Fetch details for all participants
    const users = await fetchUserManyDetails(allParticipantIds);

    // Add participant details to each conversation
    const conversationsWithUserDetails = conversations.map((conversation): z.infer<typeof ConversationListItemSchema> => {
      const participantDetails = (conversation.participants as string[])
        .map((id) => users.find((u) => u.id === id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));

      const lastMessage = conversation.Message?.[0]
        ? {
          id: conversation.Message[0].id,
          content: conversation.Message[0].content,
          createdAt: toIsoString(conversation.Message[0].createdAt),
          imageUrl: conversation.Message[0].imageUrl ?? null,
          senderId: conversation.Message[0].senderId ?? null,
        }
        : null;

      const repostOfLastMessage = conversation.Conversation?.Message?.[0]
        ? {
          content: conversation.Conversation.Message[0].content,
          createdAt: toIsoString(conversation.Conversation.Message[0].createdAt),
        }
        : null;

      const repostOfConversation = conversation.Conversation
        ? {
          id: conversation.Conversation.id,
          title: conversation.Conversation.title,
          createdAt: toIsoString(conversation.Conversation.createdAt),
          User: {
            id: conversation.Conversation.User.id,
            name: conversation.Conversation.User.name,
            email: conversation.Conversation.User.email ?? null,
            image: conversation.Conversation.User.image ?? null,
          },
          user: {
            id: conversation.Conversation.User.id,
            name: conversation.Conversation.User.name,
            email: conversation.Conversation.User.email ?? null,
            image: conversation.Conversation.User.image ?? null,
          },
          lastMessage: conversation.Conversation.Message?.[0]
            ? {
              id: conversation.Conversation.Message[0].id,
              content: conversation.Conversation.Message[0].content,
              createdAt: toIsoString(conversation.Conversation.Message[0].createdAt),
              imageUrl: conversation.Conversation.Message[0].imageUrl ?? null,
              senderId: conversation.Conversation.Message[0].senderId ?? null,
            }
            : null,
        }
        : null;

      const dto = {
        id: conversation.id,
        companyId: (conversation as any).companyId ?? null,

        title: conversation.title ?? '',
        description: conversation.description ?? null,

        userId: conversation.userId,
        participants: (conversation.participants as string[]) ?? [],
        participantDetails: participantDetails.map((p) => ({
          id: p.id,
          name: p.name ?? null,
          email: p.email ?? null,
          image: p.image ?? null,
          referredBy: (p as any).referredBy ?? null,
        })),

        createdAt: toIsoString(conversation.createdAt),
        updatedAt: toIsoString(conversation.updatedAt),
        editedAt: conversation.editedAt ? toIsoString(conversation.editedAt) : null,
        lastActivityAt: conversation.lastActivityAt ? toIsoString(conversation.lastActivityAt) : null,

        allowedRoles: (conversation.allowedRoles as string[]) ?? [],
        customViewers: (conversation.customViewers as string[]) ?? [],

        isLocked: conversation.isLocked,
        isPinned: conversation.isPinned,
        pinnedToFeed: (conversation as any).pinnedToFeed || false,
        pinnedToProfile: userId ? conversation.ProfilePins?.some((p: { userId: string }) => p.userId === userId) || false : false,
        replyPermission: conversation.replyPermission,
        tags: (conversation.tags as string[]) ?? [],
        type: conversation.type,
        visibility: conversation.visibility,

        replyCount: conversation.replyCount ?? undefined,
        uniqueRepliers: (conversation as any).uniqueRepliers ?? undefined,
        viewCount: conversation.viewCount ?? undefined,
        uniqueViewCount: (conversation as any).uniqueViewCount ?? undefined,

        deletionRequestedAt: conversation.deletionRequestedAt ? toIsoString(conversation.deletionRequestedAt) : null,
        deletionScheduledFor: conversation.deletionScheduledFor ? toIsoString(conversation.deletionScheduledFor) : null,
        deletionVisibility: (conversation as any).deletionVisibility ?? null,

        isAnonymized: (conversation as any).isAnonymized ?? undefined,
        originalUserId: (conversation as any).originalUserId ?? null,

        repostOfConversationId: (conversation as any).repostOfConversationId ?? null,
        repostOfConversation,
        Conversation: repostOfConversation,

        lastMessage,
        repostOfLastMessage,

        messageCount: conversation._count.Message,
        repostCount: conversation._count.ConversationRepost,
        quoteRepostCount: (conversation as any).quoteRepostCount ?? undefined,
        hasReposted: userId ? repostedSet.has(conversation.id) : false,

        hasPoll: !!(conversation.Poll || conversation.AdvancedPoll),
        poll: conversation.Poll ? { id: conversation.Poll.id, question: conversation.Poll.question ?? null } : null,
        Poll: conversation.Poll ? { id: conversation.Poll.id, question: conversation.Poll.question ?? null } : null,
        advancedPoll: conversation.AdvancedPoll ? {
          id: conversation.AdvancedPoll.id,
          title: conversation.AdvancedPoll.title,
          description: conversation.AdvancedPoll.description,
          type: conversation.AdvancedPoll.type,
          totalResponses: conversation.AdvancedPoll.totalResponses,
          avgCompletionPct: conversation.AdvancedPoll.avgCompletionPct,
        } : null,
        AdvancedPoll: conversation.AdvancedPoll ? {
          id: conversation.AdvancedPoll.id,
          title: conversation.AdvancedPoll.title,
          description: conversation.AdvancedPoll.description,
          type: conversation.AdvancedPoll.type,
          totalResponses: conversation.AdvancedPoll.totalResponses,
          avgCompletionPct: conversation.AdvancedPoll.avgCompletionPct,
        } : null,

        positivePulseCount: conversation.positivePulseCount || 0,
        negativePulseCount: conversation.negativePulseCount || 0,
        userPulse: userId ? userPulseMap.get(conversation.id) || null : null,

        // Content flags (admin moderation warnings)
        contentFlags: (conversation as any).ContentFlags?.map((f: any) => ({
          id: f.id,
          type: f.type,
          reason: f.reason,
        })) || [],

        // Visibility targeting
        visibleToUserIds: (conversation as any).visibleToUserIds || [],
        visibleToGroupIds: (conversation as any).visibleToGroupIds || [],

        User: {
          id: conversation.User.id,
          name: conversation.User.name,
          email: conversation.User.email ?? null,
          image: conversation.User.image ?? null,
        },
        user: {
          id: conversation.User.id,
          name: conversation.User.name,
          email: conversation.User.email ?? null,
          image: conversation.User.image ?? null,
        },

        Message: lastMessage ? [lastMessage] : [],
        messages: lastMessage ? [lastMessage] : [],
      };

      return dto;
    });

    // Return with next cursor for pagination
    const nextCursor = conversations.length === limit
      ? conversations[conversations.length - 1]?.id
      : null;

    const responsePayload: ConversationsListResponse = {
      conversations: conversationsWithUserDetails,
      nextCursor,
    };

    const validated = ConversationsListResponseSchema.safeParse(responsePayload);
    if (!validated.success) {
      console.error(LOG_PREFIX, 'Invalid conversations list DTO:', validated.error);
      return NextResponse.json(
        { message: 'Internal Server Error', ...(isDev ? { issues: validated.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(validated.data, { status: 200 });
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