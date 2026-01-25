-- CreateEnum
CREATE TYPE "DeletionVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "deletionScheduledFor" TIMESTAMP(3),
ADD COLUMN     "deletionVisibility" "DeletionVisibility" NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN     "isAnonymized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalUserId" TEXT,
ADD COLUMN     "suspiciousActivity" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspiciousReason" TEXT;
