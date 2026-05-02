-- Pomelli-style async brand analysis with review-before-save flow

-- Enum
DO $$ BEGIN
  CREATE TYPE "BrandAnalysisJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'AWAITING_REVIEW', 'APPROVED', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Table
CREATE TABLE IF NOT EXISTS "brand_analysis_jobs" (
  "id"            UUID                     NOT NULL DEFAULT gen_random_uuid(),
  "userId"        UUID                     NOT NULL,
  "websiteUrl"    TEXT                     NOT NULL,
  "status"        "BrandAnalysisJobStatus" NOT NULL DEFAULT 'QUEUED',
  "currentStage"  VARCHAR(64),
  "progressPct"   INTEGER                  NOT NULL DEFAULT 0,
  "stages"        JSONB                    NOT NULL DEFAULT '[]',
  "draftResult"   JSONB,
  "errorMessage"  TEXT,
  "bullJobId"     TEXT,
  "createdAt"     TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)             NOT NULL,
  "startedAt"     TIMESTAMP(3),
  "completedAt"   TIMESTAMP(3),
  "approvedAt"    TIMESTAMP(3),
  "cancelledAt"   TIMESTAMP(3),

  CONSTRAINT "brand_analysis_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "brand_analysis_jobs_userId_status_idx"
  ON "brand_analysis_jobs"("userId", "status");

CREATE INDEX IF NOT EXISTS "brand_analysis_jobs_userId_createdAt_idx"
  ON "brand_analysis_jobs"("userId", "createdAt" DESC);

ALTER TABLE "brand_analysis_jobs"
  ADD CONSTRAINT "brand_analysis_jobs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
