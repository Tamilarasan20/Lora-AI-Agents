-- Phase 1 Production Ready: LoraConversation, LoraMessage, ContentRevision,
-- CompetitorWatchlistItem, and updated CreativeAsset

-- Update creative_assets with new columns
ALTER TABLE "creative_assets"
  ADD COLUMN IF NOT EXISTS "calendarItemId" UUID,
  ADD COLUMN IF NOT EXISTS "createdByAgent" VARCHAR(50) NOT NULL DEFAULT 'Steve',
  ADD COLUMN IF NOT EXISTS "title" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "storageKey" VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS "storageProvider" VARCHAR(50) NOT NULL DEFAULT 'cloudflare_r2',
  ADD COLUMN IF NOT EXISTS "mimeType" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "provider" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "model" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "brandFitScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "qualityScore" INTEGER;

-- Add status index if not exists
CREATE INDEX IF NOT EXISTS "creative_assets_status_idx" ON "creative_assets"("status");

-- CreateTable: lora_conversations
CREATE TABLE IF NOT EXISTS "lora_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "businessId" VARCHAR(255) NOT NULL,
    "title" VARCHAR(500),
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "strategyId" UUID,
    "jobId" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lora_conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lora_conversations_userId_idx" ON "lora_conversations"("userId");
CREATE INDEX IF NOT EXISTS "lora_conversations_businessId_idx" ON "lora_conversations"("businessId");

-- CreateTable: lora_messages
CREATE TABLE IF NOT EXISTS "lora_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "businessId" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "agentName" VARCHAR(50),
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lora_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lora_messages_conversationId_idx" ON "lora_messages"("conversationId");
CREATE INDEX IF NOT EXISTS "lora_messages_userId_idx" ON "lora_messages"("userId");

ALTER TABLE "lora_messages"
  ADD CONSTRAINT "lora_messages_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "lora_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: content_revisions
CREATE TABLE IF NOT EXISTS "content_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "businessId" VARCHAR(255) NOT NULL,
    "outputId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "editedBy" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "content_revisions_userId_idx" ON "content_revisions"("userId");
CREATE INDEX IF NOT EXISTS "content_revisions_outputId_idx" ON "content_revisions"("outputId");

-- CreateTable: competitor_watchlist
CREATE TABLE IF NOT EXISTS "competitor_watchlist" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "businessId" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "websiteUrl" VARCHAR(2000),
    "socialUrls" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitor_watchlist_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "competitor_watchlist_userId_idx" ON "competitor_watchlist"("userId");
CREATE INDEX IF NOT EXISTS "competitor_watchlist_businessId_idx" ON "competitor_watchlist"("businessId");
