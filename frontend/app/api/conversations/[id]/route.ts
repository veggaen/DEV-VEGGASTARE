import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { pusherServer } from '@/lib/pusher';
import { NextResponse } from 'next/server';
import { parseJsonOrError, parseQueryOrError } from '@/lib/api-validate';
import {
  ConversationType,
  ConversationVisibility,
  ReplyPermission,
  DeletionVisibility
} from '@/generated/prisma/browser';
import { z } from 'zod';
import {
  getReachLevel,
  calculateDeletionDate,
  checkSuspiciousVelocity,
  canDeleteImmediately,
  formatTimeUntilDeletion,
} from '@/lib/conversation-deletion';
import { ConversationAdminResponseSchema } from '@/lib/types/conversations';

const LOG_PREFIX = '[api/conversations/[id]]';

const isDev = process.env.NODE_ENV !== 'production';

function toConversationAdminDto(conversation: any) {
  const user = conversation?.User
    ? {
        id: String(conversation.User.id),
        name: conversation.User.name ?? null,
        email: conversation.User.email ?? null,
        image: conversation.User.image ?? null,
      }
    : null;

  return {
    id: String(conversation.id),
    companyId: conversation.companyId ?? null,

    title: conversation.title ?? null,
    description: conversation.description ?? null,

    userId: String(conversation.userId),
    participants: Array.isArray(conversation.participants) ? conversation.participants : [],

    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    editedAt: conversation.editedAt ?? null,

    allowedRoles: Array.isArray(conversation.allowedRoles) ? conversation.allowedRoles : [],
    customViewers: Array.isArray(conversation.customViewers) ? conversation.customViewers : [],

    isLocked: Boolean(conversation.isLocked),
    isPinned: Boolean(conversation.isPinned),
    replyPermission: conversation.replyPermission,
    tags: Array.isArray(conversation.tags) ? conversation.tags : [],
    type: conversation.type,
    visibility: conversation.visibility,

    lastActivityAt: conversation.lastActivityAt,

    replyCount: typeof conversation.replyCount === 'number' ? conversation.replyCount : undefined,
    uniqueRepliers: typeof conversation.uniqueRepliers === 'number' ? conversation.uniqueRepliers : undefined,
    viewCount: typeof conversation.viewCount === 'number' ? conversation.viewCount : undefined,
    uniqueViewCount: typeof conversation.uniqueViewCount === 'number' ? conversation.uniqueViewCount : undefined,

    deletionRequestedAt: conversation.deletionRequestedAt ?? null,
    deletionScheduledFor: conversation.deletionScheduledFor ?? null,
    deletionVisibility: conversation.deletionVisibility ?? null,

    isAnonymized: Boolean(conversation.isAnonymized),
    originalUserId: conversation.originalUserId ?? null,

    suspiciousActivity: typeof conversation.suspiciousActivity === 'boolean' ? conversation.suspiciousActivity : undefined,
    suspiciousReason: conversation.suspiciousReason ?? null,

    repostOfConversationId: conversation.repostOfConversationId ?? null,

    uniqueIpCount: typeof conversation.uniqueIpCount === 'number' ? conversation.uniqueIpCount : undefined,
    loggedInViewCount: typeof conversation.loggedInViewCount === 'number' ? conversation.loggedInViewCount : undefined,
    anonymousViewCount: typeof conversation.anonymousViewCount === 'number' ? conversation.anonymousViewCount : undefined,
    reachScore: typeof conversation.reachScore === 'number' ? conversation.reachScore : undefined,

    positivePulseCount: typeof conversation.positivePulseCount === 'number' ? conversation.positivePulseCount : undefined,
    negativePulseCount: typeof conversation.negativePulseCount === 'number' ? conversation.negativePulseCount : undefined,
    repulseCount: typeof conversation.repulseCount === 'number' ? conversation.repulseCount : undefined,

    User: user,
    user: user,
  };
}

const deleteQuerySchema = z.object({
  visibility: z.nativeEnum(DeletionVisibility).optional(),
  force: z.preprocess((v) => v === 'true', z.boolean()).optional().default(false),
  cancel: z.preprocess((v) => v === 'true', z.boolean()).optional().default(false),
});

const patchBodySchema = z.object({
  title: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  visibility: z.nativeEnum(ConversationVisibility).optional(),
  replyPermission: z.nativeEnum(ReplyPermission).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  isPinned: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  // Visibility targeting
  visibleToUserIds: z.array(z.string().min(1).max(200)).max(200).optional(),
  visibleToGroupIds: z.array(z.string().min(1).max(200)).max(50).optional(),
  customViewers: z.array(z.string().min(1).max(200)).max(200).optional(),
});

/**
 * Notify participants about a pending deletion
 * Uses Pusher to send real-time notifications
 */
