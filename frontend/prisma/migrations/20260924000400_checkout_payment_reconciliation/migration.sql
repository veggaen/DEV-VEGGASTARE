ALTER TABLE "CheckoutAttempt" ADD COLUMN "refundedOre" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CheckoutAttempt" ADD COLUMN "refundReference" TEXT;
ALTER TABLE "CheckoutAttempt" ADD COLUMN "paymentAdjustedAt" TIMESTAMP(3);
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_refundedOre_check"
  CHECK ("refundedOre" >= 0 AND "refundedOre" <= "totalOre");
ALTER TABLE "CheckoutAttempt" DROP CONSTRAINT "CheckoutAttempt_state_check";
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_state_check"
  CHECK ("state" IN ('PREPARED','APPROVAL_PENDING','COMPLETED','REFUNDED','REVERSED','PAYMENT_REVIEW'));
ALTER TABLE "CheckoutAttempt" DROP CONSTRAINT "CheckoutAttempt_completion_proof";
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_completion_proof"
  CHECK ("state" IN ('PREPARED','APPROVAL_PENDING') OR "environment" = 'DEMO' OR
    ("captureId" IS NOT NULL AND "paypalOrderId" IS NOT NULL AND "merchantId" IS NOT NULL));
