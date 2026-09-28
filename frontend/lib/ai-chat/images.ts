import 'server-only';
import { dbPrisma } from '@/lib/db';
import { AiCreditError } from '@/lib/ai-credit-ledger';
import { readChatImage } from './image-storage';
import { CHAT_IMAGES_PER_CONTEXT, CHAT_IMAGES_PER_MESSAGE } from './image-policy';
import type { ChatMessage } from './credit-policy';

export const imageSelect = { id: true, width: true, height: true } as const;
export const unusedImageCutoff = () => new Date(Date.now() - 24 * 60 * 60_000);
export function visibleImageWhere(userId: string, conversationId?: string) {
  return { ...(conversationId ? { conversationId } : {}), storageKey: { not: null }, purgingAt: null,
    OR: [{ messageId: { not: null } }, { ownerId: userId, createdAt: { gt: unusedImageCutoff() } }],
    conversation: { isDeleted: false, isSuspended: false,
      OR: [{ creatorId: userId }, { participants: { some: { userId, isActive: true } } }] },
  };
}

export async function loadChatImages(messages: (ChatMessage & { imageIds?: string[] })[], userId?: string, conversationId?: string) {
  const ids = messages.flatMap(message => message.imageIds ?? []);
  if (!ids.length) return messages;
  if (!userId || !conversationId) throw new AiCreditError('IMAGE_PRIVATE_CHAT_REQUIRED', 403);
  if (ids.length > CHAT_IMAGES_PER_CONTEXT || new Set(ids).size !== ids.length || messages.some(m => (m.imageIds?.length ?? 0) > CHAT_IMAGES_PER_MESSAGE || (m.imageIds?.length && m.role !== 'user'))) throw new AiCreditError('INVALID_REQUEST', 400);
  const rows = await dbPrisma.aiChatImage.findMany({ where: { id: { in: ids }, ...visibleImageWhere(userId, conversationId) }, select: { id: true, ownerId: true, storageKey: true } });
  if (rows.length !== ids.length) throw new AiCreditError('IMAGE_UNAVAILABLE', 403);
  const images = new Map<string, string>();
  for (const row of rows) images.set(row.id, `data:image/jpeg;base64,${Buffer.from(await readChatImage(row.storageKey!, row.ownerId)).toString('base64')}`);
  return messages.map(message => ({ role: message.role, content: message.content, images: (message.imageIds ?? []).map(id => images.get(id)!) }));
}
