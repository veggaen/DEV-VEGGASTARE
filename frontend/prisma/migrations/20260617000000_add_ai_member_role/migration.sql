-- CreateEnum: Discord-style per-conversation membership role
CREATE TYPE "AiMemberRole" AS ENUM ('OWNER', 'MODERATOR', 'MEMBER');

-- AlterTable: add role to AI conversation participants (defaults to MEMBER)
ALTER TABLE "AiConvParticipant" ADD COLUMN "role" "AiMemberRole" NOT NULL DEFAULT 'MEMBER';

-- Backfill: the human participant who is the conversation creator becomes OWNER.
UPDATE "AiConvParticipant" p
SET "role" = 'OWNER'
FROM "AiConversation" c
WHERE p."conversationId" = c."id"
  AND p."type" = 'HUMAN'
  AND p."userId" = c."creatorId";
