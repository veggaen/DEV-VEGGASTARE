-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "uniqueViewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ConversationView" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 1,
    "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationView_conversationId_idx" ON "ConversationView"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationView_userId_idx" ON "ConversationView"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationView_conversationId_userId_key" ON "ConversationView"("conversationId", "userId");

-- AddForeignKey
ALTER TABLE "ConversationView" ADD CONSTRAINT "ConversationView_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationView" ADD CONSTRAINT "ConversationView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
