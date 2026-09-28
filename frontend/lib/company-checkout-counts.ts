import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import type { CompanyCheckoutCounts } from './admin-company-policy';
import { recordedCheckoutMoney, recordedCaptureProof, unadjustedPaidCapture } from './payments/checkout-reporting';

export const emptyCompanyCheckoutCounts = (): CompanyCheckoutCounts => ({ livePaid: 0, liveAdjusted: 0, liveReview: 0, sandbox: 0 });

/** Operational counts for currently linked products, not seller-at-sale revenue.
 * Capture proof comes from server-owned CheckoutAttempt, never legacy Sale or
 * Payment.status. Aggregate a bounded page in SQL; never load buyer records. */
export async function companyCheckoutCounts(tx: Prisma.TransactionClient, companyIds: string[]) {
  const ids = [...new Set(companyIds)];
  if (ids.length > 100 || ids.some(id => !id || id.length > 100)) throw new Error('Invalid company count scope');
  const result = new Map(ids.map(id => [id, emptyCompanyCheckoutCounts()]));
  if (!ids.length) return result;
  const rows = await tx.$queryRaw<({ companyId: string } & CompanyCheckoutCounts)[]>(Prisma.sql`
    WITH captures AS (
      SELECT DISTINCT p."companyId", c."orderId", c."environment",
        ${unadjustedPaidCapture} AS paid,
        (c."state" IN ('REFUNDED', 'REVERSED') AND c."paymentAdjustedAt" IS NOT NULL
          AND o."status" = 'CANCELLED') AS adjusted,
        (c."state" = 'PAYMENT_REVIEW' AND c."paymentAdjustedAt" IS NOT NULL
          AND o."status" = 'CONFIRMING') AS review
      FROM "Product" p
      JOIN "OrderItem" i ON i."productId" = p."id"
      JOIN "Order" o ON o."id" = i."orderId"
      JOIN "CheckoutAttempt" c ON c."orderId" = o."id"
      WHERE p."companyId" IN (${Prisma.join(ids)}) AND i."quantity" > 0
        AND ${recordedCheckoutMoney} AND ${recordedCaptureProof}
    )
    SELECT "companyId",
      (COUNT(*) FILTER (WHERE "environment" = 'LIVE' AND paid))::int AS "livePaid",
      (COUNT(*) FILTER (WHERE "environment" = 'LIVE' AND adjusted))::int AS "liveAdjusted",
      (COUNT(*) FILTER (WHERE "environment" = 'LIVE' AND review))::int AS "liveReview",
      (COUNT(*) FILTER (WHERE "environment" = 'SANDBOX' AND (paid OR adjusted OR review)))::int AS sandbox
    FROM captures GROUP BY "companyId"
  `);
  for (const { companyId, ...counts } of rows) {
    if (!result.has(companyId) || Object.values(counts).some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error('Invalid company count result');
    result.set(companyId, counts);
  }
  return result;
}
