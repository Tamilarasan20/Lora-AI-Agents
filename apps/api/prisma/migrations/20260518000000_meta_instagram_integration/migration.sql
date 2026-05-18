-- ============================================================
-- Meta Instagram Integration
-- Adds: instagram_accounts, webhook_events, token_refresh_jobs
-- ============================================================

-- ── instagram_accounts ───────────────────────────────────────
CREATE TABLE "instagram_accounts" (
    "id"                   UUID         NOT NULL DEFAULT gen_random_uuid(),
    "platformConnectionId" UUID         NOT NULL,
    "userId"               UUID         NOT NULL,
    "igAccountId"          VARCHAR(255) NOT NULL,
    "username"             VARCHAR(255) NOT NULL,
    "name"                 VARCHAR(255),
    "profilePictureUrl"    TEXT,
    "biography"            TEXT,
    "website"              TEXT,
    "followerCount"        INTEGER      NOT NULL DEFAULT 0,
    "followingCount"       INTEGER      NOT NULL DEFAULT 0,
    "mediaCount"           INTEGER      NOT NULL DEFAULT 0,
    "facebookPageId"       VARCHAR(255),
    "facebookPageName"     VARCHAR(255),
    "facebookPageToken"    TEXT,
    "isActive"             BOOLEAN      NOT NULL DEFAULT true,
    "lastSyncedAt"         TIMESTAMPTZ,
    "createdAt"            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updatedAt"            TIMESTAMPTZ  NOT NULL,

    CONSTRAINT "instagram_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "instagram_accounts_platformConnectionId_igAccountId_key"
    ON "instagram_accounts"("platformConnectionId", "igAccountId");

CREATE INDEX "instagram_accounts_userId_idx"        ON "instagram_accounts"("userId");
CREATE INDEX "instagram_accounts_igAccountId_idx"   ON "instagram_accounts"("igAccountId");
CREATE INDEX "instagram_accounts_isActive_idx"      ON "instagram_accounts"("isActive");

ALTER TABLE "instagram_accounts"
    ADD CONSTRAINT "instagram_accounts_platformConnectionId_fkey"
        FOREIGN KEY ("platformConnectionId")
        REFERENCES "platform_connections"("id")
        ON DELETE CASCADE;

ALTER TABLE "instagram_accounts"
    ADD CONSTRAINT "instagram_accounts_userId_fkey"
        FOREIGN KEY ("userId")
        REFERENCES "users"("id")
        ON DELETE CASCADE;

-- ── webhook_events ────────────────────────────────────────────
CREATE TABLE "webhook_events" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "platform"    VARCHAR(50)  NOT NULL,
    "eventType"   VARCHAR(100) NOT NULL,
    "externalId"  VARCHAR(255),
    "rawPayload"  JSONB        NOT NULL DEFAULT '{}',
    "processed"   BOOLEAN      NOT NULL DEFAULT false,
    "processedAt" TIMESTAMPTZ,
    "error"       TEXT,
    "retries"     INTEGER      NOT NULL DEFAULT 0,
    "userId"      UUID,
    "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updatedAt"   TIMESTAMPTZ  NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webhook_events_platform_idx"    ON "webhook_events"("platform");
CREATE INDEX "webhook_events_processed_idx"   ON "webhook_events"("processed");
CREATE INDEX "webhook_events_eventType_idx"   ON "webhook_events"("eventType");
CREATE INDEX "webhook_events_createdAt_idx"   ON "webhook_events"("createdAt" DESC);

-- ── token_refresh_jobs ────────────────────────────────────────
CREATE TABLE "token_refresh_jobs" (
    "id"                   UUID         NOT NULL DEFAULT gen_random_uuid(),
    "platformConnectionId" UUID         NOT NULL,
    "userId"               UUID         NOT NULL,
    "status"               VARCHAR(50)  NOT NULL DEFAULT 'PENDING',
    "attempts"             INTEGER      NOT NULL DEFAULT 0,
    "maxAttempts"          INTEGER      NOT NULL DEFAULT 3,
    "lastAttemptAt"        TIMESTAMPTZ,
    "completedAt"          TIMESTAMPTZ,
    "error"                TEXT,
    "bullJobId"            VARCHAR(255),
    "scheduledFor"         TIMESTAMPTZ  NOT NULL,
    "createdAt"            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updatedAt"            TIMESTAMPTZ  NOT NULL,

    CONSTRAINT "token_refresh_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "token_refresh_jobs_platformConnectionId_idx" ON "token_refresh_jobs"("platformConnectionId");
CREATE INDEX "token_refresh_jobs_userId_idx"               ON "token_refresh_jobs"("userId");
CREATE INDEX "token_refresh_jobs_status_idx"               ON "token_refresh_jobs"("status");
CREATE INDEX "token_refresh_jobs_scheduledFor_idx"         ON "token_refresh_jobs"("scheduledFor");

ALTER TABLE "token_refresh_jobs"
    ADD CONSTRAINT "token_refresh_jobs_platformConnectionId_fkey"
        FOREIGN KEY ("platformConnectionId")
        REFERENCES "platform_connections"("id")
        ON DELETE CASCADE;
