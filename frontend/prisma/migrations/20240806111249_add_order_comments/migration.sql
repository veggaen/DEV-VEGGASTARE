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

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "commentOrder" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "commentPay" TEXT;
