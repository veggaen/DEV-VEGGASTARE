CREATE TABLE "AiChatImage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "messageId" TEXT,
  "storageKey" TEXT,
  "purgingAt" TIMESTAMP(3),
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiChatImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiChatImage_dimensions" CHECK ("width" BETWEEN 1 AND 1024 AND "height" BETWEEN 1 AND 1024)
);
CREATE INDEX "AiChatImage_ownerId_createdAt_idx" ON "AiChatImage"("ownerId", "createdAt");
CREATE INDEX "AiChatImage_createdAt_idx" ON "AiChatImage"("createdAt");
CREATE INDEX "AiChatImage_conversationId_messageId_idx" ON "AiChatImage"("conversationId", "messageId");
ALTER TABLE "AiChatImage" ADD CONSTRAINT "AiChatImage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiChatImage" ADD CONSTRAINT "AiChatImage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AiConvMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
