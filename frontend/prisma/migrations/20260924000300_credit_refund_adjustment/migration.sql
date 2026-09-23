-- Available credits never become negative; later credit returns/purchases first
-- offset credits already used from a refunded payment. No card is charged.
ALTER TABLE "AiCreditAccount" ADD COLUMN "refundAdjustment" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiCreditAccount" ADD CONSTRAINT "AiCreditAccount_refundAdjustment_check"
  CHECK ("refundAdjustment" >= 0 AND ("balance" = 0 OR "refundAdjustment" = 0));
