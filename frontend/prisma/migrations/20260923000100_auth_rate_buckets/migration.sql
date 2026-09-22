CREATE TABLE "AuthRateBucket" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthRateBucket_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "AuthRateBucket_expiresAt_idx" ON "AuthRateBucket"("expiresAt");
