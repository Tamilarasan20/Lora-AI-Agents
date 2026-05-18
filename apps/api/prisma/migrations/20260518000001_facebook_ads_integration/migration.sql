-- CreateTable: facebook_pages
CREATE TABLE "facebook_pages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platformConnectionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "pageId" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100),
    "pictureUrl" TEXT,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "fanCount" INTEGER NOT NULL DEFAULT 0,
    "encryptedPageToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facebook_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: facebook_posts
CREATE TABLE "facebook_posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facebookPageId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "pagePostId" VARCHAR(255),
    "message" TEXT,
    "link" TEXT,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "postType" VARCHAR(50) NOT NULL DEFAULT 'TEXT',
    "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "bullJobId" VARCHAR(255),
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facebook_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ad_accounts
CREATE TABLE "ad_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "facebookPageId" UUID,
    "fbAccountId" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "accountStatus" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ad_campaigns
CREATE TABLE "ad_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "adAccountId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fbCampaignId" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "objective" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PAUSED',
    "dailyBudget" DECIMAL(12,2),
    "lifetimeBudget" DECIMAL(12,2),
    "startTime" TIMESTAMP(3),
    "stopTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ad_sets
CREATE TABLE "ad_sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaignId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fbAdSetId" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PAUSED',
    "targeting" JSONB NOT NULL DEFAULT '{}',
    "dailyBudget" DECIMAL(12,2),
    "bidAmount" DECIMAL(12,2),
    "bidStrategy" VARCHAR(50),
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ads
CREATE TABLE "ads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "adSetId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fbAdId" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PAUSED',
    "creative" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ad_insights_snapshots
CREATE TABLE "ad_insights_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "adAccountId" UUID NOT NULL,
    "entityType" VARCHAR(20) NOT NULL,
    "entityId" VARCHAR(255) NOT NULL,
    "dateStart" TIMESTAMP(3) NOT NULL,
    "dateStop" TIMESTAMP(3) NOT NULL,
    "spend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "cpm" DECIMAL(10,4),
    "cpc" DECIMAL(10,4),
    "ctr" DECIMAL(8,4),
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "costPerConversion" DECIMAL(12,2),
    "roas" DECIMAL(8,4),
    "actions" JSONB NOT NULL DEFAULT '[]',
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_insights_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: facebook_pages
CREATE UNIQUE INDEX "facebook_pages_platformConnectionId_pageId_key" ON "facebook_pages"("platformConnectionId", "pageId");
CREATE INDEX "facebook_pages_userId_idx" ON "facebook_pages"("userId");
CREATE INDEX "facebook_pages_pageId_idx" ON "facebook_pages"("pageId");
CREATE INDEX "facebook_pages_isActive_idx" ON "facebook_pages"("isActive");

-- CreateIndex: facebook_posts
CREATE INDEX "facebook_posts_facebookPageId_idx" ON "facebook_posts"("facebookPageId");
CREATE INDEX "facebook_posts_userId_idx" ON "facebook_posts"("userId");
CREATE INDEX "facebook_posts_status_idx" ON "facebook_posts"("status");
CREATE INDEX "facebook_posts_scheduledAt_idx" ON "facebook_posts"("scheduledAt");

-- CreateIndex: ad_accounts
CREATE UNIQUE INDEX "ad_accounts_userId_fbAccountId_key" ON "ad_accounts"("userId", "fbAccountId");
CREATE INDEX "ad_accounts_userId_idx" ON "ad_accounts"("userId");

-- CreateIndex: ad_campaigns
CREATE UNIQUE INDEX "ad_campaigns_adAccountId_fbCampaignId_key" ON "ad_campaigns"("adAccountId", "fbCampaignId");
CREATE INDEX "ad_campaigns_adAccountId_idx" ON "ad_campaigns"("adAccountId");
CREATE INDEX "ad_campaigns_userId_idx" ON "ad_campaigns"("userId");
CREATE INDEX "ad_campaigns_status_idx" ON "ad_campaigns"("status");

-- CreateIndex: ad_sets
CREATE UNIQUE INDEX "ad_sets_campaignId_fbAdSetId_key" ON "ad_sets"("campaignId", "fbAdSetId");
CREATE INDEX "ad_sets_campaignId_idx" ON "ad_sets"("campaignId");
CREATE INDEX "ad_sets_userId_idx" ON "ad_sets"("userId");

-- CreateIndex: ads
CREATE UNIQUE INDEX "ads_adSetId_fbAdId_key" ON "ads"("adSetId", "fbAdId");
CREATE INDEX "ads_adSetId_idx" ON "ads"("adSetId");
CREATE INDEX "ads_userId_idx" ON "ads"("userId");

-- CreateIndex: ad_insights_snapshots
CREATE INDEX "ad_insights_snapshots_adAccountId_idx" ON "ad_insights_snapshots"("adAccountId");
CREATE INDEX "ad_insights_snapshots_userId_idx" ON "ad_insights_snapshots"("userId");
CREATE INDEX "ad_insights_snapshots_entityType_entityId_idx" ON "ad_insights_snapshots"("entityType", "entityId");
CREATE INDEX "ad_insights_snapshots_dateStart_idx" ON "ad_insights_snapshots"("dateStart");

-- AddForeignKey: facebook_pages
ALTER TABLE "facebook_pages" ADD CONSTRAINT "facebook_pages_platformConnectionId_fkey"
    FOREIGN KEY ("platformConnectionId") REFERENCES "platform_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "facebook_pages" ADD CONSTRAINT "facebook_pages_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: facebook_posts
ALTER TABLE "facebook_posts" ADD CONSTRAINT "facebook_posts_facebookPageId_fkey"
    FOREIGN KEY ("facebookPageId") REFERENCES "facebook_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "facebook_posts" ADD CONSTRAINT "facebook_posts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ad_accounts
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_facebookPageId_fkey"
    FOREIGN KEY ("facebookPageId") REFERENCES "facebook_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: ad_campaigns
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_adAccountId_fkey"
    FOREIGN KEY ("adAccountId") REFERENCES "ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ad_sets
ALTER TABLE "ad_sets" ADD CONSTRAINT "ad_sets_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ads
ALTER TABLE "ads" ADD CONSTRAINT "ads_adSetId_fkey"
    FOREIGN KEY ("adSetId") REFERENCES "ad_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ad_insights_snapshots
ALTER TABLE "ad_insights_snapshots" ADD CONSTRAINT "ad_insights_snapshots_adAccountId_fkey"
    FOREIGN KEY ("adAccountId") REFERENCES "ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
