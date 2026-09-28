-- The original fixed 100-credit SKU capped every order at 68 NOK. Custom
-- credits retain a bounded database ceiling: 1,000 credits (362.70 NOK)
-- plus the separate digital product (29 NOK). Daily aggregate caps remain
-- serialized in the application. No existing order or grant is changed.
ALTER TABLE "CheckoutAttempt" DROP CONSTRAINT "CheckoutAttempt_totalOre_check";
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_totalOre_check"
  CHECK ("totalOre" > 0 AND "totalOre" <= 39170);