async function notifyParticipantsOfDeletion(
  conversationId: string,
  conversationTitle: string | null,
  participants: string[],
  uniqueRepliers: string[],
  deletionScheduledFor: Date,
  requesterId: string
) {
  // Combine participants and unique repliers, excluding the requester
  const allUsersToNotify = [...new Set([...participants, ...uniqueRepliers])]
    .filter(id => id !== requesterId);

  const timeUntil = formatTimeUntilDeletion(deletionScheduledFor);
  const title = conversationTitle || 'Untitled thread';

  // Send notification to each user's personal channel
  for (const participantId of allUsersToNotify) {
    try {
      await pusherServer.trigger(`user_${participantId}`, 'thread-deletion-notice', {
        conversationId,
        title,
        deletionScheduledFor: deletionScheduledFor.toISOString(),
        timeUntil,
        message: `A thread you participated in ("${title}") will be deleted in ${timeUntil}`,
      });
    } catch (error) {
      console.debug(LOG_PREFIX, `Failed to notify user ${participantId}:`, error);
    }
  }

  console.log(LOG_PREFIX, `Notified ${allUsersToNotify.length} participants about deletion`);
}

/**
 * DELETE /api/conversations/[id]
 *
 * Request deletion of a conversation. Behavior depends on reach level:
 * - LOW reach: Instant deletion
 * - MEDIUM/HIGH/VIRAL: Grace period with anonymization
 *
 * Query params:
 * - visibility: 'PUBLIC' | 'PRIVATE' (default: 'PRIVATE')
 * - force: 'true' (admin only - bypasses grace period)
 * - cancel: 'true' (cancel pending deletion)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  const queryResult = parseQueryOrError(req, deleteQuerySchema);
  if (!queryResult.ok) return queryResult.response;
  const { visibility: visibilityParam, force: forceDelete, cancel: cancelDeletion } = queryResult.data;

  const session = await MyLibUserAuth();
  if (!session || !session.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId: string = session.id;
  const userRole = session.role;
  const isAdmin = userRole === 'ADMIN' || userRole === 'OWNER';

  try {
    const conversation = await dbPrisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
    }

    // Check if user is the creator (or was before anonymization)
    const isCreator = conversation.userId === userId || conversation.originalUserId === userId;

    // Only creator or admin/owner can delete
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ message: 'Forbidden - only the creator or admins can delete' }, { status: 403 });
    }

    // Handle cancellation of pending deletion
    if (cancelDeletion) {
      if (!conversation.deletionRequestedAt) {
        return NextResponse.json({ message: 'No pending deletion to cancel' }, { status: 400 });
      }

      // Restore the conversation
      await dbPrisma.conversation.update({
        where: { id: conversationId },
        data: {
          deletionRequestedAt: null,
          deletionScheduledFor: null,
          deletionVisibility: 'PRIVATE',
          isAnonymized: false,
          // Restore original user if it was anonymized
          userId: conversation.originalUserId || conversation.userId,
          originalUserId: null,
        },
      });

      console.log(LOG_PREFIX, `Deletion cancelled for conversation ${conversationId} by user ${userId}`);
      return NextResponse.json({ message: 'Deletion cancelled', restored: true }, { status: 200 });
    }

    // Check for suspicious velocity
    const velocityCheck = checkSuspiciousVelocity(conversation);
    if (velocityCheck.isSuspicious && !conversation.suspiciousActivity) {
      await dbPrisma.conversation.update({
        where: { id: conversationId },
        data: {
          suspiciousActivity: true,
          suspiciousReason: velocityCheck.reason,
        },
      });
      console.log(LOG_PREFIX, `Flagged suspicious activity: ${velocityCheck.reason}`);
    }

    // Admin force delete - bypass grace period
    if (forceDelete && isAdmin) {
      await dbPrisma.conversation.delete({
        where: { id: conversationId },
      });
      console.log(LOG_PREFIX, `Conversation ${conversationId} force-deleted by admin ${userId}`);
      return NextResponse.json({ message: 'Conversation deleted (admin force)', deleted: true }, { status: 200 });
    }

    // Check if can delete immediately (low reach)
    if (canDeleteImmediately(conversation)) {
      await dbPrisma.conversation.delete({
        where: { id: conversationId },
      });
      console.log(LOG_PREFIX, `Conversation ${conversationId} deleted immediately (low reach) by user ${userId}`);
      return NextResponse.json({ message: 'Conversation deleted', deleted: true }, { status: 200 });
    }

    // Higher reach - schedule deletion with grace period
    const reachLevel = getReachLevel(conversation);
    const deletionDate = calculateDeletionDate(conversation);
    const visibility = visibilityParam || 'PRIVATE';

    // Get unique repliers from messages to notify them
    const uniqueReplierIds = await dbPrisma.message.findMany({
      where: { conversationId },
      select: { senderId: true },
      distinct: ['senderId'],
    }).then(messages => messages.map(m => m.senderId));

    // Anonymize creator immediately and schedule deletion
    await dbPrisma.conversation.update({
      where: { id: conversationId },
      data: {
        deletionRequestedAt: new Date(),
        deletionScheduledFor: deletionDate,
        deletionVisibility: visibility,
        isAnonymized: true,
        originalUserId: conversation.userId, // Store original for potential restoration
      },
    });

    // Notify participants (semi-silent, via Pusher)
    await notifyParticipantsOfDeletion(
      conversationId,
      conversation.title,
      conversation.participants as string[],
      uniqueReplierIds,
      deletionDate,
      userId
    );

    console.log(LOG_PREFIX, `Deletion scheduled for conversation ${conversationId} (${reachLevel} reach) - will delete on ${deletionDate.toISOString()}`);

    return NextResponse.json({
      message: 'Deletion scheduled',
      scheduled: true,
      reachLevel,
      deletionScheduledFor: deletionDate.toISOString(),
      visibility,
      anonymized: true,
    }, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error processing deletion:', error);
    return NextResponse.json(
      { message: 'Error processing deletion', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/conversations/[id]
 *
 * Fetch a single conversation by ID for editing purposes.
 * Only the creator or admins can access full details.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  const session = await MyLibUserAuth();

  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.id;
  const userRole = session.role;

  try {
    const conversation = await dbPrisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        User: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
    }

    // Only creator or admin can access full details
    const isOwner = conversation.userId === userId;
    const isAdmin = userRole === 'ADMIN' || userRole === 'OWNER';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const dto = toConversationAdminDto(conversation);
    const parsed = ConversationAdminResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error(LOG_PREFIX, 'GET - invalid DTO:', parsed.error.issues);
      return NextResponse.json(
        {
          message: 'Error fetching conversation',
          ...(isDev ? { error: 'Invalid DTO', issues: parsed.error.issues } : {}),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error fetching conversation:', error);
    return NextResponse.json(
      { message: 'Error fetching conversation', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/conversations/[id]
 *
 * Update a conversation's editable fields.
 * Only the creator or admins can update.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  const session = await MyLibUserAuth();

  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.id;
  const userRole = session.role;

  try {
    const conversation = await dbPrisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
    }

    // Only creator or admin can update
    const isOwner = conversation.userId === userId;
    const isAdmin = userRole === 'ADMIN' || userRole === 'OWNER';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const bodyResult = await parseJsonOrError(req, patchBodySchema);
    if (!bodyResult.ok) return bodyResult.response;

    const {
      title,
      description,
      visibility,
      replyPermission,
      tags,
      isPinned,
      isLocked,
      visibleToUserIds,
      visibleToGroupIds,
      customViewers,
    } = bodyResult.data;

    // Build update data - only include fields that were explicitly provided
    const updateData: Record<string, unknown> = {};
    let contentEdited = false; // Track if content was changed (triggers editedAt)

    if (typeof title === 'string') {
      updateData.title = title.trim() || null;
      contentEdited = true;
    }
    if (typeof description === 'string') {
      updateData.description = description.trim() || null;
      contentEdited = true;
    }
    
    // Set editedAt if content was changed
    if (contentEdited) {
      updateData.editedAt = new Date();
    }
    
    if (visibility) updateData.visibility = visibility;
    if (replyPermission) updateData.replyPermission = replyPermission;
    if (tags) updateData.tags = tags;
    // Visibility targeting fields - owner can set these themselves
    if (visibleToUserIds) updateData.visibleToUserIds = visibleToUserIds;
    if (visibleToGroupIds) updateData.visibleToGroupIds = visibleToGroupIds;
    if (customViewers) updateData.customViewers = customViewers;
    // Only admin/owner can pin/lock
    if (isAdmin) {
      if (typeof isPinned === 'boolean') {
        updateData.isPinned = isPinned;
      }
      if (typeof isLocked === 'boolean') {
        updateData.isLocked = isLocked;
      }
    }

    const updated = await dbPrisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
      include: {
        User: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    console.log(LOG_PREFIX, `Updated conversation ${conversationId}:`, Object.keys(updateData));

    const dto = toConversationAdminDto(updated);
    const parsed = ConversationAdminResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error(LOG_PREFIX, 'PATCH - invalid DTO:', parsed.error.issues);
      return NextResponse.json(
        {
          message: 'Error updating conversation',
          ...(isDev ? { error: 'Invalid DTO', issues: parsed.error.issues } : {}),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error(LOG_PREFIX, 'Error updating conversation:', error);
    return NextResponse.json(
      { message: 'Error updating conversation', ...(isDev && error instanceof Error ? { error: error.message } : {}) },
      { status: 500 }
    );
  }
}