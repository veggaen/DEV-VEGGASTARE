-- Never cascade away the only private-storage locator. Account/conversation
-- hard deletes must wait for remote image cleanup. Existing chats are untouched.
ALTER TABLE "AiChatImage" DROP CONSTRAINT "AiChatImage_conversationId_fkey";
ALTER TABLE "AiChatImage" ADD CONSTRAINT "AiChatImage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
