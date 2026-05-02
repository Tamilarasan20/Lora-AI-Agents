-- AlterTable: add competitors JSON column to BrandKnowledge
ALTER TABLE "BrandKnowledge" ADD COLUMN IF NOT EXISTS "competitors" JSONB NOT NULL DEFAULT '[]';
