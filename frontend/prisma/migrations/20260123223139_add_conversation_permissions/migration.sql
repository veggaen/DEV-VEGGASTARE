/*
  Warnings:

  - A unique constraint covering the columns `[productId,family,symbol]` on the table `ProductAcceptedToken` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('PUBLIC_THREAD', 'PRIVATE_DM', 'GROUP', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "ConversationVisibility" AS ENUM ('PUBLIC', 'PARTICIPANTS', 'ROLE_BASED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReplyPermission" AS ENUM ('EVERYONE', 'PARTICIPANTS', 'MENTIONED', 'MODS_ONLY', 'CREATOR_ONLY');

-- AlterTable
ALTER TABLE "CartItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "allowedRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "customViewers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "replyPermission" "ReplyPermission" NOT NULL DEFAULT 'PARTICIPANTS',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "type" "ConversationType" NOT NULL DEFAULT 'PRIVATE_DM',
ADD COLUMN     "visibility" "ConversationVisibility" NOT NULL DEFAULT 'PARTICIPANTS';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "MonthlyReport" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Package" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Review" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShippingDetails" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SpecificationsDetails" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "ProductAcceptedToken_productId_family_symbol_key" ON "ProductAcceptedToken"("productId", "family", "symbol");
