-- CreateEnum ReviewStatus
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterEnum AiProvider: add GROQ
ALTER TYPE "AiProvider" ADD VALUE 'GROQ';

-- AlterTable UserAiApiKey: add useKeyForResearch
ALTER TABLE "UserAiApiKey" ADD COLUMN "useKeyForResearch" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable AdvancedPoll: add review fields
ALTER TABLE "AdvancedPoll" ADD COLUMN "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "AdvancedPoll" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "AdvancedPoll" ADD COLUMN "reviewedBy" TEXT;

-- CreateTable DailyAiUsage
CREATE TABLE "DailyAiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyAiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable SearchUsage
CREATE TABLE "SearchUsage" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "braveCount" INTEGER NOT NULL DEFAULT 0,
    "ddgCount" INTEGER NOT NULL DEFAULT 0,
    "limitReached" BOOLEAN NOT NULL DEFAULT false,
    "limitReachedAt" TIMESTAMP(3),
    "ownerNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable ScheduledPoll
CREATE TABLE "ScheduledPoll" (
    "id" TEXT NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "promptTemplate" TEXT NOT NULL,
    "targetFeedId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoPublish" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledPoll_pkey" PRIMARY KEY ("id")
);

-- CreateIndex DailyAiUsage
CREATE UNIQUE INDEX "DailyAiUsage_userId_date_key" ON "DailyAiUsage"("userId", "date");
CREATE INDEX "DailyAiUsage_userId_idx" ON "DailyAiUsage"("userId");

-- CreateIndex SearchUsage
CREATE UNIQUE INDEX "SearchUsage_month_key" ON "SearchUsage"("month");

-- CreateIndex ScheduledPoll
CREATE INDEX "ScheduledPoll_isActive_idx" ON "ScheduledPoll"("isActive");
CREATE INDEX "ScheduledPoll_nextRunAt_idx" ON "ScheduledPoll"("nextRunAt");
CREATE INDEX "ScheduledPoll_createdBy_idx" ON "ScheduledPoll"("createdBy");

-- CreateIndex AdvancedPoll reviewStatus
CREATE INDEX "AdvancedPoll_reviewStatus_idx" ON "AdvancedPoll"("reviewStatus");

-- AddForeignKey DailyAiUsage → User
ALTER TABLE "DailyAiUsage" ADD CONSTRAINT "DailyAiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey ScheduledPoll → User
ALTER TABLE "ScheduledPoll" ADD CONSTRAINT "ScheduledPoll_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
