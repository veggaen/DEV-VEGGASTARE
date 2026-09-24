-- Additive only. No historical orders are queued or emailed by this migration.
CREATE TABLE "TransactionalEmail" (
  "id" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "firstAttemptAt" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseUntil" TIMESTAMP(3),
  "providerId" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransactionalEmail_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TransactionalEmail_attempts_check" CHECK ("attempts" >= 0 AND "attempts" <= 6)
);
CREATE UNIQUE INDEX "TransactionalEmail_sourceKey_key" ON "TransactionalEmail"("sourceKey");
CREATE UNIQUE INDEX "TransactionalEmail_providerId_key" ON "TransactionalEmail"("providerId");
CREATE INDEX "TransactionalEmail_environment_status_nextAttemptAt_idx" ON "TransactionalEmail"("environment", "status", "nextAttemptAt");
CREATE INDEX "TransactionalEmail_orderId_userId_idx" ON "TransactionalEmail"("orderId", "userId");
