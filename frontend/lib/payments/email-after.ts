/** @fileOverview Best-effort immediate delivery backed by a durable retry queue. @stability experimental */
import 'server-only';
import { after } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { processTransactionEmailBatch } from './email-dispatch';

export function scheduleTransactionEmail(sourceKey: string) {
  after(async () => {
    try { await processTransactionEmailBatch(dbPrisma, sourceKey); }
    catch { console.error('[transactional-email] Background delivery deferred; durable record retained'); }
  });
}
