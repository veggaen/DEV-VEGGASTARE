/** Read-only capture predicates. SQL aliases c (attempt) and o (order) are fixed. */
import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { SettlementCurrency } from './settlement-money';

// v1 totals are NOK cash; v2 totalOre is a risk valuation, NEVER cash revenue.
// Reject partial upgrades instead of guessing which amount is authoritative.
export const recordedCheckoutMoney = Prisma.sql`(
  (c."settlementQuoteId" IS NULL AND c."totalMinor" IS NULL AND c."refundedMinor" IS NULL
    AND c."cartFingerprint" IS NULL AND c."currency" = 'NOK'
    AND c."totalOre" BETWEEN 1 AND 355070 AND c."refundedOre" BETWEEN 0 AND c."totalOre")
  OR (c."settlementQuoteId" ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    AND c."cartFingerprint" ~ '^[a-f0-9]{64}$'
    AND c."currency" IN ('NOK','USD','EUR','GBP','SEK','DKK')
    AND c."totalMinor" BETWEEN 1 AND 100000000 AND c."refundedMinor" BETWEEN 0 AND c."totalMinor"
    AND c."refundedOre" = 0 AND c."totalOre" BETWEEN 1 AND 500000)
)`;
export const recordedCaptureProof = Prisma.sql`(
  c."userId" = o."userId" AND left(c."userId", 5) <> 'demo_'
  AND c."environment" IN ('LIVE','SANDBOX')
  AND c."captureId" IS NOT NULL AND c."captureId" <> ''
  AND c."paypalOrderId" IS NOT NULL AND c."paypalOrderId" <> ''
  AND c."merchantId" IS NOT NULL AND c."merchantId" <> ''
)`;
export const recordedGrossMinor = Prisma.sql`CASE WHEN c."settlementQuoteId" IS NULL THEN c."totalOre" ELSE c."totalMinor" END`;
export const recordedRefundMinor = Prisma.sql`CASE WHEN c."settlementQuoteId" IS NULL THEN c."refundedOre" ELSE c."refundedMinor" END`;
export const unadjustedPaidCapture = Prisma.sql`(
  c."state" = 'COMPLETED' AND c."completedAt" IS NOT NULL
  AND (${recordedRefundMinor}) = 0 AND c."paymentAdjustedAt" IS NULL AND o."status" = 'COMPLETED'
)`;
export const recordedAdjustedCapture = Prisma.sql`(
  c."paymentAdjustedAt" IS NOT NULL AND (
    (c."state" IN ('REFUNDED','REVERSED') AND o."status" = 'CANCELLED')
    OR (c."state" = 'PAYMENT_REVIEW' AND o."status" = 'CONFIRMING')
  )
)`;

/** Bounded six-row aggregate, no buyer identities and no display-FX conversion. */
export async function readCapturedPaymentTotals(tx: Prisma.TransactionClient, environment: 'LIVE' | 'SANDBOX' | 'DEMO') {
  const rows = await tx.$queryRaw<{ currency: string; captures: string; grossMinor: string; refundedMinor: string }[]>(Prisma.sql`
    SELECT c."currency", COUNT(*)::text AS captures,
      SUM(${recordedGrossMinor})::text AS "grossMinor", SUM(${recordedRefundMinor})::text AS "refundedMinor"
    FROM "CheckoutAttempt" c JOIN "Order" o ON o.id = c."orderId"
    WHERE c."environment" = ${environment} AND ${recordedCheckoutMoney} AND ${recordedCaptureProof}
      AND (${unadjustedPaidCapture} OR ${recordedAdjustedCapture})
    GROUP BY c."currency" ORDER BY c."currency"
  `);
  const integer = (value: string) => {
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('Invalid captured total');
    return Number(value);
  };
  if (rows.length > 6 || new Set(rows.map(row => row.currency)).size !== rows.length) throw new Error('Invalid captured currencies');
  const currencies = rows.map(row => {
    const currency = SettlementCurrency.parse(row.currency), captures = integer(row.captures);
    const grossMinor = integer(row.grossMinor), refundedMinor = integer(row.refundedMinor);
    if (captures < 1 || grossMinor < 1 || refundedMinor > grossMinor) throw new Error('Invalid captured total');
    return { currency, captures, grossMinor, refundedMinor };
  });
  const captures = currencies.reduce((sum, row) => sum + row.captures, 0);
  if (!Number.isSafeInteger(captures)) throw new Error('Invalid capture count');
  return { captures, currencies };
}
