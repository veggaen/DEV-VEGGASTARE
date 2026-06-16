-- Add per-provider OAuth profile snapshot fields to User.
-- These were previously applied to environments via `prisma db push` and existed
-- in schema.prisma without a corresponding migration. This migration captures
-- them so the migrations directory matches the schema. Already present in prod
-- (added during the baseline fix) — recorded as applied there.

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleProfileName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleProfileImage" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleProfileEmail" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "githubProfileName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "githubProfileImage" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "githubProfileEmail" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "discordProfileName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "discordProfileImage" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "discordProfileEmail" TEXT;
