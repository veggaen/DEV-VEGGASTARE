-- Additive: ordinary sessions and existing user data are unchanged.
CREATE TABLE "AccountPreviewSession" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "ownerVersion" INTEGER NOT NULL,
    "targetVersion" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "AccountPreviewSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccountPreviewSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountPreviewSession_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountPreviewSession_lifetime_check" CHECK ("expiresAt" > "startedAt" AND "expiresAt" <= "startedAt" + INTERVAL '1 hour'),
    CONSTRAINT "AccountPreviewSession_principals_check" CHECK ("ownerId" <> "targetId")
);
CREATE INDEX "AccountPreviewSession_ownerId_expiresAt_idx" ON "AccountPreviewSession"("ownerId", "expiresAt");
CREATE INDEX "AccountPreviewSession_targetId_idx" ON "AccountPreviewSession"("targetId");
CREATE INDEX "AccountPreviewSession_expiresAt_idx" ON "AccountPreviewSession"("expiresAt");
