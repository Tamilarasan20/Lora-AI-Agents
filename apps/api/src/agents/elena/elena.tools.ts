import { ToolDefinition } from '../base-agent';
import { AdNetworkService } from '../../ads/ad-network.service';

/**
 * Elena's tools — UTM generation, budget validation, optimisation-rule
 * evaluation, and real ad network management (launch, pause, scale, sync).
 */
export function buildElenaTools(adNetwork?: AdNetworkService): ToolDefinition[] {
  return [
    {
      name: 'build_utm_template',
      description:
        'Build a UTM tracking template for a campaign. Returns a query-string template ready for ad URLs.',
      inputSchema: {
        properties: {
          network: { type: 'string', enum: ['meta', 'google', 'tiktok', 'linkedin', 'youtube'] },
          campaignName: { type: 'string' },
          medium: { type: 'string', description: 'Default: cpc' },
          contentVariant: { type: 'string', description: 'Optional creative variant id' },
        },
        required: ['network', 'campaignName'],
      },
      handler: async (input) => {
        const slug = String(input.campaignName).toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const params: Record<string, string> = {
          utm_source:   String(input.network),
          utm_medium:   (input.medium as string) ?? 'cpc',
          utm_campaign: slug,
        };
        if (input.contentVariant) params.utm_content = String(input.contentVariant);
        const qs = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
        return {
          template: `?${qs}`,
          params,
          example: `https://yoursite.com/landing?${qs}`,
        };
      },
    },
    {
      name: 'validate_budget',
      description:
        'Check that a daily budget gives enough volume for statistical significance within the campaign duration. Returns expected sample sizes per variant.',
      inputSchema: {
        properties: {
          dailyBudgetUsd: { type: 'number' },
          durationDays: { type: 'number' },
          expectedCpc: { type: 'number', description: 'Estimated CPC in USD' },
          variantCount: { type: 'number' },
          targetCtr: { type: 'number', description: 'Decimal e.g. 0.015 for 1.5%' },
        },
        required: ['dailyBudgetUsd', 'durationDays', 'expectedCpc', 'variantCount'],
      },
      handler: async (input) => {
        const budget    = Number(input.dailyBudgetUsd) * Number(input.durationDays);
        const cpc       = Number(input.expectedCpc);
        const variants  = Number(input.variantCount);
        const totalClicks   = budget / cpc;
        const clicksPerVar  = totalClicks / variants;
        const ctr           = (input.targetCtr as number) ?? 0.015;
        const impPerVar     = clicksPerVar / ctr;
        const sigThreshold  = 384; // approx sample size for 95% conf, 5% margin

        return {
          totalBudgetUsd:      Number(budget.toFixed(2)),
          totalEstimatedClicks: Math.round(totalClicks),
          clicksPerVariant:    Math.round(clicksPerVar),
          impressionsPerVariant: Math.round(impPerVar),
          enoughForSignificance: clicksPerVar >= sigThreshold,
          recommendation: clicksPerVar < sigThreshold
            ? `Budget gives only ~${Math.round(clicksPerVar)} clicks/variant. Need ~${sigThreshold} for 95% confidence. Reduce variant count or increase budget/duration.`
            : `Budget supports ${variants} variants with statistical power.`,
        };
      },
    },
    {
      name: 'evaluate_optimisation_rules',
      description:
        'Given current performance data, return which kill / scale / iterate rules fire.',
      inputSchema: {
        properties: {
          ctrPercent: { type: 'number' },
          cpaUsd: { type: 'number' },
          roasMultiple: { type: 'number' },
          targetCpaUsd: { type: 'number' },
          targetRoas: { type: 'number' },
          spendUsd: { type: 'number' },
          conversions: { type: 'number' },
          sustainedDays: { type: 'number' },
        },
        required: ['ctrPercent', 'spendUsd'],
      },
      handler: async (input) => {
        const ctr  = Number(input.ctrPercent);
        const cpa  = Number(input.cpaUsd ?? 0);
        const roas = Number(input.roasMultiple ?? 0);
        const tCpa = Number(input.targetCpaUsd ?? 0);
        const tRoas= Number(input.targetRoas ?? 0);
        const spend= Number(input.spendUsd);
        const conv = Number(input.conversions ?? 0);
        const days = Number(input.sustainedDays ?? 0);

        const decisions: { rule: string; verdict: 'kill' | 'scale' | 'iterate' | 'hold'; reason: string }[] = [];

        if (ctr < 0.5 && spend >= 50) {
          decisions.push({ rule: 'low-ctr-after-spend', verdict: 'kill', reason: `CTR ${ctr}% after $${spend} spend — pause ad set` });
        }
        if (tCpa > 0 && cpa > tCpa * 2 && conv >= 5) {
          decisions.push({ rule: 'cpa-2x-target', verdict: 'kill', reason: `CPA $${cpa} > 2x target $${tCpa} with ${conv} conversions` });
        }
        if (tRoas > 0 && roas > tRoas && days >= 3) {
          decisions.push({ rule: 'roas-sustained', verdict: 'scale', reason: `ROAS ${roas}x > target ${tRoas}x sustained ${days} days → +20% budget` });
        }
        if (ctr > 1.5 && tCpa > 0 && cpa > tCpa) {
          decisions.push({ rule: 'good-ctr-bad-cpa', verdict: 'iterate', reason: `CTR ${ctr}% strong but CPA $${cpa} > target $${tCpa} → swap CTA, not creative` });
        }
        if (decisions.length === 0) {
          decisions.push({ rule: 'within-bounds', verdict: 'hold', reason: 'No rules triggered — let the ad set learn' });
        }

        return { decisions, evaluatedAt: new Date().toISOString() };
      },
    },

    // ── Real Ad Network Tools ─────────────────────────────────────────────────

    {
      name: 'launch_campaign',
      description:
        'Launch a campaign directly to Meta Ads, TikTok Ads, or LinkedIn Ads. Always launches in PAUSED state — confirm with Lora before activating. Returns the network campaign ID.',
      inputSchema: {
        properties: {
          userId:       { type: 'string', description: 'User ID for fetching the ad account token' },
          network:      { type: 'string', enum: ['meta', 'tiktok', 'linkedin'], description: 'Ad network to launch on' },
          campaignJson: { type: 'object', description: 'Full campaign plan object from buildCampaign (must include campaignName, objective, dailyBudgetUsd)' },
        },
        required: ['userId', 'network', 'campaignJson'],
      },
      handler: async (input) => {
        if (!adNetwork) return { error: 'AdNetworkService not available' };
        const network = input.network as 'meta' | 'tiktok' | 'linkedin';
        const plan = input.campaignJson as Record<string, unknown>;
        const userId = input.userId as string;
        switch (network) {
          case 'meta':     return adNetwork.launchMetaCampaign(userId, plan);
          case 'tiktok':   return adNetwork.launchTikTokCampaign(userId, plan);
          case 'linkedin': return adNetwork.launchLinkedInCampaign(userId, plan);
          default:         return { error: `Unsupported network: ${network}` };
        }
      },
    },

    {
      name: 'get_campaign_performance',
      description:
        'Fetch live performance metrics for a campaign from the ad network. Returns impressions, clicks, spend, conversions, CTR, CPA, and ROAS.',
      inputSchema: {
        properties: {
          userId:     { type: 'string' },
          network:    { type: 'string', enum: ['meta', 'tiktok', 'linkedin'] },
          campaignId: { type: 'string', description: 'Network-assigned campaign ID returned by launch_campaign' },
        },
        required: ['userId', 'network', 'campaignId'],
      },
      handler: async (input) => {
        if (!adNetwork) return { error: 'AdNetworkService not available' };
        const network = input.network as 'meta' | 'tiktok' | 'linkedin';
        const userId = input.userId as string;
        const campaignId = input.campaignId as string;
        switch (network) {
          case 'meta':     return adNetwork.getMetaPerformance(userId, campaignId);
          case 'tiktok':   return adNetwork.getTikTokPerformance(userId, campaignId);
          case 'linkedin':
            return { error: 'LinkedIn performance sync not yet implemented — use Meta or TikTok' };
          default:         return { error: `Unsupported network: ${network}` };
        }
      },
    },

    {
      name: 'pause_campaign',
      description:
        'Pause a live campaign on the ad network immediately. Use when kill rules fire (CTR < 0.5% after $50 spend, or CPA > 2x target).',
      inputSchema: {
        properties: {
          userId:     { type: 'string' },
          network:    { type: 'string', enum: ['meta', 'tiktok', 'linkedin'] },
          campaignId: { type: 'string', description: 'Network-assigned campaign ID to pause' },
        },
        required: ['userId', 'network', 'campaignId'],
      },
      handler: async (input) => {
        if (!adNetwork) return { error: 'AdNetworkService not available' };
        const network = input.network as 'meta' | 'tiktok' | 'linkedin';
        const userId = input.userId as string;
        const campaignId = input.campaignId as string;
        switch (network) {
          case 'meta':
            await adNetwork.pauseMetaCampaign(userId, campaignId);
            return { paused: true, campaignId, network, pausedAt: new Date().toISOString() };
          case 'tiktok':
          case 'linkedin':
            return { error: `Pause not yet implemented for ${network} — pause manually in the ad manager` };
          default:
            return { error: `Unsupported network: ${network}` };
        }
      },
    },

    {
      name: 'scale_budget',
      description:
        'Scale the daily budget of a Meta ad set. Use when scale rules fire (ROAS > target sustained 3+ days). Defaults to a +20% increase if newDailyBudgetUsd is omitted.',
      inputSchema: {
        properties: {
          userId:             { type: 'string' },
          network:            { type: 'string', enum: ['meta'], description: 'Currently only Meta supports budget scaling' },
          adSetId:            { type: 'string', description: 'Meta ad set ID (not campaign ID) to update' },
          newDailyBudgetUsd:  { type: 'number', description: 'New daily budget in USD. Omit to apply a default +20% increase based on current spend.' },
          currentDailyBudgetUsd: { type: 'number', description: 'Current daily budget in USD — required when newDailyBudgetUsd is not provided' },
        },
        required: ['userId', 'network', 'adSetId'],
      },
      handler: async (input) => {
        if (!adNetwork) return { error: 'AdNetworkService not available' };
        const userId = input.userId as string;
        const adSetId = input.adSetId as string;
        let newBudgetUsd = input.newDailyBudgetUsd as number | undefined;

        if (!newBudgetUsd) {
          const current = input.currentDailyBudgetUsd as number | undefined;
          if (!current) return { error: 'Provide either newDailyBudgetUsd or currentDailyBudgetUsd for +20% scaling' };
          newBudgetUsd = current * 1.2;
        }

        // Meta API expects budget in cents
        const newBudgetCents = Math.round(newBudgetUsd * 100);
        await adNetwork.scaleMetaBudget(userId, adSetId, newBudgetCents);
        return { scaled: true, adSetId, newDailyBudgetUsd: newBudgetUsd, newDailyBudgetCents: newBudgetCents, scaledAt: new Date().toISOString() };
      },
    },
  ];
}
