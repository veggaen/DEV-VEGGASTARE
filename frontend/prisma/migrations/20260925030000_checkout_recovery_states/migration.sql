-- Add recovery states without relaxing proof requirements for fulfilled orders.
BEGIN;
ALTER TABLE "CheckoutAttempt" DROP CONSTRAINT "CheckoutAttempt_state_check";
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_state_check"
  CHECK ("state" IN ('PREPARED','APPROVAL_PENDING','CAPTURE_PENDING','CANCEL_PENDING','CANCELLED','COMPLETED','REFUNDED','REVERSED','PAYMENT_REVIEW'));
ALTER TABLE "CheckoutAttempt" DROP CONSTRAINT "CheckoutAttempt_completion_proof";
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_completion_proof"
  CHECK ("state" IN ('PREPARED','APPROVAL_PENDING','CAPTURE_PENDING','CANCEL_PENDING','CANCELLED') OR "environment" = 'DEMO' OR
    ("captureId" IS NOT NULL AND "paypalOrderId" IS NOT NULL AND "merchantId" IS NOT NULL));
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_cancellation_unpaid"
  CHECK ("state" NOT IN ('CANCEL_PENDING','CANCELLED') OR "captureId" IS NULL);
COMMIT;
