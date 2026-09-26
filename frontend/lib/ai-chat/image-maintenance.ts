import 'server-only';
import { dbPrisma } from '@/lib/db';
import { unusedImageCutoff } from './images';
import { deleteChatImage } from './image-storage';

export async function chatImageMaintenance() {
  // Claim at most five expired uploads. No remote I/O under the database lock.
  // A tombstone denies reads/links immediately and makes cleanup retryable.
  const expired = await dbPrisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(621642901)`;
    const rows = await tx.aiChatImage.findMany({ where: { OR: [
      // Lease the claim for longer than the cron's execution window, so two
      // concurrent runs cannot delete the same remote asset.
      { purgingAt: { lt: new Date(Date.now() - 10 * 60_000) } },
      { purgingAt: null, messageId: null, createdAt: { lt: unusedImageCutoff() } },
      { purgingAt: null, conversation: { isDeleted: true, deletedAt: { lt: new Date(Date.now() - 30 * 86400_000) } } },
    ] }, orderBy: { createdAt: 'asc' }, take: 5, select: { id: true, storageKey: true } });
    await tx.aiChatImage.updateMany({ where: { id: { in: rows.map(row => row.id) } }, data: { purgingAt: new Date() } });
    return rows;
  });
  let removed = 0;
  for (const row of expired) {
    try {
      if (row.storageKey) await deleteChatImage(row.storageKey);
      await dbPrisma.aiChatImage.deleteMany({ where: { id: row.id, purgingAt: { not: null } } });
      removed++;
    } catch { /* Keep the tombstone and storage location for the next pass. */ }
  }
  return { removed, deferred: expired.length - removed };
}
