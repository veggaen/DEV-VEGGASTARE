-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM (
    'CLICK',
    'HOVER_DEEP_READ',
    'SCROLL_DEPTH',
    'DWELL_TIME',
    'SAVE_BOOKMARK',
    'COPY_TEXT',
    'COMMENT_SHORT',
    'COMMENT_LONG',
    'COMMENT_THREAD',
    'HEARTBEAT',
    'REPULSE',
    'SHARE_EXTERNAL',
    'PRODUCT_VIEW',
    'PRODUCT_CLICK',
    'ADD_TO_CART',
    'PURCHASE',
    'PROFILE_FOLLOW',
    'RETURN_VISIT',
    'TAB_REFOCUS'
);

-- AlterTable: Company – add Reach fields
ALTER TABLE "Company"
ADD COLUMN "reachLifetime"      DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "reachMomentum"      DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "lastMomentumDecay"  TIMESTAMP(3),
ADD COLUMN "employeePulseBonus" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable: Conversation – add Reach / 7-Pillar / Echo fields
ALTER TABLE "Conversation"
ADD COLUMN "reachLifetime"        DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "reachMomentum"        DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "lastMomentumDecay"    TIMESTAMP(3),
ADD COLUMN "pillarVisibility"     DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "pillarEngagement"     DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "pillarConversion"     DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "pillarLoyalty"        DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "pillarGrowth"         DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "pillarRecall"         DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "pillarVelocity"       DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "echoInbound"          DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "echoOutbound"         DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "resonanceMultiplier"  DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN "resonanceExpiresAt"   TIMESTAMP(3);

-- AlterTable: Product – add Reach fields + view counters
ALTER TABLE "Product"
ADD COLUMN "reachLifetime"     DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "reachMomentum"     DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "lastMomentumDecay" TIMESTAMP(3),
ADD COLUMN "viewCount"         INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "uniqueViewCount"   INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pulseViewEcho"     DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable: User – add Reach fields
ALTER TABLE "User"
ADD COLUMN "reachLifetime"     DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "reachMomentum"     DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "lastMomentumDecay" TIMESTAMP(3);

-- CreateTable: EngagementEvent
CREATE TABLE "EngagementEvent" (
    "id"             TEXT NOT NULL,
    "conversationId" TEXT,
    "productId"      TEXT,
    "companyId"      TEXT,
    "userId"         TEXT,
    "ipHash"         TEXT,
    "sessionId"      TEXT,
    "eventType"      "EngagementType" NOT NULL,
    "strength"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "details"        JSONB,
    "referrer"       TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EchoEdge
CREATE TABLE "EchoEdge" (
    "id"              TEXT NOT NULL,
    "parentPulseId"   TEXT NOT NULL,
    "childPulseId"    TEXT NOT NULL,
    "depth"           INTEGER NOT NULL DEFAULT 1,
    "echoStrength"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uniqueEngagers"  INTEGER NOT NULL DEFAULT 0,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EchoEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PulseProductLink
CREATE TABLE "PulseProductLink" (
    "id"             TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "productId"      TEXT NOT NULL,
    "weight"         DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PulseProductLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DailyReachRollup
CREATE TABLE "DailyReachRollup" (
    "id"               TEXT NOT NULL,
    "conversationId"   TEXT,
    "productId"        TEXT,
    "companyId"        TEXT,
    "userId"           TEXT,
    "date"             DATE NOT NULL,
    "dVisibility"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dEngagement"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dConversion"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dLoyalty"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dGrowth"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dRecall"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dVelocity"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalViews"       INTEGER NOT NULL DEFAULT 0,
    "uniqueViewers"    INTEGER NOT NULL DEFAULT 0,
    "totalEngagements" INTEGER NOT NULL DEFAULT 0,
    "uniqueEngagers"   INTEGER NOT NULL DEFAULT 0,
    "echoIn"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "echoOut"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "addedLifetime"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "addedMomentum"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "breadthRatio"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyReachRollup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: EngagementEvent indexes
CREATE INDEX "EngagementEvent_conversationId_createdAt_idx" ON "EngagementEvent"("conversationId", "createdAt");
CREATE INDEX "EngagementEvent_productId_createdAt_idx"      ON "EngagementEvent"("productId", "createdAt");
CREATE INDEX "EngagementEvent_userId_createdAt_idx"         ON "EngagementEvent"("userId", "createdAt");
CREATE INDEX "EngagementEvent_eventType_idx"                ON "EngagementEvent"("eventType");
CREATE INDEX "EngagementEvent_sessionId_idx"                ON "EngagementEvent"("sessionId");

-- CreateIndex: EchoEdge indexes + unique
CREATE UNIQUE INDEX "EchoEdge_parentPulseId_childPulseId_key" ON "EchoEdge"("parentPulseId", "childPulseId");
CREATE INDEX "EchoEdge_parentPulseId_idx"                     ON "EchoEdge"("parentPulseId");
CREATE INDEX "EchoEdge_childPulseId_idx"                      ON "EchoEdge"("childPulseId");

-- CreateIndex: PulseProductLink indexes + unique
CREATE UNIQUE INDEX "PulseProductLink_conversationId_productId_key" ON "PulseProductLink"("conversationId", "productId");
CREATE INDEX "PulseProductLink_conversationId_idx"                  ON "PulseProductLink"("conversationId");
CREATE INDEX "PulseProductLink_productId_idx"                       ON "PulseProductLink"("productId");

-- CreateIndex: DailyReachRollup indexes + uniques
CREATE UNIQUE INDEX "DailyReachRollup_conversationId_date_key" ON "DailyReachRollup"("conversationId", "date");
CREATE UNIQUE INDEX "DailyReachRollup_productId_date_key"      ON "DailyReachRollup"("productId", "date");
CREATE UNIQUE INDEX "DailyReachRollup_companyId_date_key"      ON "DailyReachRollup"("companyId", "date");
CREATE UNIQUE INDEX "DailyReachRollup_userId_date_key"         ON "DailyReachRollup"("userId", "date");
CREATE INDEX "DailyReachRollup_date_idx"                       ON "DailyReachRollup"("date");
CREATE INDEX "DailyReachRollup_conversationId_idx"             ON "DailyReachRollup"("conversationId");
CREATE INDEX "DailyReachRollup_userId_idx"                     ON "DailyReachRollup"("userId");

-- CreateIndex: Product.reachMomentum index
CREATE INDEX "Product_reachMomentum_idx" ON "Product"("reachMomentum");

-- AddForeignKey: PulseProductLink -> Conversation
ALTER TABLE "PulseProductLink" ADD CONSTRAINT "PulseProductLink_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: PulseProductLink -> Product
ALTER TABLE "PulseProductLink" ADD CONSTRAINT "PulseProductLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
