/** @fileOverview Buyer request records are not payment refunds or eligibility decisions. @stability experimental */
import { z } from 'zod';

export const RETURN_REASONS = {
  CHANGED_MIND: 'Withdrawal from the purchase',
  DEFECTIVE: 'The content does not work',
  WRONG_ITEM: 'I received the wrong item',
  NOT_AS_DESCRIBED: 'The item is not as described',
  LATE_DELIVERY: 'My purchase has not arrived',
  OTHER: 'Another purchase problem',
} as const;

export const CreateReturnSchema = z.object({
  orderId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  reason: z.enum(['CHANGED_MIND', 'DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'LATE_DELIVERY', 'OTHER']),
  description: z.string().trim().max(2000).optional(),
}).strict();

export const BuyerRequestSchema = CreateReturnSchema.extend({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  description: z.string().max(2000).nullable(), sellerNote: z.string().max(2000).nullable(),
  status: z.string().min(1).max(40), createdAt: z.string().datetime(),
  emailStatus: z.string().max(40).nullable().optional(),
}).strip();
export type BuyerRequest = z.infer<typeof BuyerRequestSchema>;

/** Original submitted notice only: deliberately excludes mutable review state,
 * seller notes, bank details, current product titles and private download links. */
export function returnAcknowledgment(record: {
  id: string; orderId: string; userId: string; reason: keyof typeof RETURN_REASONS;
  description: string | null; createdAt: Date;
}, emailCopy = false) {
  return `VEGGAT — PURCHASE REQUEST RECEIVED

Request reference: ${record.id}
Order: ${record.orderId}
Purchasing account: ${record.userId}
Received at (UTC): ${record.createdAt.toISOString()}
Request: ${RETURN_REASONS[record.reason]}
${record.reason === 'CHANGED_MIND' ? 'Notice: I withdraw from this purchase.\n' : ''}
Your message:
${record.description || '(No additional message provided.)'}

This acknowledges receipt of your notice, not a decision about eligibility and not confirmation that money has been returned. Approval in Veggat alone does not transfer money. A refund is shown on your order only after payment-provider verification.
A download or prior use alone does not automatically reject your request. Mandatory consumer rights and payment-provider disputes remain reviewable. A verified refund revokes future access, but cannot erase a file already saved.
Keep this original acknowledgment. Review updates appear on your order receipt and do not alter this copy. ${emailCopy ? 'The original acknowledgment is also available on your receipt.' : 'This copy is provided for download, not sent by email.'}
Contact: kontakt@veggat.com. Quote the order and request references; never send card details or passwords.
`;
}
