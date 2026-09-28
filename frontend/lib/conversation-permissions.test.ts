/** @fileOverview Replies never bypass conversation read access. @stability stable */
import { expect, it } from 'vitest';
import { buildVisibilityWhereClause, canReplyToConversation, canViewConversation, type ConversationForPermissions } from './conversation-permissions';
const conversation: ConversationForPermissions = { id: 'thread', userId: 'creator', participants: ['member'], type: 'GROUP', visibility: 'PARTICIPANTS', replyPermission: 'EVERYONE', allowedRoles: [], customViewers: [], visibleToUserIds: [], isLocked: false };
it('ignores the default PRIVATE deletion preference until deletion is requested', () => {
  expect(canViewConversation({ id: 'member', role: 'USER' }, { ...conversation, deletionVisibility: 'PRIVATE', deletionRequestedAt: null })).toBe(true);
  expect(canViewConversation({ id: 'member', role: 'USER' }, { ...conversation, deletionVisibility: 'PRIVATE', deletionRequestedAt: new Date() })).toBe(false);
});
it('denies a non-viewer even when replies are set to everyone', () => {
  expect(canReplyToConversation({ id: 'outsider', role: 'USER' }, conversation)).toBe(false);
});
it('keeps ordinary public replies and authorized private replies', () => {
  expect(canReplyToConversation({ id: 'member', role: 'USER' }, conversation)).toBe(true);
  expect(canReplyToConversation({ id: 'outsider', role: 'USER' }, { ...conversation, type: 'PUBLIC_THREAD', visibility: 'PUBLIC' })).toBe(true);
});
it('keeps guest, locked and creator-only restrictions', () => {
  expect(canReplyToConversation(null, conversation)).toBe(false);
  expect(canReplyToConversation({ id: 'member', role: 'USER' }, { ...conversation, isLocked: true })).toBe(false);
  expect(canReplyToConversation({ id: 'member', role: 'USER' }, { ...conversation, replyPermission: 'CREATOR_ONLY' })).toBe(false);
});
it.each(['OWNER', 'ADMIN'] as const)('preserves the existing %s moderation policy', role => {
  expect(canReplyToConversation({ id: 'moderator', role }, conversation)).toBe(true);
});

it.each(['PRIVATE_DM', 'GROUP'] as const)('does not publish legacy %s records through broad visibility', type => {
  for (const visibility of ['PUBLIC', 'CUSTOM', 'ROLE_BASED', 'SPECIFIC_USERS'] as const) {
    const record = { ...conversation, type, visibility, customViewers: ['outsider'], visibleToUserIds: ['outsider'], allowedRoles: ['USER' as const] };
    expect(canViewConversation(null, record)).toBe(false);
    expect(canViewConversation({ id: 'outsider', role: 'USER' }, record)).toBe(false);
    expect(canReplyToConversation({ id: 'outsider', role: 'USER' }, record)).toBe(false);
    expect(canViewConversation({ id: 'creator', role: 'USER' }, record)).toBe(true);
  }
});
it('does not widen legacy PRIVATE visibility to all participants', () => {
  expect(canViewConversation({ id: 'member', role: 'USER' }, { ...conversation, visibility: 'PRIVATE' })).toBe(false);
});
it('applies private-type and pending-deletion restrictions before database pagination', () => {
  expect(buildVisibilityWhereClause(null)).toEqual({ AND: [
    { type: { notIn: ['PRIVATE_DM', 'GROUP'] } },
    { OR: [{ deletionRequestedAt: null }, { deletionVisibility: { not: 'PRIVATE' } }] },
    { visibility: 'PUBLIC' },
  ] });
  expect(buildVisibilityWhereClause({ id: 'member', role: 'USER' })).toMatchObject({ OR: [
    { userId: 'member' }, { AND: [
      { OR: [{ type: { notIn: ['PRIVATE_DM', 'GROUP'] } }, { participants: { has: 'member' } }] },
      { OR: [{ deletionRequestedAt: null }, { deletionVisibility: { not: 'PRIVATE' } }] },
      { OR: expect.arrayContaining([{ visibility: 'PARTICIPANTS', participants: { has: 'member' } }]) },
    ] },
  ] });
  expect(buildVisibilityWhereClause({ id: 'admin', role: 'ADMIN' })).toEqual({});
});
