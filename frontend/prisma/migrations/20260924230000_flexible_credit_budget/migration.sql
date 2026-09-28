-- Expand the bounded custom selection, not existing quotes or entitlements.
-- Maximum order: 10,000 credits (3521.70 NOK) + the 29 NOK digital pack.
-- A separate serialized application limit caps daily exposure at 5,000 NOK.
BEGIN;
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_creditAmount_check";
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_creditAmount_check" CHECK (
  "creditAmount" IS NULL OR (
    "productId" = 'cveggatinterviewcredits01' AND "quantity" = 1
    AND ("creditAmount" = 10 OR "creditAmount" BETWEEN 100 AND 10000)
  )
);
ALTER TABLE "CheckoutAttempt" DROP CONSTRAINT "CheckoutAttempt_totalOre_check";
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_totalOre_check"
  CHECK ("totalOre" > 0 AND "totalOre" <= 355070);
COMMIT;
