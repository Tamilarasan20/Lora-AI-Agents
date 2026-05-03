-- CreateTable
CREATE TABLE "creative_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "businessId" VARCHAR(255) NOT NULL,
    "taskId" UUID,
    "campaignId" UUID,
    "agentOutputId" UUID,
    "assetType" VARCHAR(50) NOT NULL,
    "platform" VARCHAR(100) NOT NULL,
    "dimensions" VARCHAR(50) NOT NULL DEFAULT '1080x1080',
    "assetUrl" VARCHAR(2000) NOT NULL,
    "promptUsed" TEXT,
    "brandStyleNotes" TEXT,
    "slideNumber" INTEGER,
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "approvalStatus" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creative_assets_userId_idx" ON "creative_assets"("userId");

-- CreateIndex
CREATE INDEX "creative_assets_taskId_idx" ON "creative_assets"("taskId");

-- CreateIndex
CREATE INDEX "creative_assets_campaignId_idx" ON "creative_assets"("campaignId");

-- AddForeignKey
ALTER TABLE "creative_assets" ADD CONSTRAINT "creative_assets_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "marketing_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_assets" ADD CONSTRAINT "creative_assets_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "marketing_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
