import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';

export type AdNetwork = 'meta' | 'google' | 'tiktok' | 'linkedin';

export interface AdCampaignLaunchInput {
  userId: string;
  network: AdNetwork;
  campaignJson: Record<string, unknown>; // Elena's campaign plan JSON
}

export interface AdCampaignResult {
  networkCampaignId: string;
  status: string;
  network: AdNetwork;
  launchedAt: string;
}

export interface AdPerformanceMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpa: number;
  roas: number;
  fetchedAt: string;
}

@Injectable()
export class AdNetworkService {
  private readonly logger = new Logger(AdNetworkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  // Get decrypted ad account token for a user + network
  private async getToken(userId: string, network: AdNetwork): Promise<string> {
    const conn = await this.prisma.platformConnection.findFirst({
      where: { userId, platform: network, connectionStatus: 'ACTIVE' },
    });
    if (!conn) throw new Error(`No active ${network} connection for user ${userId}`);
    return this.encryption.decrypt(conn.accessToken);
  }

  // ── Meta Ads (Facebook/Instagram) ─────────────────────────────────────────

  async launchMetaCampaign(userId: string, plan: Record<string, unknown>): Promise<AdCampaignResult> {
    const token = await this.getToken(userId, 'meta');
    const conn = await this.prisma.platformConnection.findFirst({ where: { userId, platform: 'meta' } });
    const adAccountId = conn?.platformUserId ?? '';

    const res = await fetch(`https://graph.facebook.com/v19.0/act_${adAccountId}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: plan.campaignName,
        objective: this.mapMetaObjective(plan.objective as string),
        status: 'PAUSED', // always launch paused for safety, user activates
        special_ad_categories: [],
        access_token: token,
      }),
    });
    const data = await res.json() as any;
    if (data.error) throw new Error(`Meta Ads error: ${data.error.message}`);

    return { networkCampaignId: data.id, status: 'PAUSED', network: 'meta', launchedAt: new Date().toISOString() };
  }

  async getMetaPerformance(userId: string, campaignId: string, datePreset = 'last_30d'): Promise<AdPerformanceMetrics> {
    const token = await this.getToken(userId, 'meta');
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${campaignId}/insights?fields=impressions,clicks,spend,actions,action_values,ctr,cpc&date_preset=${datePreset}&access_token=${token}`,
    );
    const data = await res.json() as any;
    if (data.error) throw new Error(`Meta insights error: ${data.error.message}`);
    const d = data.data?.[0] ?? {};
    const conversions = (d.actions as any[] | undefined)?.find(a => a.action_type === 'purchase')?.value ?? 0;
    const revenue = (d.action_values as any[] | undefined)?.find(a => a.action_type === 'purchase')?.value ?? 0;
    const spend = parseFloat(d.spend ?? '0');
    return {
      impressions: parseInt(d.impressions ?? '0'),
      clicks: parseInt(d.clicks ?? '0'),
      spend,
      conversions: parseFloat(conversions),
      ctr: parseFloat(d.ctr ?? '0'),
      cpa: conversions > 0 ? spend / conversions : 0,
      roas: spend > 0 ? revenue / spend : 0,
      fetchedAt: new Date().toISOString(),
    };
  }

  async pauseMetaCampaign(userId: string, campaignId: string): Promise<void> {
    const token = await this.getToken(userId, 'meta');
    await fetch(`https://graph.facebook.com/v19.0/${campaignId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAUSED', access_token: token }),
    });
  }

  async scaleMetaBudget(userId: string, adSetId: string, newDailyBudgetCents: number): Promise<void> {
    const token = await this.getToken(userId, 'meta');
    await fetch(`https://graph.facebook.com/v19.0/${adSetId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daily_budget: newDailyBudgetCents, access_token: token }),
    });
  }

  // ── TikTok Ads ─────────────────────────────────────────────────────────────

