-- True Reach engine (lib/reach) materialized fields + wallet provenance.
-- All additive with safe defaults — no data loss. IF NOT EXISTS so it's
-- idempotent against environments where columns were added out-of-band.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trueReach" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "riskScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bankidVerified" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "vippsVerified" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailRisk" TEXT;
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "riskTier" TEXT;
