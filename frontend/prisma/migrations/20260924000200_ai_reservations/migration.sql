-- Additive: no changes to existing balances, entitlements, orders or provider keys.
CREATE TABLE "AiPlatformSpendDay" (
  "date" DATE PRIMARY KEY,
  "reservedMicroUsd" INTEGER NOT NULL DEFAULT 0 CHECK ("reservedMicroUsd" BETWEEN 0 AND 10000000),
  "requests" INTEGER NOT NULL DEFAULT 0 CHECK ("requests" BETWEEN 0 AND 500)
);
CREATE TABLE "AiGenerationReservation" (
  "id" TEXT PRIMARY KEY,
  "requestKey" TEXT NOT NULL,
  "accountId" TEXT,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "credits" INTEGER NOT NULL CHECK ("credits" BETWEEN 0 AND 100),
  "reservedMicroUsd" INTEGER NOT NULL CHECK ("reservedMicroUsd" BETWEEN 0 AND 1000000),
  "state" TEXT NOT NULL DEFAULT 'RESERVED' CHECK ("state" IN ('RESERVED','COMPLETED','REFUNDED')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settledAt" TIMESTAMP(3),
  CONSTRAINT "AiGenerationReservation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AiCreditAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AiGenerationReservation_debit_account" CHECK ("credits" = 0 OR "accountId" IS NOT NULL),
  CONSTRAINT "AiGenerationReservation_settlement" CHECK (("state" = 'RESERVED' AND "settledAt" IS NULL) OR ("state" <> 'RESERVED' AND "settledAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "AiGenerationReservation_requestKey_key" ON "AiGenerationReservation"("requestKey");
CREATE INDEX "AiGenerationReservation_accountId_state_createdAt_idx" ON "AiGenerationReservation"("accountId","state","createdAt");
