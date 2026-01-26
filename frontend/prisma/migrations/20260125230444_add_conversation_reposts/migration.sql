-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "repostOfConversationId" TEXT;

-- CreateTable
CREATE TABLE "ConversationRepost" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationRepost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationRepost_conversationId_idx" ON "ConversationRepost"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationRepost_userId_idx" ON "ConversationRepost"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationRepost_conversationId_userId_key" ON "ConversationRepost"("conversationId", "userId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_repostOfConversationId_fkey" FOREIGN KEY ("repostOfConversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRepost" ADD CONSTRAINT "ConversationRepost_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRepost" ADD CONSTRAINT "ConversationRepost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
