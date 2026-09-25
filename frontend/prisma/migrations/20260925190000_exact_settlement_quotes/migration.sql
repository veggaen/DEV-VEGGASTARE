-- Additive money fields. Never reprice or relabel an existing NOK purchase.
BEGIN;
ALTER TABLE "CartItem" ADD COLUMN "creditSpendMinor" INTEGER;
ALTER TABLE "CartItem" ADD COLUMN "creditSpendCurrency" TEXT;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_credit_spend_check" CHECK ((
  ("creditSpendMinor" IS NULL AND "creditSpendCurrency" IS NULL) OR
  ("creditSpendMinor" IS NOT NULL AND "creditSpendCurrency" IS NOT NULL
    AND "creditSpendMinor" BETWEEN 1 AND 100000000
    AND "creditSpendCurrency" IN ('NOK','USD','EUR','GBP','SEK','DKK')
    AND "productId" = 'cveggatinterviewcredits01' AND "quantity" = 1
    AND "creditAmount" BETWEEN 100 AND 10000)
) IS TRUE);

ALTER TABLE "CheckoutAttempt" ADD COLUMN "totalMinor" INTEGER;
ALTER TABLE "CheckoutAttempt" ADD COLUMN "refundedMinor" INTEGER;
ALTER TABLE "CheckoutAttempt" ADD COLUMN "settlementQuoteId" TEXT;
ALTER TABLE "CheckoutAttempt" ADD COLUMN "cartFingerprint" TEXT;
CREATE UNIQUE INDEX "CheckoutAttempt_settlementQuoteId_key" ON "CheckoutAttempt"("settlementQuoteId");

ALTER TABLE "CheckoutAttempt" DROP CONSTRAINT "CheckoutAttempt_currency_check";
ALTER TABLE "CheckoutAttempt" DROP CONSTRAINT "CheckoutAttempt_totalOre_check";
ALTER TABLE "CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_settlement_money_check" CHECK ((
  ("settlementQuoteId" IS NULL AND "totalMinor" IS NULL AND "refundedMinor" IS NULL
    AND "cartFingerprint" IS NULL AND "currency" = 'NOK'
    AND "totalOre" > 0 AND "totalOre" <= 355070
    AND NOT ("quote" ? 'settlement')) OR
  ("settlementQuoteId" IS NOT NULL AND "totalMinor" IS NOT NULL AND "refundedMinor" IS NOT NULL
    AND "settlementQuoteId" ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' AND "requestKey" = "settlementQuoteId"
    AND "cartFingerprint" ~ '^[a-f0-9]{64}$'
    AND "currency" IN ('NOK','USD','EUR','GBP','SEK','DKK')
    AND "totalMinor" > 0 AND "totalMinor" <= 100000000
    AND "refundedMinor" >= 0 AND "refundedMinor" <= "totalMinor"
    AND "refundedOre" = 0
    AND "totalOre" > 0 AND "totalOre" <= 500000
    AND "quote"->'settlement'->>'version' = '2026-09-exact-v1'
    AND "quote"->'settlement'->>'currency' = "currency"
    AND "quote"->'settlement'->'totalMinor' = to_jsonb("totalMinor")
    AND "quote"->'settlement'->'exposureNokOre' = to_jsonb("totalOre"))
) IS TRUE);

-- The acceptance record is immutable once inserted, including after expiry,
-- cancellation or refund. Old v1 records cannot be upgraded into new currency.
CREATE FUNCTION "preserve_exact_settlement_quote"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."settlementQuoteId" IS DISTINCT FROM NEW."settlementQuoteId" OR
    (OLD."settlementQuoteId" IS NOT NULL AND (
      ROW(OLD."orderId", OLD."userId", OLD."requestKey", OLD."environment", OLD."totalOre", OLD."totalMinor",
        OLD."currency", OLD."quote", OLD."cartFingerprint", OLD."createdAt", OLD."createRequestId", OLD."captureRequestId")
      IS DISTINCT FROM
      ROW(NEW."orderId", NEW."userId", NEW."requestKey", NEW."environment", NEW."totalOre", NEW."totalMinor",
        NEW."currency", NEW."quote", NEW."cartFingerprint", NEW."createdAt", NEW."createRequestId", NEW."captureRequestId")
      OR (OLD."paypalOrderId" IS NOT NULL AND OLD."paypalOrderId" IS DISTINCT FROM NEW."paypalOrderId")
      OR (OLD."merchantId" IS NOT NULL AND OLD."merchantId" IS DISTINCT FROM NEW."merchantId")
      OR (OLD."captureId" IS NOT NULL AND OLD."captureId" IS DISTINCT FROM NEW."captureId")
    )) THEN
    RAISE EXCEPTION 'Immutable settlement quote' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CheckoutAttempt_preserve_settlement" BEFORE UPDATE ON "CheckoutAttempt"
FOR EACH ROW EXECUTE FUNCTION "preserve_exact_settlement_quote"();
COMMIT;
