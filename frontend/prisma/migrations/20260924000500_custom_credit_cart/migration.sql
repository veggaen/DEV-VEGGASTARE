-- Additive: existing carts and immutable checkout quotes retain their meaning.
ALTER TABLE "CartItem" ADD COLUMN "creditAmount" INTEGER;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_creditAmount_check" CHECK (
  "creditAmount" IS NULL OR (
    "productId" = 'cveggatinterviewcredits01' AND "quantity" = 1
    AND "creditAmount" BETWEEN 100 AND 1000
  )
);
