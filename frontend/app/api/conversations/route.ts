import { fetchUserManyDetails } from '@/data/user';
import { dbPrisma } from '@/lib/db';
import { resolveVisibleEmail } from '@/lib/email-visibility';
import { MyLibUserAuth } from '@/lib/user-auth';
import { parseQueryOrError } from '@/lib/api-validate';
import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/browser';
import { z } from 'zod';
import {
  ConversationsListResponseSchema,
  ConversationListItemSchema,
  type ConversationsListResponse,
} from '@/lib/types/conversations';
import { createConversation } from '@/lib/conversation-create';
import { buildVisibilityWhereClause, canViewConversation, privateConversationTypes } from '@/lib/conversation-permissions';

const LOG_PREFIX = '[api/conversations]';

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date(String(value)).toISOString();
}

const listConversationsQuerySchema = z.object({
  filter: z.enum(['mine', 'public', 'all', 'created', 'participated', 'private']).optional().default('mine'),
  sort: z.enum(['recent', 'reach', 'active', 'replies', 'popular', 'discussed']).optional().default('recent'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().min(1).optional(),
  // Filter by specific user - for profile pages
  creatorId: z.string().min(1).optional(),
});

export const POST = createConversation;

export async function GET(req: Request) {
  const session = await MyLibUserAuth();

  const queryResult = parseQueryOrError(req, listConversationsQuerySchema);
  if (!queryResult.ok) return queryResult.response;

  const { filter, sort, limit, cursor, creatorId } = queryResult.data;

  // For public feed, authentication is optional
  const userId = session?.id;
  const userRole = session?.role;

  // A missing profile target must never fall through to an unrestricted query.
  if ((filter === 'created' || filter === 'participated') && !creatorId) {
    return NextResponse.json({ message: 'Choose a profile to view its public activity.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
  }
  if (filter === 'private' && !userId) {
    return NextResponse.json({ message: 'Sign in to view your messages.' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
  }
  if (creatorId && !['created', 'participated', 'public'].includes(filter ?? 'mine')) {
    return NextResponse.json({ message: 'Profile filters only support public activity.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
  }

  try {
    let whereClause: Prisma.ConversationWhereInput;
    const viewer = session?.id ? { id: session.id, role: session.role } : null;

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
            // Specific users visibility where they're in the allowed list
            {
              AND: [
                { visibility: 'SPECIFIC_USERS' },
                { visibleToUserIds: { has: userId } },
              ],
            },
          ],
        };
      }
    } else if (!userId) {
      // Not authenticated - only show public
      whereClause = { visibility: 'PUBLIC' };
    } else {
      // Fail closed if a new filter is ever added without an explicit policy.
      whereClause = { visibility: 'PUBLIC' };
    }

    // Apply the same read policy as direct message access before pagination.
    // Public feeds/profile activity never publish DMs, even to their own creator.
    const publicScope = !!creatorId || filter === 'public' || !userId;
    whereClause = { AND: [whereClause, buildVisibilityWhereClause(viewer),
      ...(publicScope ? [{ type: { notIn: [...privateConversationTypes] } }] : [])] };

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

    // Stable tie-breaking matters when loading the next page of an inbox.
    orderBy.push({ id: 'desc' });
    const page = await dbPrisma.conversation.findMany({
      where: whereClause,
      include: {
        Message: {
          take: 1,
          // Pulse keeps the original post; the private inbox needs the newest reply.
          orderBy: [{ createdAt: filter === 'private' ? 'desc' : 'asc' }, { id: filter === 'private' ? 'desc' : 'asc' }],
        },
        Conversation: {
          select: {
            id: true,
            userId: true, participants: true, type: true, visibility: true, replyPermission: true,
            allowedRoles: true, customViewers: true, visibleToUserIds: true, isLocked: true,
            deletionRequestedAt: true, deletionVisibility: true,
            title: true,
            createdAt: true,
            User: {
              select: { id: true, name: true, email: true, emailDisplayMode: true, image: true },
            },
            Message: {
              take: 1,
              orderBy: { createdAt: 'asc' },  // Get FIRST message (original pulse), not last (comment)
            },
          },
        },
        User: {
          select: { id: true, name: true, email: true, emailDisplayMode: true, image: true },
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

    // Defense in depth for returned records and nested repost previews.
    const conversations = page.filter(conversation => canViewConversation(viewer, conversation))
      .map(conversation => ({ ...conversation,
        Conversation: conversation.Conversation && canViewConversation(viewer, conversation.Conversation) ? conversation.Conversation : null,
      }));

    // These independent lookups must not form a serial Railway round-trip chain.
    const conversationIds = conversations.map(conversation => conversation.id);
    const allParticipantIds = Array.from(
      new Set(conversations.flatMap((conversation) => conversation.participants as string[]))
    );
    const [reposts, pulses, users] = await Promise.all([
      userId && conversationIds.length ? dbPrisma.conversationRepost.findMany({
        where: { userId, conversationId: { in: conversationIds } },
        select: { conversationId: true },
      }) : Promise.resolve([]),
      userId && conversationIds.length ? dbPrisma.pulse.findMany({
        where: { userId, conversationId: { in: conversationIds } },
        select: { conversationId: true, type: true },
      }) : Promise.resolve([]),
      allParticipantIds.length ? fetchUserManyDetails(allParticipantIds) : Promise.resolve([]),
    ]);
    const repostedSet = new Set(reposts.map(repost => repost.conversationId));
    const userPulseMap = new Map(pulses.map(pulse => [pulse.conversationId, pulse.type]));
    const usersById = new Map(users.map(user => [user.id, user]));

    // Add participant details to each conversation
    const conversationsWithUserDetails = conversations.map((conversation): z.infer<typeof ConversationListItemSchema> => {
      const participantDetails = (conversation.participants as string[])
        .map((id) => usersById.get(id))
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
            email: resolveVisibleEmail({
              targetUserId: conversation.Conversation.User.id,
              targetEmail: conversation.Conversation.User.email,
              targetEmailDisplayMode: conversation.Conversation.User.emailDisplayMode,
              viewerUserId: userId,
              viewerRole: userRole,
            }),
            image: conversation.Conversation.User.image ?? null,
          },
          user: {
            id: conversation.Conversation.User.id,
            name: conversation.Conversation.User.name,
            email: resolveVisibleEmail({
              targetUserId: conversation.Conversation.User.id,
              targetEmail: conversation.Conversation.User.email,
              targetEmailDisplayMode: conversation.Conversation.User.emailDisplayMode,
              viewerUserId: userId,
              viewerRole: userRole,
            }),
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
          email: resolveVisibleEmail({
            targetUserId: p.id,
            targetEmail: p.email,
            targetEmailDisplayMode: p.emailDisplayMode,
            viewerUserId: userId,
            viewerRole: userRole,
          }),
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

        repostOfConversationId: conversation.Conversation?.id ?? null,
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
          email: resolveVisibleEmail({
            targetUserId: conversation.User.id,
            targetEmail: conversation.User.email,
            targetEmailDisplayMode: conversation.User.emailDisplayMode,
            viewerUserId: userId,
            viewerRole: userRole,
          }),
          image: conversation.User.image ?? null,
        },
        user: {
          id: conversation.User.id,
          name: conversation.User.name,
          email: resolveVisibleEmail({
            targetUserId: conversation.User.id,
            targetEmail: conversation.User.email,
            targetEmailDisplayMode: conversation.User.emailDisplayMode,
            viewerUserId: userId,
            viewerRole: userRole,
          }),
          image: conversation.User.image ?? null,
        },

        Message: lastMessage ? [lastMessage] : [],
        messages: lastMessage ? [lastMessage] : [],
      };

      return dto;
    });

    // Return with next cursor for pagination
    const nextCursor = page.length === limit
      ? page[page.length - 1]?.id
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

    return NextResponse.json(validated.data, {
      status: 200,
      headers: {
        // This URL also serves personalized pulse/repost state to signed-in
        // viewers, so it must never share a CDN response across sessions.
        'Cache-Control': 'private, no-store',
      },
    });
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
