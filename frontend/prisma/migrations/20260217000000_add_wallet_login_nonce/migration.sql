-- Wallet sign-in (SIWE) nonce table for LOGGED-OUT wallet authentication.
CREATE TABLE IF NOT EXISTS "WalletLoginNonce" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletLoginNonce_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WalletLoginNonce_address_idx" ON "WalletLoginNonce"("address");
CREATE INDEX IF NOT EXISTS "WalletLoginNonce_expires_idx" ON "WalletLoginNonce"("expires");
