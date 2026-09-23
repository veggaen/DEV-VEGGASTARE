-- Additive only. Existing SearchUsage/useKeyForResearch database drift is NOT removed.
ALTER TABLE "Order" ADD COLUMN "currency" TEXT;

CREATE TABLE "CheckoutAttempt" (
  "orderId" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "environment" TEXT NOT NULL CHECK ("environment" IN ('LIVE','SANDBOX','DEMO')),
  "totalOre" INTEGER NOT NULL CHECK ("totalOre" > 0 AND "totalOre" <= 6800),
  "currency" TEXT NOT NULL DEFAULT 'NOK' CHECK ("currency" = 'NOK'),
  "quote" JSONB NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'PREPARED' CHECK ("state" IN ('PREPARED','APPROVAL_PENDING','COMPLETED','REFUNDED')),
  "paypalOrderId" TEXT,
  "merchantId" TEXT,
  "approvalUrl" TEXT,
  "captureId" TEXT,
  "createRequestId" TEXT NOT NULL,
  "captureRequestId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "CheckoutAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CheckoutAttempt_completion_proof" CHECK ("state" NOT IN ('COMPLETED','REFUNDED') OR "environment" = 'DEMO' OR ("captureId" IS NOT NULL AND "paypalOrderId" IS NOT NULL AND "merchantId" IS NOT NULL))
);
CREATE UNIQUE INDEX "CheckoutAttempt_paypalOrderId_key" ON "CheckoutAttempt"("paypalOrderId");
CREATE UNIQUE INDEX "CheckoutAttempt_captureId_key" ON "CheckoutAttempt"("captureId");
CREATE UNIQUE INDEX "CheckoutAttempt_createRequestId_key" ON "CheckoutAttempt"("createRequestId");
CREATE UNIQUE INDEX "CheckoutAttempt_captureRequestId_key" ON "CheckoutAttempt"("captureRequestId");
CREATE UNIQUE INDEX "CheckoutAttempt_userId_requestKey_key" ON "CheckoutAttempt"("userId","requestKey");
CREATE INDEX "CheckoutAttempt_userId_createdAt_idx" ON "CheckoutAttempt"("userId","createdAt");

CREATE TABLE "DigitalProductFile" (
  "productId" TEXT NOT NULL,
  "digitalAssetId" TEXT NOT NULL,
  CONSTRAINT "DigitalProductFile_pkey" PRIMARY KEY ("productId","digitalAssetId"),
  CONSTRAINT "DigitalProductFile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DigitalProductFile_digitalAssetId_fkey" FOREIGN KEY ("digitalAssetId") REFERENCES "DigitalAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "DigitalProductFile_digitalAssetId_idx" ON "DigitalProductFile"("digitalAssetId");

CREATE TABLE "AiCreditAccount" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "environment" TEXT NOT NULL CHECK ("environment" IN ('LIVE','SANDBOX','DEMO')),
  "balance" INTEGER NOT NULL DEFAULT 0 CHECK ("balance" >= 0),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiCreditAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AiCreditAccount_userId_environment_key" ON "AiCreditAccount"("userId","environment");
CREATE TABLE "AiCreditEntry" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "delta" INTEGER NOT NULL CHECK ("delta" <> 0),
  "kind" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiCreditEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AiCreditAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AiCreditEntry_sourceKey_key" ON "AiCreditEntry"("sourceKey");
CREATE INDEX "AiCreditEntry_accountId_createdAt_idx" ON "AiCreditEntry"("accountId","createdAt");
