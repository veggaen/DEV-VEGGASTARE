-- AlterTable: Add warehouse claim fields to Order
ALTER TABLE "Order" ADD COLUMN "claimedByUserId" TEXT;
ALTER TABLE "Order" ADD COLUMN "claimedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_claimedByUserId_idx" ON "Order"("claimedByUserId");
