-- Nullable evidence fields only. Do not infer delivery for historical mail.
ALTER TABLE "TransactionalEmail"
  ADD COLUMN "deliveryEventAt" TIMESTAMP(3),
  ADD COLUMN "deliveryEventType" TEXT,
  ADD COLUMN "deliveryEventId" TEXT;
