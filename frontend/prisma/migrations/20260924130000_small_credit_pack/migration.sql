-- Expand only the exact small pack; existing rows, prices and receipts stay intact.
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_creditAmount_check";
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_creditAmount_check" CHECK (
  "creditAmount" IS NULL OR (
    "productId" = 'cveggatinterviewcredits01' AND "quantity" = 1
    AND ("creditAmount" = 10 OR "creditAmount" BETWEEN 100 AND 1000)
  )
);
