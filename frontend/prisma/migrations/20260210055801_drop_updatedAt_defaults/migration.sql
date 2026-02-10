-- Drop the DEFAULT CURRENT_TIMESTAMP from updatedAt columns.
-- The defaults were only needed for backfilling existing rows during the previous migration.
-- Prisma @updatedAt handles the value at the application level, not via SQL default.

ALTER TABLE "Account" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "AdminAuditLog" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "ConversationRepost" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "ConversationView" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "DailyReachRollup" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "DownloadToken" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "EmailLoginToken" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "EmployeeTermination" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "EngagementEvent" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Follow" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Friendship" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "MessagePulse" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "MessageRepost" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "NotificationMute" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "OrderItem" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PasswordResetToken" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PollAnswer" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PollAnswerImage" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PollOption" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PollQuestionOption" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PollResponse" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PollTemplate" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PollVote" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "ProductCategory" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "ProfilePin" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PulseProductLink" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "SecurityActionToken" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "TwoFactorConfirmation" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "TwoFactorToken" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "UserPresence" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "VerificationToken" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "ViewEvent" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "WalletVerificationChallenge" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "WorkHourLog" ALTER COLUMN "updatedAt" DROP DEFAULT;
