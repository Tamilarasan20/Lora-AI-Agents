-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('UPLOAD', 'KNOWLEDGE_BASE', 'AI_MEDIA', 'EXPORT', 'BRAND_ASSET');

-- CreateTable
CREATE TABLE "file_metadata" (
    "id"            UUID            NOT NULL DEFAULT gen_random_uuid(),
    "workspaceId"   UUID            NOT NULL,
    "uploadedBy"    UUID            NOT NULL,
    "bucket"        VARCHAR(100)    NOT NULL,
    "r2Key"         VARCHAR(1000)   NOT NULL,
    "originalName"  VARCHAR(500)    NOT NULL,
    "mimeType"      VARCHAR(100)    NOT NULL,
    "size"          BIGINT          NOT NULL,
    "category"      "FileCategory"  NOT NULL DEFAULT 'UPLOAD',
    "createdAt"     TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_metadata_r2Key_key" ON "file_metadata"("r2Key");

-- CreateIndex
CREATE INDEX "file_metadata_workspaceId_idx" ON "file_metadata"("workspaceId");

-- CreateIndex
CREATE INDEX "file_metadata_uploadedBy_idx" ON "file_metadata"("uploadedBy");

-- CreateIndex
CREATE INDEX "file_metadata_workspaceId_category_idx" ON "file_metadata"("workspaceId", "category");
