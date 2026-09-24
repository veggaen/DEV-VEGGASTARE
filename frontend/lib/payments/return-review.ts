/** @fileOverview Shared seller review contracts; review never moves money. @stability experimental */
import { z } from 'zod';
import { CreateReturnSchema } from './return-request';

export const REVIEW_STATUSES = {
  PENDING: 'Awaiting review', APPROVED: 'Approved for follow-up', REJECTED: 'Declined',
  CANCELLED: 'Review closed', REFUNDED: 'Legacy refund label — check payment',
  COMPLETED: 'Review completed — check payment',
} as const;
export const ReviewStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED', 'COMPLETED']);
export const ReviewQuery = z.object({
  status: z.enum(['ALL', ...ReviewStatus.options]).default('PENDING'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).optional(),
}).strict();
export const ReviewInput = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'REFUND', 'CANCEL']),
  sellerNote: z.string().trim().min(1, 'Explain your decision to the buyer.').max(2000),
  expectedUpdatedAt: z.string().datetime(),
}).strict();
export const ReviewResult = z.object({
  id: z.string(), orderId: z.string(), status: ReviewStatus,
  sellerNote: z.string().nullable(), updatedAt: z.string().datetime(),
}).strip();
export const SellerRequest = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), orderId: z.string(),
  reason: CreateReturnSchema.shape.reason, description: z.string().nullable(),
  status: ReviewStatus, sellerNote: z.string().nullable(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  order: z.object({
    total: z.number().finite(), currency: z.string().nullable(), status: z.string(),
    environment: z.string().nullable(), paymentState: z.string().nullable(),
    captureId: z.string().nullable(), refundReference: z.string().nullable(),
    items: z.array(z.object({ title: z.string(), quantity: z.number().int() })).max(20),
    itemCount: z.number().int().nonnegative(), downloadRequests: z.number().int().nonnegative(),
    agreement: z.object({ version: z.string(), recordedAt: z.string().datetime(),
      demo: z.boolean(), requests: z.array(z.string()).max(2) }).nullable(),
  }),
}).strip();
export const SellerRequestList = z.object({
  requests: z.array(SellerRequest).max(20), page: z.number().int().positive(),
  hasMore: z.boolean(), readOnly: z.boolean(),
}).strip();
export type SellerRequestRecord = z.infer<typeof SellerRequest>;
