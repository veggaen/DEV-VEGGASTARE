/** @fileOverview Immutable transactional messages and truthful delivery states. @stability experimental */
import { z } from 'zod';

export const TRANSACTIONAL_SENDER = 'Veggat Orders <Veggat-Orders@veggat.com>';
export const EmailPayload = z.object({
  from: z.literal(TRANSACTIONAL_SENDER),
  to: z.array(z.string().email().max(254)).length(1),
  reply_to: z.literal('kontakt@veggat.com'),
  subject: z.string().min(1).max(200).regex(/^[^\r\n]+$/),
  text: z.string().min(1).max(60_000),
  attachments: z.array(z.object({ filename: z.string().regex(/^veggat-[a-zA-Z0-9_-]+\.txt$/), content: z.string().min(1).max(80_000) }).strict()).length(1),
}).strict();

export function emailEnvironment() {
  return process.env.VERCEL_ENV === 'production' ? 'PRODUCTION' : process.env.VERCEL_ENV === 'preview' ? 'PREVIEW' : 'LOCAL';
}

export function emailRecipientAllowed(email: string, verified: boolean, environment = emailEnvironment()): boolean {
  if (!verified || !z.string().email().max(254).safeParse(email).success || /\.(invalid|test|localhost|example)$/i.test(email)) return false;
  if (environment === 'PRODUCTION') return true;
  // Isolated preview databases can contain cloned real addresses. Never email
  // them without an explicit test-recipient allowlist. Local sending is off.
  if (environment !== 'PREVIEW') return false;
  return (process.env.TRANSACTIONAL_EMAIL_TEST_RECIPIENTS ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}

export function transactionMessage(recipient: string, subject: string, filename: string, original: string) {
  return EmailPayload.parse({ from: TRANSACTIONAL_SENDER, to: [recipient], reply_to: 'kontakt@veggat.com', subject,
    text: `${original}\nThis email is an additional copy of your purchase record. Keep the attached text file. Sign in directly at Veggat to review current order status. No password, card details or private download token is included.\n`,
    attachments: [{ filename, content: Buffer.from(original, 'utf8').toString('base64') }] });
}

export function emailStatusText(status: string | null | undefined): string {
  switch (status) {
    case 'QUEUED': case 'SENDING': return 'Email copy queued. You can download your record now.';
    case 'ACCEPTED': return 'Email copy accepted by our email provider; delivery is not yet confirmed.';
    case 'ACCEPTED_UNCONFIRMED': return 'Email copy accepted by our email provider; delivery confirmation is unavailable. Keep your downloadable copy.';
    case 'DELIVERED': return 'Email copy delivered to your mail server. Check your inbox and spam folder.';
    case 'SKIPPED': return 'No email was sent for this record. Keep the downloadable copy.';
    case 'FAILED': case 'REVIEW': return 'Email delivery needs attention. Keep the downloadable copy or contact kontakt@veggat.com.';
    default: return 'No email delivery is recorded. Keep the downloadable copy.';
  }
}
