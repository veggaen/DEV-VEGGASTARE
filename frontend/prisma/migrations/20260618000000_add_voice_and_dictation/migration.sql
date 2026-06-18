-- Voice channels + dictation + voice-learning loop.
-- See docs/VOICE_AND_DICTATION_DESIGN.md. The AiMemberRole enum + AiConvParticipant.role
-- column are created by the preceding 20260617000000_add_ai_member_role migration and are
-- intentionally NOT repeated here.

-- CreateEnum
CREATE TYPE "VoiceRoleDB" AS ENUM ('HOST', 'MODERATOR', 'SPEAKER', 'LISTENER');

-- CreateEnum
CREATE TYPE "DictationSource" AS ENUM ('COMPOSER', 'ROOM');

-- CreateEnum
CREATE TYPE "CorrectionKind" AS ENUM ('TYPO', 'MISHEARD', 'INTENTIONAL_REPHRASE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "VoiceChannel" (
    "id" TEXT NOT NULL,
    "roomKey" TEXT NOT NULL,
    "conversationId" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isPersonal" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "maxSpeakers" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceChannelMember" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "VoiceRoleDB" NOT NULL DEFAULT 'LISTENER',
    "mutedByHost" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceChannelMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceSession" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "recordingAssetId" TEXT,
    "transcriptJson" JSONB,
    "participantsJson" JSONB,

    CONSTRAINT "VoiceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DictationProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "customVocabulary" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "replacements" JSONB NOT NULL DEFAULT '{}',
    "captureConsent" BOOLEAN NOT NULL DEFAULT false,
    "utteranceCount" INTEGER NOT NULL DEFAULT 0,
    "correctionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DictationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DictationUtterance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "DictationSource" NOT NULL DEFAULT 'COMPOSER',
    "rawTranscript" TEXT NOT NULL,
    "finalText" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "wordsJson" JSONB,
    "audioAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DictationUtterance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DictationCorrection" (
    "id" TEXT NOT NULL,
    "utteranceId" TEXT NOT NULL,
    "originalWord" TEXT NOT NULL,
    "correctedWord" TEXT NOT NULL,
    "wordIndex" INTEGER NOT NULL,
    "kind" "CorrectionKind" NOT NULL DEFAULT 'UNKNOWN',
    "userConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "reSaidAudioAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DictationCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceChannel_roomKey_key" ON "VoiceChannel"("roomKey");

-- CreateIndex
CREATE INDEX "VoiceChannel_conversationId_idx" ON "VoiceChannel"("conversationId");

-- CreateIndex
CREATE INDEX "VoiceChannel_ownerUserId_idx" ON "VoiceChannel"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceChannel_ownerUserId_slug_key" ON "VoiceChannel"("ownerUserId", "slug");

-- CreateIndex
CREATE INDEX "VoiceChannelMember_channelId_idx" ON "VoiceChannelMember"("channelId");

-- CreateIndex
CREATE INDEX "VoiceChannelMember_userId_idx" ON "VoiceChannelMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceChannelMember_channelId_userId_key" ON "VoiceChannelMember"("channelId", "userId");

-- CreateIndex
CREATE INDEX "VoiceSession_channelId_startedAt_idx" ON "VoiceSession"("channelId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DictationProfile_userId_key" ON "DictationProfile"("userId");

-- CreateIndex
CREATE INDEX "DictationUtterance_userId_createdAt_idx" ON "DictationUtterance"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DictationCorrection_utteranceId_idx" ON "DictationCorrection"("utteranceId");

-- AddForeignKey
ALTER TABLE "VoiceChannel" ADD CONSTRAINT "VoiceChannel_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceChannelMember" ADD CONSTRAINT "VoiceChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "VoiceChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceChannelMember" ADD CONSTRAINT "VoiceChannelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceSession" ADD CONSTRAINT "VoiceSession_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "VoiceChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DictationProfile" ADD CONSTRAINT "DictationProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DictationUtterance" ADD CONSTRAINT "DictationUtterance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DictationCorrection" ADD CONSTRAINT "DictationCorrection_utteranceId_fkey" FOREIGN KEY ("utteranceId") REFERENCES "DictationUtterance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
