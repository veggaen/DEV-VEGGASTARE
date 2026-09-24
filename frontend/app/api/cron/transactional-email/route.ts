/** @fileOverview Authenticated, bounded retry of queued transactional mail. @stability experimental */
import { NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { isCronAuthorized } from '@/lib/cron-auth';
import { processTransactionEmailBatch } from '@/lib/payments/email-dispatch';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  try { return NextResponse.json(await processTransactionEmailBatch(dbPrisma), { headers }); }
  catch { return NextResponse.json({ error: 'Email processing deferred' }, { status: 503, headers }); }
}
