/** @fileOverview Authenticated email delivery evidence, isolated from fulfillment. @stability experimental */
import { dbPrisma } from '@/lib/db';
import { recordDeliveryEvent, verifyDeliveryEvent, webhookConfigured } from '@/lib/payments/email-webhook';

export const runtime = 'nodejs';
const respond = (body: object, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookConfigured(secret)) return respond({ error: 'WEBHOOK_NOT_CONFIGURED' }, 503);
  if (Number(request.headers.get('content-length')) > 65_536) return respond({ error: 'PAYLOAD_TOO_LARGE' }, 413);
  const reader = request.body?.getReader();
  if (!reader) return respond({ error: 'INVALID_EVENT' }, 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 65_536) { await reader.cancel(); return respond({ error: 'PAYLOAD_TOO_LARGE' }, 413); }
      chunks.push(part.value);
    }
  } catch { return respond({ error: 'INVALID_EVENT' }, 400); }
  let verified;
  try { verified = verifyDeliveryEvent(Buffer.concat(chunks).toString('utf8'), request.headers, secret!); }
  catch { return respond({ error: 'INVALID_SIGNATURE_OR_EVENT' }, 401); }
  if (!verified.event) return respond({ received: true });
  try {
    await recordDeliveryEvent(dbPrisma, verified.id, verified.event);
    return respond({ received: true });
  } catch {
    // No payload/recipient/signature logging; non-2xx asks Resend to retry.
    return respond({ error: 'DELIVERY_RECORD_RETRY' }, 503);
  }
}
