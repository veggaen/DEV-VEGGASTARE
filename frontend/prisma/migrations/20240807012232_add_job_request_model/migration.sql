/*
  Warnings:

  - The values [COINBASE] on the enum `PaymentMethod` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMethod_new" AS ENUM ('METAMASK', 'PAYPAL', 'COINBASEWALLET', 'VISA', 'SOLFLARE', 'PHANTOM', 'MATHWALLET', 'TRUST');
ALTER TABLE "Payment" ALTER COLUMN "method" TYPE "PaymentMethod_new" USING ("method"::text::"PaymentMethod_new");
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "PaymentMethod_old";
COMMIT;

-- CreateTable
CREATE TABLE "JobRequest" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "images" TEXT,
    "links" TEXT,
    "docs" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "negotiable" BOOLEAN NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "delivery" TEXT NOT NULL,
    "additionalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "JobRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "JobRequest" ADD CONSTRAINT "JobRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
