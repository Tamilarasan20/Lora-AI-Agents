-- Phase 1: Lora AI Marketing Team models

CREATE TABLE IF NOT EXISTS "marketing_strategies" (
  "id"                  UUID          NOT NULL DEFAULT gen_random_uuid(),
  "userId"              UUID          NOT NULL,
  "businessId"          VARCHAR(255)  NOT NULL,
  "title"               VARCHAR(500)  NOT NULL,
  "goal"                TEXT          NOT NULL,
  "goalType"            VARCHAR(100)  NOT NULL,
  "summary"             TEXT,
  "targetAudience"      TEXT,
  "brandVoiceDirection" TEXT,
  "positioning"         TEXT,
  "channels"            JSONB         NOT NULL DEFAULT '[]',
  "contentPillars"      JSONB         NOT NULL DEFAULT '[]',
  "campaignIdeas"       JSONB         NOT NULL DEFAULT '[]',
  "executionPlan"       JSONB         NOT NULL DEFAULT '[]',
  "teamAssignments"     JSONB         NOT NULL DEFAULT '[]',
  "recommendedChannels" JSONB         NOT NULL DEFAULT '[]',
  "risks"               JSONB         NOT NULL DEFAULT '[]',
  "nextBestActions"     JSONB         NOT NULL DEFAULT '[]',
  "status"              VARCHAR(50)   NOT NULL DEFAULT 'draft',
  "priority"            VARCHAR(50)   NOT NULL DEFAULT 'medium',
  "startDate"           TIMESTAMP(3),
  "endDate"             TIMESTAMP(3),
  "createdByAgent"      VARCHAR(50)   NOT NULL DEFAULT 'Lora',
  "creditsUsed"         INTEGER       NOT NULL DEFAULT 0,
  "createdAt"           TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "marketing_strategies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "marketing_strategies_userId_idx" ON "marketing_strategies"("userId");
CREATE INDEX IF NOT EXISTS "marketing_strategies_status_idx" ON "marketing_strategies"("status");
ALTER TABLE "marketing_strategies" ADD CONSTRAINT "marketing_strategies_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "marketing_campaigns" (
  "id"          UUID          NOT NULL DEFAULT gen_random_uuid(),
  "userId"      UUID          NOT NULL,
  "businessId"  VARCHAR(255)  NOT NULL,
  "strategyId"  UUID,
  "name"        VARCHAR(500)  NOT NULL,
  "objective"   TEXT          NOT NULL,
  "description" TEXT,
  "channels"    JSONB         NOT NULL DEFAULT '[]',
  "status"      VARCHAR(50)   NOT NULL DEFAULT 'draft',
  "budget"      DOUBLE PRECISION,
  "startDate"   TIMESTAMP(3),
  "endDate"     TIMESTAMP(3),
  "kpis"        JSONB         NOT NULL DEFAULT '[]',
  "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "marketing_campaigns_userId_idx" ON "marketing_campaigns"("userId");
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_strategyId_fkey"
  FOREIGN KEY ("strategyId") REFERENCES "marketing_strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "marketing_tasks" (
  "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
  "userId"         UUID          NOT NULL,
  "businessId"     VARCHAR(255)  NOT NULL,
  "strategyId"     UUID,
  "campaignId"     UUID,
  "title"          VARCHAR(500)  NOT NULL,
  "description"    TEXT          NOT NULL,
  "assignedAgent"  VARCHAR(50)   NOT NULL,
  "priority"       VARCHAR(50)   NOT NULL DEFAULT 'medium',
  "status"         VARCHAR(50)   NOT NULL DEFAULT 'pending',
  "dueDate"        TIMESTAMP(3),
  "dependencies"   JSONB         NOT NULL DEFAULT '[]',
  "requiredInputs" JSONB         NOT NULL DEFAULT '{}',
  "expectedOutput" TEXT,
  "outputId"       UUID,
  "reviewStatus"   VARCHAR(50)   NOT NULL DEFAULT 'not_reviewed',
  "reviewedBy"     VARCHAR(50),
  "reviewNotes"    TEXT,
  "createdAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "marketing_tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "marketing_tasks_userId_idx" ON "marketing_tasks"("userId");
CREATE INDEX IF NOT EXISTS "marketing_tasks_assignedAgent_idx" ON "marketing_tasks"("assignedAgent");
CREATE INDEX IF NOT EXISTS "marketing_tasks_status_idx" ON "marketing_tasks"("status");
ALTER TABLE "marketing_tasks" ADD CONSTRAINT "marketing_tasks_strategyId_fkey"
  FOREIGN KEY ("strategyId") REFERENCES "marketing_strategies"("id") ON DELETE SET NULL;
ALTER TABLE "marketing_tasks" ADD CONSTRAINT "marketing_tasks_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "marketing_campaigns"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "agent_assignments" (
  "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
  "userId"           UUID          NOT NULL,
  "businessId"       VARCHAR(255)  NOT NULL,
  "taskId"           UUID          NOT NULL,
  "agentName"        VARCHAR(50)   NOT NULL,
  "agentRole"        VARCHAR(100)  NOT NULL,
  "assignmentReason" TEXT,
  "status"           VARCHAR(50)   NOT NULL DEFAULT 'assigned',
  "startedAt"        TIMESTAMP(3),
  "completedAt"      TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "agent_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "agent_assignments_userId_idx" ON "agent_assignments"("userId");
CREATE INDEX IF NOT EXISTS "agent_assignments_agentName_idx" ON "agent_assignments"("agentName");
ALTER TABLE "agent_assignments" ADD CONSTRAINT "agent_assignments_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "marketing_tasks"("id") ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS "agent_outputs" (
  "id"                 UUID          NOT NULL DEFAULT gen_random_uuid(),
  "userId"             UUID          NOT NULL,
  "businessId"         VARCHAR(255)  NOT NULL,
  "taskId"             UUID          NOT NULL,
  "agentName"          VARCHAR(50)   NOT NULL,
  "outputType"         VARCHAR(100)  NOT NULL,
  "content"            JSONB         NOT NULL,
  "metadata"           JSONB         NOT NULL DEFAULT '{}',
  "status"             VARCHAR(50)   NOT NULL DEFAULT 'draft',
  "qualityScore"       INTEGER,
  "brandFitScore"      INTEGER,
  "goalAlignmentScore" INTEGER,
  "reviewedByLora"     BOOLEAN       NOT NULL DEFAULT FALSE,
  "reviewNotes"        TEXT,
  "createdAt"          TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "agent_outputs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "agent_outputs_userId_idx" ON "agent_outputs"("userId");
CREATE INDEX IF NOT EXISTS "agent_outputs_agentName_idx" ON "agent_outputs"("agentName");
ALTER TABLE "agent_outputs" ADD CONSTRAINT "agent_outputs_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "marketing_tasks"("id") ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS "marketing_calendar_items" (
  "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
  "userId"         UUID          NOT NULL,
  "businessId"     VARCHAR(255)  NOT NULL,
  "campaignId"     UUID,
  "taskId"         UUID,
  "title"          VARCHAR(500)  NOT NULL,
  "description"    TEXT,
  "platform"       VARCHAR(100)  NOT NULL,
  "contentType"    VARCHAR(100)  NOT NULL,
  "scheduledAt"    TIMESTAMP(3),
  "publishStatus"  VARCHAR(50)   NOT NULL DEFAULT 'draft',
  "assetIds"       JSONB         NOT NULL DEFAULT '[]',
  "assignedAgent"  VARCHAR(50),
  "approvalStatus" VARCHAR(50)   NOT NULL DEFAULT 'pending',
  "createdAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "marketing_calendar_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "marketing_calendar_items_userId_idx" ON "marketing_calendar_items"("userId");
CREATE INDEX IF NOT EXISTS "marketing_calendar_items_scheduledAt_idx" ON "marketing_calendar_items"("scheduledAt");
ALTER TABLE "marketing_calendar_items" ADD CONSTRAINT "marketing_calendar_items_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "marketing_campaigns"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "approvals" (
  "id"          UUID          NOT NULL DEFAULT gen_random_uuid(),
  "userId"      UUID          NOT NULL,
  "businessId"  VARCHAR(255)  NOT NULL,
  "outputId"    UUID          NOT NULL,
  "type"        VARCHAR(100)  NOT NULL,
  "status"      VARCHAR(50)   NOT NULL DEFAULT 'pending',
  "requestedBy" VARCHAR(50)   NOT NULL DEFAULT 'Lora',
  "reviewedBy"  VARCHAR(100),
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "approvals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "approvals_outputId_key" UNIQUE ("outputId")
);
CREATE INDEX IF NOT EXISTS "approvals_userId_idx" ON "approvals"("userId");
CREATE INDEX IF NOT EXISTS "approvals_status_idx" ON "approvals"("status");
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_outputId_fkey"
  FOREIGN KEY ("outputId") REFERENCES "agent_outputs"("id") ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS "agent_credit_usage" (
  "id"        UUID          NOT NULL DEFAULT gen_random_uuid(),
  "userId"    UUID          NOT NULL,
  "agentName" VARCHAR(50)   NOT NULL,
  "action"    VARCHAR(100)  NOT NULL,
  "credits"   INTEGER       NOT NULL,
  "metadata"  JSONB         NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_credit_usage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "agent_credit_usage_userId_idx" ON "agent_credit_usage"("userId");
CREATE INDEX IF NOT EXISTS "agent_credit_usage_agentName_idx" ON "agent_credit_usage"("agentName");
