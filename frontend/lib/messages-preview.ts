/** @fileOverview Minimal read-only inbox DTO; no participant-ID/object confusion. @stability stable */
import { z } from 'zod';

export const InboxPreviewSchema = z.object({
  conversations: z.array(z.object({
    id: z.string().min(1),
    title: z.string().nullable(),
    type: z.enum(['PRIVATE_DM', 'GROUP', 'RESTRICTED', 'PUBLIC_THREAD']),
    updatedAt: z.string(),
    lastActivityAt: z.string().nullable().optional(),
    participantDetails: z.array(z.object({ id: z.string(), name: z.string().nullable(), image: z.string().nullable().optional() })),
    lastMessage: z.object({ content: z.string(), createdAt: z.string(), senderId: z.string().nullable().optional(), imageUrl: z.string().nullable().optional() }).nullable(),
  })).max(8),
});
export type InboxPreview = z.infer<typeof InboxPreviewSchema>;

export function previewName(item: InboxPreview['conversations'][number], userId: string): string {
  const others = item.participantDetails.filter(person => person.id !== userId);
  if (item.type === 'PRIVATE_DM' && others.length) return others[0].name?.trim() || 'Veggat member';
  if (item.title?.trim()) return item.title.trim();
  if (item.type === 'PRIVATE_DM' && !others.length) return 'Saved messages';
  return others.slice(0, 3).map(person => person.name?.trim() || 'Veggat member').join(', ') || 'Untitled conversation';
}
