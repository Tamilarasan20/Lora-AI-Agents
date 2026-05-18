import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import {
  getAdAccounts,
  getCampaigns,
  createCampaign,
  updateCampaignStatus,
  getAdSets,
  getAdInsights,
} from '../meta/meta-graph.client';

export interface CreateCampaignDto {
  adAccountDbId: string;
  userId: string;
  name: string;
  objective: string;
  status?: string;
  dailyBudget?: number;
}

@Injectable()
export class MetaAdsService {
  private readonly logger = new Logger(MetaAdsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  // ── Ad Account discovery ──────────────────────────────────────────────────

  async syncAdAccounts(userId: string, accessToken: string): Promise<void> {
    const res = await getAdAccounts(accessToken);

    for (const account of res.data) {
      const rawId = account.id.replace('act_', '');
      await this.prisma.adAccount.upsert({
        where: { userId_fbAccountId: { userId, fbAccountId: rawId } },
        create: {
          userId,
          fbAccountId: rawId,
          name: account.name,
          currency: account.currency,
          timezone: account.timezone_name,
          accountStatus: account.account_status,
          isActive: true,
        },
        update: {
          name: account.name,
          currency: account.currency,
          timezone: account.timezone_name,
          accountStatus: account.account_status,
        },
      });
    }

    this.logger.log(`Synced ${res.data.length} ad accounts for user ${userId}`);
  }

  async listAdAccounts(userId: string) {
    return this.prisma.adAccount.findMany({
      where: { userId, isActive: true },
      include: { _count: { select: { campaigns: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Campaigns ─────────────────────────────────────────────────────────────

  async syncCampaigns(adAccountDbId: string, userId: string): Promise<void> {
    const { token, account } = await this.getAccountWithToken(adAccountDbId, userId);
    const res = await getCampaigns(account.fbAccountId, token);

    for (const campaign of res.data) {
      await this.prisma.adCampaign.upsert({
        where: {
          adAccountId_fbCampaignId: {
            adAccountId: adAccountDbId,
            fbCampaignId: campaign.id,
          },
        },
        create: {
          adAccountId: adAccountDbId,
          userId,
          fbCampaignId: campaign.id,
          name: campaign.name,
          objective: campaign.objective,
          status: campaign.status,
          dailyBudget: campaign.daily_budget ? Number(campaign.daily_budget) / 100 : null,
          lifetimeBudget: campaign.lifetime_budget ? Number(campaign.lifetime_budget) / 100 : null,
          startTime: campaign.start_time ? new Date(campaign.start_time) : null,
          stopTime: campaign.stop_time ? new Date(campaign.stop_time) : null,
        },
        update: {
          name: campaign.name,
          status: campaign.status,
          dailyBudget: campaign.daily_budget ? Number(campaign.daily_budget) / 100 : null,
        },
      });
    }
  }

  async listCampaigns(adAccountDbId: string, userId: string) {
    return this.prisma.adCampaign.findMany({
      where: { adAccountId: adAccountDbId, userId },
      include: { _count: { select: { adSets: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAdCampaign(dto: CreateCampaignDto) {
    const { token, account } = await this.getAccountWithToken(dto.adAccountDbId, dto.userId);

    const res = await createCampaign({
      adAccountId: account.fbAccountId,
      name: dto.name,
      objective: dto.objective,
      status: dto.status ?? 'PAUSED',
      dailyBudget: dto.dailyBudget,
      accessToken: token,
    });

    return this.prisma.adCampaign.create({
      data: {
        adAccountId: dto.adAccountDbId,
        userId: dto.userId,
        fbCampaignId: res.id,
        name: dto.name,
        objective: dto.objective,
        status: dto.status ?? 'PAUSED',
        dailyBudget: dto.dailyBudget ?? null,
      },
    });
  }

  async updateCampaign(
    campaignDbId: string,
    userId: string,
    status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED',
  ) {
    const campaign = await this.prisma.adCampaign.findFirstOrThrow({
      where: { id: campaignDbId, userId },
      include: { adAccount: true },
    });

    const token = await this.getTokenForAccount(campaign.adAccount.id, userId);
    await updateCampaignStatus({ campaignId: campaign.fbCampaignId, status, accessToken: token });

    return this.prisma.adCampaign.update({
      where: { id: campaignDbId },
      data: { status },
    });
  }

  // ── Ad Sets ───────────────────────────────────────────────────────────────

  async syncAdSets(adAccountDbId: string, userId: string, campaignDbId?: string): Promise<void> {
    const { token, account } = await this.getAccountWithToken(adAccountDbId, userId);
    let fbCampaignId: string | undefined;

    if (campaignDbId) {
      const campaign = await this.prisma.adCampaign.findFirstOrThrow({ where: { id: campaignDbId, userId } });
      fbCampaignId = campaign.fbCampaignId;
    }

    const res = await getAdSets(account.fbAccountId, token, fbCampaignId);

    for (const adSet of res.data) {
      const campaign = await this.prisma.adCampaign.findFirst({
        where: { adAccountId: adAccountDbId },
      });
      if (!campaign) continue;

      await this.prisma.adSet.upsert({
        where: { campaignId_fbAdSetId: { campaignId: campaign.id, fbAdSetId: adSet.id } },
        create: {
          campaignId: campaign.id,
          userId,
          fbAdSetId: adSet.id,
          name: adSet.name,
          status: adSet.status,
          targeting: (adSet.targeting as any) ?? {},
          dailyBudget: adSet.daily_budget ? Number(adSet.daily_budget) / 100 : null,
          bidAmount: adSet.bid_amount ? Number(adSet.bid_amount) / 100 : null,
        },
        update: {
          name: adSet.name,
          status: adSet.status,
          dailyBudget: adSet.daily_budget ? Number(adSet.daily_budget) / 100 : null,
        },
      });
    }
  }

  async listAdSets(campaignDbId: string, userId: string) {
    return this.prisma.adSet.findMany({
      where: { campaignId: campaignDbId, userId },
      include: { _count: { select: { ads: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Insights ──────────────────────────────────────────────────────────────

  async getAccountInsights(
    adAccountDbId: string,
    userId: string,
    datePreset: string = 'last_30d',
  ) {
    const { token, account } = await this.getAccountWithToken(adAccountDbId, userId);
    const res = await getAdInsights({
      adAccountId: account.fbAccountId,
      level: 'account',
      datePreset,
      accessToken: token,
    });

    const data = res.data[0];
    if (!data) {
      return { spend: 0, impressions: 0, clicks: 0, reach: 0, cpm: 0, cpc: 0, ctr: 0, conversions: 0 };
    }

    const conversions = (data.actions ?? [])
      .filter((a) => ['purchase', 'lead', 'complete_registration'].includes(a.action_type))
      .reduce((sum, a) => sum + Number(a.value), 0);

    return {
      spend: Number(data.spend ?? 0),
      impressions: Number(data.impressions ?? 0),
      clicks: Number(data.clicks ?? 0),
      reach: Number(data.reach ?? 0),
      cpm: Number(data.cpm ?? 0),
      cpc: Number(data.cpc ?? 0),
      ctr: Number(data.ctr ?? 0),
      conversions,
      dateStart: data.date_start,
      dateStop: data.date_stop,
    };
  }

  async getCampaignInsights(
    adAccountDbId: string,
    userId: string,
    datePreset: string = 'last_30d',
  ) {
    const { token, account } = await this.getAccountWithToken(adAccountDbId, userId);
    const res = await getAdInsights({
      adAccountId: account.fbAccountId,
      level: 'campaign',
      datePreset,
      accessToken: token,
    });

    return res.data.map((d) => ({
      campaignId: (d as any).campaign_id,
      campaignName: (d as any).campaign_name,
      spend: Number(d.spend ?? 0),
      impressions: Number(d.impressions ?? 0),
      clicks: Number(d.clicks ?? 0),
      reach: Number(d.reach ?? 0),
      ctr: Number(d.ctr ?? 0),
      cpc: Number(d.cpc ?? 0),
    }));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async getAccountWithToken(adAccountDbId: string, userId: string) {
    const account = await this.prisma.adAccount.findFirstOrThrow({
      where: { id: adAccountDbId, userId, isActive: true },
    });
    const token = await this.getTokenForAccount(adAccountDbId, userId);
    return { token, account };
  }

  private async getTokenForAccount(adAccountDbId: string, userId: string): Promise<string> {
    // Use the user's active Meta/Instagram connection token for ad account access
    const connection = await this.prisma.platformConnection.findFirstOrThrow({
      where: { userId, platform: 'instagram', connectionStatus: 'ACTIVE' },
      orderBy: { lastRefreshedAt: 'desc' },
    });
    return this.encryption.decrypt(connection.accessToken);
  }
}
