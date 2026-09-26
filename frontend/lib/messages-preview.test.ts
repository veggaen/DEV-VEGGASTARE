/** @fileOverview Inbox preview DTO and naming regressions. @stability stable */
import { expect, it } from 'vitest';
import { InboxPreviewSchema, previewName, type InboxPreview } from './messages-preview';
const item: InboxPreview['conversations'][number] = { id: 'chat', title: '', type: 'PRIVATE_DM', updatedAt: '2026-09-26T10:00:00Z', participantDetails: [{ id: 'me', name: 'Me' }, { id: 'other', name: 'Alex' }], lastMessage: null };
it('uses the other DM participant, not participant IDs or a generic title', () => { expect(previewName({ ...item, title: 'Direct message' }, 'me')).toBe('Alex'); });
it('uses a group title without replacing it with a person', () => { expect(previewName({ ...item, type: 'GROUP', title: '  Release  ' }, 'me')).toBe('Release'); });
it('provides deliberate self, unnamed-user and unnamed-group fallbacks', () => {
  expect(previewName({ ...item, participantDetails: [{ id: 'me', name: 'Me' }] }, 'me')).toBe('Saved messages');
  expect(previewName({ ...item, participantDetails: [{ id: 'other', name: null }] }, 'me')).toBe('Veggat member');
  expect(previewName({ ...item, type: 'GROUP', participantDetails: [] }, 'me')).toBe('Untitled conversation');
});
it('accepts real list DTO extras but reads only the reviewed preview shape', () => {
  const parsed = InboxPreviewSchema.parse({ conversations: [{ ...item, participants: ['me', 'other'], unreadCount: 999 }], nextCursor: null });
  expect(parsed.conversations[0]).not.toHaveProperty('unreadCount');
  expect(parsed.conversations[0].participantDetails[1].name).toBe('Alex');
});
it('does not silently render malformed responses as an empty inbox', () => {
  expect(InboxPreviewSchema.safeParse({ error: 'bad response' }).success).toBe(false);
  expect(InboxPreviewSchema.safeParse({ conversations: [{ ...item, participantDetails: ['other'] }] }).success).toBe(false);
});
it('bounds the preview and accepts a real empty result', () => {
  expect(InboxPreviewSchema.safeParse({ conversations: Array(9).fill(item) }).success).toBe(false);
  expect(InboxPreviewSchema.parse({ conversations: [] }).conversations).toEqual([]);
});
