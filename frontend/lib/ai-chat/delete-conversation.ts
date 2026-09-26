/** @fileOverview Preserve private file locations until remote cleanup succeeds. @stability experimental */
import 'server-only';
import { dbPrisma } from '@/lib/db';

export async function permanentlyDeleteAiConversation(id: string, actorId: string) {
  return dbPrisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(621642901)`;
    if (await tx.aiChatImage.count({ where: { conversationId: id } })) {
      await tx.aiConversation.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date(), deletedBy: actorId } });
      // Do not reset an active cleanup lease when an owner retries deletion.
      await tx.aiChatImage.updateMany({ where: { conversationId: id, purgingAt: null }, data: { purgingAt: new Date(0) } });
      return { pending: true };
    }
    await tx.aiConversation.delete({ where: { id } });
    return { pending: false };
  });
}
