import type { Conversation, Prisma, UserRole } from '@/generated/prisma/browser';

export const privateConversationTypes = ['PRIVATE_DM', 'GROUP'] as const;

/** Minimal user shape needed for permission checks */
export interface PermissionUser {
  id: string;
  role: UserRole;
}

/** Conversation with fields needed for permission checks */
export type ConversationForPermissions = Pick<
  Conversation,
  | 'id'
  | 'userId'
  | 'participants'
  | 'type'
  | 'visibility'
  | 'replyPermission'
  | 'allowedRoles'
  | 'customViewers'
  | 'visibleToUserIds'
  | 'isLocked'
> & Partial<Pick<Conversation, 'deletionVisibility' | 'deletionRequestedAt'>>;

/**
 * Check if a user can READ/VIEW a conversation.
 * This is the core visibility check used for listing and viewing.
 */
export function canViewConversation(
  user: PermissionUser | null,
  conversation: ConversationForPermissions
): boolean {
  // A legacy visibility value must never turn a direct/group chat into a public post.
  if ((conversation.type === 'PRIVATE_DM' || conversation.type === 'GROUP') &&
    (!user || (conversation.userId !== user.id && user.role !== 'OWNER' && user.role !== 'ADMIN' && !conversation.participants.includes(user.id)))) {
    return false;
  }
  if (conversation.deletionRequestedAt && conversation.deletionVisibility === 'PRIVATE') {
    return !!user && (conversation.userId === user.id || user.role === 'OWNER' || user.role === 'ADMIN');
  }
  // PUBLIC visibility: anyone can view (even guests)
  if (conversation.visibility === 'PUBLIC') {
    return true;
  }

  // All other visibility levels require authentication
  if (!user) {
    return false;
  }

  // Creator and OWNER/ADMIN can always view
  if (
    conversation.userId === user.id ||
    user.role === 'OWNER' ||
    user.role === 'ADMIN'
  ) {
    return true;
  }

  // Check based on visibility type
  switch (conversation.visibility) {
    case 'PARTICIPANTS':
      // Only participants can view
      return conversation.participants.includes(user.id);

    case 'ROLE_BASED':
      // Check if user's role is in allowedRoles
      return conversation.allowedRoles.includes(user.role);

    case 'CUSTOM':
      // Check if user is in customViewers list OR is a participant
      return (
        conversation.customViewers.includes(user.id) ||
        conversation.participants.includes(user.id)
      );

    case 'SPECIFIC_USERS':
      // Check if user is in the visibleToUserIds list
      return conversation.visibleToUserIds.includes(user.id);

    default:
      return false;
  }
}

/**
 * Check if a user can REPLY/POST messages to a conversation.
 * Read access is required here as well; callers cannot accidentally bypass it.
 */
export function canReplyToConversation(
  user: PermissionUser | null,
  conversation: ConversationForPermissions,
  mentionedUserIds: string[] = []
): boolean {
  // Must be authenticated to reply
  if (!user || !canViewConversation(user, conversation)) {
    return false;
  }

  // Locked conversations: only creator and admins can reply
  if (conversation.isLocked) {
    return (
      conversation.userId === user.id ||
      user.role === 'OWNER' ||
      user.role === 'ADMIN'
    );
  }

  // Creator can always reply to their own conversation
  if (conversation.userId === user.id) {
    return true;
  }

  // OWNER/ADMIN can always reply
  if (user.role === 'OWNER' || user.role === 'ADMIN') {
    return true;
  }

  // Check based on reply permission type
  switch (conversation.replyPermission) {
    case 'EVERYONE':
      // Read access was checked above.
      return true;

    case 'PARTICIPANTS':
      // Only participants can reply
      return conversation.participants.includes(user.id);

    case 'MENTIONED':
      // Only mentioned users can reply
      return mentionedUserIds.includes(user.id);

    case 'MODS_ONLY':
      // Only OWNER/ADMIN (already checked above)
      return false;

    case 'CREATOR_ONLY':
      // Only creator (already checked above)
      return false;

    default:
      return false;
  }
}

/**
 * Check if a user can EDIT/DELETE a conversation.
 * Only creator and admins can modify conversations.
 */
export function canModifyConversation(
  user: PermissionUser | null,
  conversation: ConversationForPermissions
): boolean {
  if (!user) return false;

  return (
    conversation.userId === user.id ||
    user.role === 'OWNER' ||
    user.role === 'ADMIN'
  );
}

/**
 * Check if a user can PIN/LOCK a conversation.
 * Only OWNER/ADMIN can moderate.
 */
export function canModerateConversation(
  user: PermissionUser | null
): boolean {
  if (!user) return false;
  return user.role === 'OWNER' || user.role === 'ADMIN';
}

/**
 * Build a Prisma WHERE clause for fetching conversations visible to a user.
 * This is used for listing conversations.
 */
export function buildVisibilityWhereClause(user: PermissionUser | null): Prisma.ConversationWhereInput {
  if (user?.role === 'OWNER' || user?.role === 'ADMIN') return {};
  const notPrivateType: Prisma.ConversationWhereInput = { type: { notIn: [...privateConversationTypes] } };
  const notHiddenByDeletion: Prisma.ConversationWhereInput = {
    OR: [{ deletionRequestedAt: null }, { deletionVisibility: { not: 'PRIVATE' } }],
  };
  if (!user) return { AND: [notPrivateType, notHiddenByDeletion, { visibility: 'PUBLIC' }] };
  // Mirrors canViewConversation, including narrower legacy PRIVATE visibility.
  return { OR: [
    { userId: user.id },
    { AND: [
      { OR: [notPrivateType, { participants: { has: user.id } }] },
      notHiddenByDeletion,
      { OR: [
        { visibility: 'PUBLIC' },
        { visibility: 'PARTICIPANTS', participants: { has: user.id } },
        { visibility: 'ROLE_BASED', allowedRoles: { has: user.role } },
        { visibility: 'CUSTOM', OR: [{ customViewers: { has: user.id } }, { participants: { has: user.id } }] },
        { visibility: 'SPECIFIC_USERS', visibleToUserIds: { has: user.id } },
      ] },
    ] },
  ] };
}

