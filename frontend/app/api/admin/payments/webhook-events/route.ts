/**
 * @fileOverview Admin payment webhook event feed (exact persisted webhook deliveries).
 * @stability active
 */

import { NextResponse } from 'next/server';
import { MyLibUserAuth } from '@/lib/user-auth';
import { isAdmin } from '@/lib/admin';
import { dbPrisma } from '@/lib/db';

const LOG_PREFIX = '[api/admin/payments/webhook-events]';
const prisma = dbPrisma as any;

export async function GET() {
  const session = await MyLibUserAuth();

  if (!session?.id || !isAdmin(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const rows = await prisma.paymentWebhookEvent.findMany({
      where: {
        provider: 'paypal',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    const events = rows.map((row: any) => ({
      id: row.id,
      provider: row.provider,
      eventType: row.eventType,
      deliveryId: row.deliveryId,
      signatureVerified: row.signatureVerified,
      sessionId: row.sessionId,
      orderId: row.orderId,
      paymentId: row.paymentId,
      paymentStatus: row.paymentStatus,
      orderStatus: row.orderStatus,
      httpStatus: row.httpStatus,
      processingError: row.processingError,
      createdAt: row.createdAt,
    }));

    return NextResponse.json({ events });
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to fetch webhook event feed:`, error);
    return NextResponse.json({ error: 'Failed to fetch webhook events' }, { status: 500 });
  }
}
