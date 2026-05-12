import { ToolDefinition } from '../base-agent';

/**
 * Elena's tools — UTM generation, budget validation, optimisation-rule
 * evaluation. These are deterministic helpers the agent can call to make
 * its outputs concrete and consistent.
 */
export function buildElenaTools(): ToolDefinition[] {
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
  ];
}
