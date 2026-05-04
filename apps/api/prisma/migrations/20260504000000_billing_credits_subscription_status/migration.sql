-- Add subscription tracking and monthly credit fields to users
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "subscriptionStatus"  VARCHAR(50) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "creditsUsedThisMonth" INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "creditsResetAt"       TIMESTAMPTZ;

-- Add SOLO and AGENCY to Plan enum (UNLIMITED kept for backward compat)
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'SOLO';
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'AGENCY';

-- Existing stripe customers are assumed active
UPDATE "users"
SET "subscriptionStatus" = 'active'
WHERE "stripeCustomerId" IS NOT NULL
  AND "plan" != 'FREE';
