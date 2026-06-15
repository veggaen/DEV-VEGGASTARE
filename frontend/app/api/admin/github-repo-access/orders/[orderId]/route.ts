import { NextRequest, NextResponse } from 'next/server';
import { MyLibUserAuth } from '@/lib/user-auth';
import { isAdmin } from '@/lib/admin';
import { dbPrisma } from '@/lib/db';
import { grantRepoAccessForOrder } from '@/lib/github-repo-access';

const prisma = dbPrisma as any;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await MyLibUserAuth();
  if (!session?.id || !isAdmin(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const events = await prisma.paymentWebhookEvent.findMany({
    where: {
      provider: 'github_repo_access',
      orderId,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      eventType: true,
      paymentStatus: true,
      orderStatus: true,
      processingError: true,
      rawPayload: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ order, events });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await MyLibUserAuth();
  if (!session?.id || !isAdmin(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.status !== 'COMPLETED') {
    return NextResponse.json({ error: 'Order must be COMPLETED before retrying repo-access grants' }, { status: 400 });
  }

  try {
    const result = await grantRepoAccessForOrder(orderId, 'admin.retry');
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Retry failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
