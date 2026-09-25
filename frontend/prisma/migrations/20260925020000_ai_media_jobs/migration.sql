CREATE TABLE "AiMediaJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reservationId" TEXT NOT NULL UNIQUE REFERENCES "AiGenerationReservation"("id"),
  "userId" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('IMAGE','VIDEO')),
  "model" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'CREATING' CHECK ("state" IN ('CREATING','PROCESSING','COMPLETED','FAILED')),
  "providerId" TEXT UNIQUE,
  "storageKey" TEXT,
  "mimeType" TEXT,
  "byteSize" INTEGER,
  "actualMicroUsd" INTEGER,
  "errorCode" TEXT,
  "pollAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deadline" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AiMediaJob_userId_environment_createdAt_idx" ON "AiMediaJob"("userId","environment","createdAt");
CREATE INDEX "AiMediaJob_state_pollAfter_idx" ON "AiMediaJob"("state","pollAfter");
