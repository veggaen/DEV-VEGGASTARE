/** @fileOverview Replies never bypass conversation read access. @stability stable */
import { expect, it } from 'vitest';
import { canReplyToConversation, canViewConversation, type ConversationForPermissions } from './conversation-permissions';
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
  expect(canReplyToConversation({ id: 'outsider', role: 'USER' }, { ...conversation, visibility: 'PUBLIC' })).toBe(true);
});
it('keeps guest, locked and creator-only restrictions', () => {
  expect(canReplyToConversation(null, conversation)).toBe(false);
  expect(canReplyToConversation({ id: 'member', role: 'USER' }, { ...conversation, isLocked: true })).toBe(false);
  expect(canReplyToConversation({ id: 'member', role: 'USER' }, { ...conversation, replyPermission: 'CREATOR_ONLY' })).toBe(false);
});
it.each(['OWNER', 'ADMIN'] as const)('preserves the existing %s moderation policy', role => {
  expect(canReplyToConversation({ id: 'moderator', role }, conversation)).toBe(true);
});
