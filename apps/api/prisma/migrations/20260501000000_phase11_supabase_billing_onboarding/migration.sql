-- Phase 11: Supabase Auth + Billing + Onboarding schema additions

-- Supabase auth link
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supabase_id" VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS "users_supabase_id_key" ON "users"("supabase_id");

-- Make password_hash nullable (Supabase manages passwords)
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- Billing
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

-- Lifecycle flags
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "welcome_email_sent" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_complete" BOOLEAN NOT NULL DEFAULT FALSE;
