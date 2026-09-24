/** @fileOverview Private original buyer notice; read-only, never triggers refunds. @stability experimental */
import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';
import { returnAcknowledgment } from '@/lib/payments/return-request';
import { EmailPayload } from '@/lib/payments/email-policy';

const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  'Content-Type': 'text/plain; charset=utf-8', 'Referrer-Policy': 'no-referrer' };
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = (await auth())?.user?.id;
    if (!userId) return new Response('Sign in to download your acknowledgment.', { status: 401, headers });
    const { id } = await params;
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return new Response('Request not found.', { status: 404, headers });
    if (!await allowAuthAttempt('return-acknowledgment-read', userId, request)) {
      return new Response('Please wait a few minutes before downloading again.', { status: 429, headers });
    }
    const record = await dbPrisma.returnRequest.findFirst({ where: { id, userId }, select: {
      id: true, orderId: true, userId: true, reason: true, description: true, createdAt: true,
    } });
    if (!record) return new Response('Request not found.', { status: 404, headers });
    const email = await dbPrisma.transactionalEmail.findFirst({ where: { sourceKey: `buyer-request:${id}`, userId, orderId: record.orderId, kind: 'BUYER_REQUEST' }, select: { payload: true } });
    const saved = EmailPayload.safeParse(email?.payload);
    const original = saved.success ? Buffer.from(saved.data.attachments[0].content, 'base64').toString('utf8') : returnAcknowledgment(record);
    return new Response(original, { headers: { ...headers,
      'Content-Disposition': `attachment; filename="veggat-request-${id}.txt"` } });
  } catch {
    return new Response('Your acknowledgment is temporarily unavailable. Please try again.', { status: 503, headers });
  }
}
