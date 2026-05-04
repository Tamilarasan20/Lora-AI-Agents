-- LLM Router Production-Grade Tables

CREATE TABLE IF NOT EXISTS "llm_provider_registry" (
  "id"                TEXT        NOT NULL PRIMARY KEY,
  "name"              VARCHAR(50) NOT NULL UNIQUE,
  "displayName"       VARCHAR(100) NOT NULL,
  "isActive"          BOOLEAN     NOT NULL DEFAULT TRUE,
  "priority"          INTEGER     NOT NULL DEFAULT 100,
  "supportsText"      BOOLEAN     NOT NULL DEFAULT FALSE,
  "supportsImage"     BOOLEAN     NOT NULL DEFAULT FALSE,
  "supportsVideo"     BOOLEAN     NOT NULL DEFAULT FALSE,
  "supportsAudio"     BOOLEAN     NOT NULL DEFAULT FALSE,
  "supportsVision"    BOOLEAN     NOT NULL DEFAULT FALSE,
  "supportsSearch"    BOOLEAN     NOT NULL DEFAULT FALSE,
  "healthStatus"      VARCHAR(20) NOT NULL DEFAULT 'unknown',
  "lastHealthCheckAt" TIMESTAMPTZ,
  "healthLatencyMs"   INTEGER,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "llm_model_registry" (
  "id"               TEXT           NOT NULL PRIMARY KEY,
  "providerId"       TEXT           NOT NULL REFERENCES "llm_provider_registry"("id"),
  "modelId"          VARCHAR(200)   NOT NULL UNIQUE,
  "displayName"      VARCHAR(200)   NOT NULL,
  "modality"         VARCHAR(50)[]  NOT NULL DEFAULT '{}',
  "strengths"        VARCHAR(50)[]  NOT NULL DEFAULT '{}',
  "tier"             VARCHAR(20)    NOT NULL,
  "latencyClass"     VARCHAR(20)    NOT NULL,
  "qualityClass"     VARCHAR(20)    NOT NULL,
  "maxInputTokens"   INTEGER        NOT NULL,
  "maxOutputTokens"  INTEGER        NOT NULL,
  "inputCostPerMTok" DECIMAL(12,6)  NOT NULL DEFAULT 0,
  "outputCostPerMTok" DECIMAL(12,6) NOT NULL DEFAULT 0,
  "imageCostUnit"    DECIMAL(12,6),
  "videoCostUnit"    DECIMAL(12,6),
  "supportsJson"     BOOLEAN        NOT NULL DEFAULT FALSE,
  "supportsTools"    BOOLEAN        NOT NULL DEFAULT FALSE,
  "supportsVision"   BOOLEAN        NOT NULL DEFAULT FALSE,
  "supportsStreaming" BOOLEAN       NOT NULL DEFAULT FALSE,
  "supportsSearch"   BOOLEAN        NOT NULL DEFAULT FALSE,
  "isActive"         BOOLEAN        NOT NULL DEFAULT TRUE,
  "isDeprecated"     BOOLEAN        NOT NULL DEFAULT FALSE,
  "qualityScore"     DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "latencyScore"     DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "reliabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "createdAt"        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "llm_model_registry_tier_idx"     ON "llm_model_registry"("tier");
CREATE INDEX IF NOT EXISTS "llm_model_registry_active_idx"   ON "llm_model_registry"("isActive");

CREATE TABLE IF NOT EXISTS "llm_routing_policies" (
  "id"                  TEXT          NOT NULL PRIMARY KEY,
  "name"                VARCHAR(100)  NOT NULL UNIQUE,
  "description"         TEXT,
  "agentName"           VARCHAR(20),
  "taskType"            VARCHAR(50),
  "modality"            VARCHAR(20),
  "minTier"             VARCHAR(20),
  "maxTier"             VARCHAR(20),
  "preferredProviders"  VARCHAR(50)[] NOT NULL DEFAULT '{}',
  "blockedProviders"    VARCHAR(50)[] NOT NULL DEFAULT '{}',
  "requiredStrengths"   VARCHAR(50)[] NOT NULL DEFAULT '{}',
  "maxEstimatedCredits" INTEGER,
  "maxEstimatedCostUsd" DECIMAL(12,6),
  "isActive"            BOOLEAN       NOT NULL DEFAULT TRUE,
  "createdAt"           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "llm_routing_policies_agent_idx"    ON "llm_routing_policies"("agentName");
CREATE INDEX IF NOT EXISTS "llm_routing_policies_tasktype_idx" ON "llm_routing_policies"("taskType");

CREATE TABLE IF NOT EXISTS "ai_usage_ledger" (
  "id"               TEXT           NOT NULL PRIMARY KEY,
  "workspaceId"      VARCHAR(255)   NOT NULL,
  "userId"           UUID           NOT NULL,
  "agentName"        VARCHAR(20),
  "taskType"         VARCHAR(50)    NOT NULL,
  "modality"         VARCHAR(20)    NOT NULL,
  "provider"         VARCHAR(50)    NOT NULL,
  "modelId"          VARCHAR(200)   NOT NULL,
  "routeTier"        VARCHAR(20)    NOT NULL,
  "inputTokens"      INTEGER        NOT NULL DEFAULT 0,
  "outputTokens"     INTEGER        NOT NULL DEFAULT 0,
  "totalTokens"      INTEGER        NOT NULL DEFAULT 0,
  "estimatedCostUsd" DECIMAL(12,6)  NOT NULL,
  "actualCostUsd"    DECIMAL(12,6),
  "creditsReserved"  INTEGER        NOT NULL DEFAULT 0,
  "creditsDeducted"  INTEGER        NOT NULL DEFAULT 0,
  "creditsRefunded"  INTEGER        NOT NULL DEFAULT 0,
  "status"           VARCHAR(20)    NOT NULL,
  "fallbackUsed"     BOOLEAN        NOT NULL DEFAULT FALSE,
  "fallbackFromModel" VARCHAR(200),
  "fallbackToModel"  VARCHAR(200),
  "requestId"        VARCHAR(100),
  "traceId"          VARCHAR(100),
  "errorCode"        VARCHAR(50),
  "errorMessage"     VARCHAR(500),
  "createdAt"        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "ai_usage_ledger_workspace_idx" ON "ai_usage_ledger"("workspaceId");
CREATE INDEX IF NOT EXISTS "ai_usage_ledger_user_idx"      ON "ai_usage_ledger"("userId");
CREATE INDEX IF NOT EXISTS "ai_usage_ledger_agent_idx"     ON "ai_usage_ledger"("agentName");
CREATE INDEX IF NOT EXISTS "ai_usage_ledger_created_idx"   ON "ai_usage_ledger"("createdAt");

CREATE TABLE IF NOT EXISTS "ai_credit_reservations" (
  "id"              TEXT         NOT NULL PRIMARY KEY,
  "workspaceId"     VARCHAR(255) NOT NULL,
  "userId"          UUID         NOT NULL,
  "ledgerId"        TEXT,
  "requestId"       VARCHAR(100) NOT NULL,
  "reservedCredits" INTEGER      NOT NULL,
  "consumedCredits" INTEGER      NOT NULL DEFAULT 0,
  "refundedCredits" INTEGER      NOT NULL DEFAULT 0,
  "status"          VARCHAR(20)  NOT NULL,
  "expiresAt"       TIMESTAMPTZ  NOT NULL,
  "createdAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "ai_credit_reservations_workspace_idx" ON "ai_credit_reservations"("workspaceId");
CREATE INDEX IF NOT EXISTS "ai_credit_reservations_user_idx"      ON "ai_credit_reservations"("userId");
CREATE INDEX IF NOT EXISTS "ai_credit_reservations_status_idx"    ON "ai_credit_reservations"("status");

CREATE TABLE IF NOT EXISTS "llm_router_traces" (
  "id"               TEXT          NOT NULL PRIMARY KEY,
  "workspaceId"      VARCHAR(255)  NOT NULL,
  "userId"           UUID          NOT NULL,
  "requestId"        VARCHAR(100)  NOT NULL,
  "agentName"        VARCHAR(20),
  "rawUserIntent"    TEXT,
  "normalizedTask"   JSONB         NOT NULL DEFAULT '{}',
  "advisorDecision"  JSONB         NOT NULL DEFAULT '{}',
  "governorDecision" JSONB         NOT NULL DEFAULT '{}',
  "selectedModel"    VARCHAR(200)  NOT NULL,
  "fallbackModels"   VARCHAR(200)[] NOT NULL DEFAULT '{}',
  "estimatedCredits" INTEGER       NOT NULL DEFAULT 0,
  "estimatedCostUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
  "status"           VARCHAR(20)   NOT NULL,
  "errorMessage"     TEXT,
  "createdAt"        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "llm_router_traces_workspace_idx" ON "llm_router_traces"("workspaceId");
CREATE INDEX IF NOT EXISTS "llm_router_traces_user_idx"      ON "llm_router_traces"("userId");
CREATE INDEX IF NOT EXISTS "llm_router_traces_created_idx"   ON "llm_router_traces"("createdAt");
