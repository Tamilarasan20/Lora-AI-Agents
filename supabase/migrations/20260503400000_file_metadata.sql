-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: file_metadata
-- Storage backend: Cloudflare R2  |  Metadata: Supabase PostgreSQL
--
-- Column names use camelCase to match the Prisma schema (no @map decorators
-- on individual fields in schema.prisma — Prisma stores them as-is).
--
-- Deploy:
--   supabase db push                    # via Supabase CLI
--   psql $DATABASE_URL -f this_file.sql # or directly
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Enum ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FileCategory') THEN
    CREATE TYPE "FileCategory" AS ENUM (
      'UPLOAD',
      'KNOWLEDGE_BASE',
      'AI_MEDIA',
      'EXPORT',
      'BRAND_ASSET'
    );
  END IF;
END
$$;

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS file_metadata (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspaceId"   UUID              NOT NULL,
  "uploadedBy"    UUID              NOT NULL,
  bucket          VARCHAR(100)      NOT NULL,
  "r2Key"         VARCHAR(1000)     NOT NULL UNIQUE,
  "originalName"  VARCHAR(500)      NOT NULL,
  "mimeType"      VARCHAR(100)      NOT NULL,
  size            BIGINT            NOT NULL CHECK (size > 0),
  category        "FileCategory"    NOT NULL DEFAULT 'UPLOAD',
  "createdAt"     TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_file_metadata_workspaceId
  ON file_metadata ("workspaceId");

CREATE INDEX IF NOT EXISTS idx_file_metadata_uploadedBy
  ON file_metadata ("uploadedBy");

CREATE INDEX IF NOT EXISTS idx_file_metadata_workspace_category
  ON file_metadata ("workspaceId", category);

CREATE INDEX IF NOT EXISTS idx_file_metadata_createdAt
  ON file_metadata ("createdAt" DESC);

-- ── Row-Level Security ────────────────────────────────────────────────────────
ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;

-- Service-role key (used by the NestJS API) bypasses all RLS
CREATE POLICY "service_role_bypass" ON file_metadata
  AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated users can SELECT files in workspaces they own
CREATE POLICY "owner_select" ON file_metadata
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    "workspaceId" IN (
      SELECT id FROM workspaces WHERE "userId" = auth.uid()
    )
  );

-- Authenticated users can INSERT into their own workspaces
CREATE POLICY "owner_insert" ON file_metadata
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    "workspaceId" IN (
      SELECT id FROM workspaces WHERE "userId" = auth.uid()
    )
    AND "uploadedBy" = auth.uid()
  );

-- Users can DELETE files they uploaded within their workspaces
CREATE POLICY "owner_delete" ON file_metadata
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    "uploadedBy" = auth.uid()
    AND "workspaceId" IN (
      SELECT id FROM workspaces WHERE "userId" = auth.uid()
    )
  );

-- ── Helper: paginated workspace file list ─────────────────────────────────────
CREATE OR REPLACE FUNCTION get_workspace_files(
  p_workspace_id  UUID,
  p_category      "FileCategory" DEFAULT NULL,
  p_limit         INT            DEFAULT 20,
  p_offset        INT            DEFAULT 0
)
RETURNS SETOF file_metadata
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT * FROM file_metadata
  WHERE  "workspaceId" = p_workspace_id
    AND  (p_category IS NULL OR category = p_category)
  ORDER  BY "createdAt" DESC
  LIMIT  LEAST(p_limit, 100)
  OFFSET p_offset;
$$;

-- ── Helper: total bytes used by a workspace ───────────────────────────────────
CREATE OR REPLACE FUNCTION workspace_storage_bytes(p_workspace_id UUID)
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(size), 0)
  FROM   file_metadata
  WHERE  "workspaceId" = p_workspace_id;
$$;

COMMENT ON TABLE file_metadata IS
  'Pointer table for files stored in Cloudflare R2. '
  'Binary content lives exclusively in R2; this table only stores metadata '
  'and access-control relationships.';
