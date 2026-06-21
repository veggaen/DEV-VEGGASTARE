-- Add first-class product marketplace visibility.
CREATE TYPE "ProductVisibility" AS ENUM ('PUBLIC', 'HIDDEN', 'ARCHIVED');

ALTER TABLE "Product"
  ADD COLUMN "visibility" "ProductVisibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN "hiddenAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Product_visibility_idx" ON "Product"("visibility");
