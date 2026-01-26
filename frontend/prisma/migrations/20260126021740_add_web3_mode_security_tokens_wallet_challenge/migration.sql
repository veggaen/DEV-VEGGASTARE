-- CreateEnum
CREATE TYPE "SecurityActionType" AS ENUM ('WEB3_MODE_ENABLE', 'WEB3_MODE_DISABLE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "web3ModeEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SecurityActionToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "action" "SecurityActionType" NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityActionToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletVerificationChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "family" "ChainFamily" NOT NULL,
    "address" TEXT NOT NULL,
    "chainId" INTEGER,
    "solanaCluster" TEXT,
    "nonce" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletVerificationChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SecurityActionToken_token_key" ON "SecurityActionToken"("token");

-- CreateIndex
CREATE INDEX "SecurityActionToken_email_action_idx" ON "SecurityActionToken"("email", "action");

-- CreateIndex
CREATE INDEX "SecurityActionToken_userId_action_idx" ON "SecurityActionToken"("userId", "action");

-- CreateIndex
CREATE INDEX "WalletVerificationChallenge_userId_family_address_idx" ON "WalletVerificationChallenge"("userId", "family", "address");

-- CreateIndex
CREATE INDEX "WalletVerificationChallenge_expires_idx" ON "WalletVerificationChallenge"("expires");

-- AddForeignKey
ALTER TABLE "SecurityActionToken" ADD CONSTRAINT "SecurityActionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletVerificationChallenge" ADD CONSTRAINT "WalletVerificationChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
