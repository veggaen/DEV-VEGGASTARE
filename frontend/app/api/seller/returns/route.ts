/** @fileOverview Private, bounded seller inbox without cross-seller order disclosure. @stability experimental */
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { isDemoUserId } from '@/lib/demo-policy';
import { checkRateLimit, getClientIdentifier, rateLimitedResponse } from '@/lib/rate-limit';
import { ReviewQuery } from '@/lib/payments/return-review';
import { managedReturnCompanies, reviewableOrderWhere } from '@/lib/payments/return-review-access';
import { storedCheckoutAgreement } from '@/lib/payments/checkout-agreement';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  const limit = await checkRateLimit(getClientIdentifier(request, session.user.id), 'read');
  if (!limit.success) return rateLimitedResponse(limit);
  const query = ReviewQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return NextResponse.json({ error: 'Invalid request filters' }, { status: 400, headers });
  const { page, status, id } = query.data;
  // No real buyer correspondence is exposed to an interviewer/demo identity.
  if (isDemoUserId(session.user.id) || session.user.isDemo) return NextResponse.json({ requests: [], page, hasMore: false, readOnly: true }, { headers });
  try {
    const companies = session.user.role === 'ADMIN' ? [] : await managedReturnCompanies(session.user.id);
    const records = await dbPrisma.returnRequest.findMany({
      where: { ...(id ? { id } : {}), ...(status === 'ALL' ? {} : { status }), Order: reviewableOrderWhere(session.user.id, session.user.role, companies) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 20, take: 21,
      select: { id: true, orderId: true, reason: true, description: true, status: true,
        sellerNote: true, createdAt: true, updatedAt: true,
        Order: { select: { totalAmount: true, currency: true, status: true,
          OrderItem: { take: 20, orderBy: { id: 'asc' }, select: { title: true, quantity: true } },
          _count: { select: { OrderItem: true } },
          CheckoutAttempt: { select: { environment: true, state: true, captureId: true, refundReference: true, quote: true } },
        } },
      },
    });
    const visible = records.slice(0, 20);
    const counters = visible.length ? await dbPrisma.downloadToken.groupBy({
      by: ['orderId'], where: { orderId: { in: visible.map(record => record.orderId) } }, _sum: { usedCount: true },
    }) : [];
    return NextResponse.json({ page, hasMore: records.length > 20, readOnly: false,
      requests: visible.map(record => {
        const attempt = record.Order.CheckoutAttempt;
        const agreement = storedCheckoutAgreement(attempt?.quote);
        return { id: record.id, orderId: record.orderId, reason: record.reason, description: record.description,
          status: record.status, sellerNote: record.sellerNote,
          createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
          order: { total: record.Order.totalAmount, currency: record.Order.currency, status: record.Order.status,
            environment: attempt?.environment ?? null, paymentState: attempt?.state ?? null,
            captureId: attempt?.captureId ?? null, refundReference: attempt?.refundReference ?? null,
            items: record.Order.OrderItem.map(item => ({ title: item.title, quantity: item.quantity })),
            itemCount: record.Order._count.OrderItem,
            downloadRequests: counters.find(row => row.orderId === record.orderId)?._sum.usedCount ?? 0,
            agreement: agreement ? { version: agreement.version, recordedAt: agreement.recordedAt, demo: agreement.demo, requests: agreement.requests } : null,
          },
        };
      }),
    }, { headers });
  } catch {
    console.error('[seller/returns] Request inbox unavailable');
    return NextResponse.json({ error: 'Could not load purchase requests. Try again.' }, { status: 503, headers });
  }
}
