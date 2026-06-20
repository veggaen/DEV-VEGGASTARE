-- Allow each accepted crypto token on a listing to route to a specific payout destination.
ALTER TABLE "ProductAcceptedToken" ADD COLUMN "receiverWalletId" TEXT;
ALTER TABLE "ProductAcceptedToken" ADD COLUMN "receiverAddress" TEXT;

CREATE INDEX "ProductAcceptedToken_receiverWalletId_idx" ON "ProductAcceptedToken"("receiverWalletId");

ALTER TABLE "ProductAcceptedToken"
  ADD CONSTRAINT "ProductAcceptedToken_receiverWalletId_fkey"
  FOREIGN KEY ("receiverWalletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