  async launchTikTokCampaign(userId: string, plan: Record<string, unknown>): Promise<AdCampaignResult> {
    const token = await this.getToken(userId, 'tiktok');
    const conn = await this.prisma.platformConnection.findFirst({ where: { userId, platform: 'tiktok' } });

    const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/campaign/create/', {
      method: 'POST',
      headers: { 'Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        advertiser_id: conn?.platformUserId,
        campaign_name: plan.campaignName,
        objective_type: this.mapTikTokObjective(plan.objective as string),
        budget_mode: 'BUDGET_MODE_DAY',
        budget: plan.dailyBudgetUsd,
        operation_status: 'DISABLE', // launch paused
      }),
    });
    const data = await res.json() as any;
    if (data.code !== 0) throw new Error(`TikTok Ads error: ${data.message}`);

    return { networkCampaignId: data.data?.campaign_id, status: 'PAUSED', network: 'tiktok', launchedAt: new Date().toISOString() };
  }

  async getTikTokPerformance(userId: string, campaignId: string): Promise<AdPerformanceMetrics> {
    const token = await this.getToken(userId, 'tiktok');
    const conn = await this.prisma.platformConnection.findFirst({ where: { userId, platform: 'tiktok' } });
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const res = await fetch(
      `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?advertiser_id=${conn?.platformUserId}&report_type=BASIC&data_level=AUCTION_CAMPAIGN&dimensions=["campaign_id"]&metrics=["impressions","clicks","spend","conversions","ctr","cpa","roas"]&start_date=${start}&end_date=${end}&filtering=[{"field_name":"campaign_ids","filter_type":"IN","filter_value":"[\\"${campaignId}\\"]"}]`,
      { headers: { 'Access-Token': token } },
    );
    const data = await res.json() as any;
    const m = data.data?.list?.[0]?.metrics ?? {};
    return {
      impressions: parseInt(m.impressions ?? '0'),
      clicks: parseInt(m.clicks ?? '0'),
      spend: parseFloat(m.spend ?? '0'),
      conversions: parseFloat(m.conversions ?? '0'),
      ctr: parseFloat(m.ctr ?? '0'),
      cpa: parseFloat(m.cpa ?? '0'),
      roas: parseFloat(m.roas ?? '0'),
      fetchedAt: new Date().toISOString(),
    };
  }

  // ── LinkedIn Ads ───────────────────────────────────────────────────────────

  async launchLinkedInCampaign(userId: string, plan: Record<string, unknown>): Promise<AdCampaignResult> {
    const token = await this.getToken(userId, 'linkedin');
    const conn = await this.prisma.platformConnection.findFirst({ where: { userId, platform: 'linkedin' } });

    const res = await fetch('https://api.linkedin.com/v2/adCampaignsV2', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'LinkedIn-Version': '202401' },
      body: JSON.stringify({
        account: `urn:li:sponsoredAccount:${conn?.platformUserId}`,
        name: plan.campaignName,
        objectiveType: this.mapLinkedInObjective(plan.objective as string),
        status: 'PAUSED',
        type: 'SPONSORED_UPDATES',
        costType: 'CPC',
        dailyBudget: { currencyCode: 'USD', amount: String(plan.dailyBudgetUsd) },
      }),
    });
    const data = await res.json() as any;
    if (data.status === 422) throw new Error(`LinkedIn Ads error: ${JSON.stringify(data)}`);
    const id = res.headers.get('x-restli-id') ?? data.id ?? '';

    return { networkCampaignId: id, status: 'PAUSED', network: 'linkedin', launchedAt: new Date().toISOString() };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private mapMetaObjective(obj: string): string {
    const map: Record<string, string> = {
      awareness: 'OUTCOME_AWARENESS', traffic: 'OUTCOME_TRAFFIC',
      leads: 'OUTCOME_LEADS', sales: 'OUTCOME_SALES', engagement: 'OUTCOME_ENGAGEMENT',
    };
    return map[obj] ?? 'OUTCOME_TRAFFIC';
  }

  private mapTikTokObjective(obj: string): string {
    const map: Record<string, string> = {
      awareness: 'REACH', traffic: 'TRAFFIC', leads: 'LEAD_GENERATION',
      sales: 'CONVERSIONS', engagement: 'VIDEO_VIEWS',
    };
    return map[obj] ?? 'TRAFFIC';
  }

  private mapLinkedInObjective(obj: string): string {
    const map: Record<string, string> = {
      awareness: 'BRAND_AWARENESS', traffic: 'WEBSITE_VISITS',
      leads: 'LEAD_GENERATION', engagement: 'ENGAGEMENT',
    };
    return map[obj] ?? 'WEBSITE_VISITS';
  }
}
