import { ToolDefinition } from '../base-agent';
import { PlatformAnalyticsService } from '../../analytics/platform-analytics.service';

/**
 * Nick's tools — performance math the LLM should not do by hand.
 *
 * Phase 1: in-process calculators. Phase 2 wires in Meta/Google Ads/GA4/
 * platform analytics APIs behind the same tool interface.
 *
 * @param analytics Optional PlatformAnalyticsService injected at runtime.
 *   When present, the fetch_platform_analytics tool is fully operational.
 */
export function buildNickTools(analytics?: PlatformAnalyticsService): ToolDefinition[] {
  return [
    {
      name: 'compute_engagement_rate',
      description:
        'Compute engagement rate as (likes + comments + shares + saves) / impressions for a single content item. Returns rate as a percentage and the raw counts.',
      inputSchema: {
        properties: {
          impressions: { type: 'number' },
          likes: { type: 'number' },
          comments: { type: 'number' },
          shares: { type: 'number' },
          saves: { type: 'number' },
        },
        required: ['impressions'],
      },
      handler: async (input) => {
        const imp = Number(input.impressions) || 0;
        const eng =
          (Number(input.likes) || 0) +
          (Number(input.comments) || 0) +
          (Number(input.shares) || 0) +
          (Number(input.saves) || 0);
        const rate = imp > 0 ? (eng / imp) * 100 : 0;
        return {
          impressions: imp,
          engagement: eng,
          engagement_rate_pct: Number(rate.toFixed(3)),
        };
      },
    },

    {
      name: 'rank_by_metric',
      description:
        'Sort an array of items by a numeric metric and return the top N. Items are objects with an id and a numeric field — Nick uses this to find winners and losers without rolling his own sort.',
      inputSchema: {
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                value: { type: 'number' },
              },
              required: ['id', 'value'],
            },
          },
          direction: { type: 'string', enum: ['desc', 'asc'] },
          limit: { type: 'number' },
        },
        required: ['items'],
      },
      handler: async (input) => {
        const items = (input.items as Array<{ id: string; value: number }>) ?? [];
        const direction = (input.direction as 'asc' | 'desc') ?? 'desc';
        const limit = Number(input.limit) || 5;
        const sorted = [...items].sort((a, b) =>
          direction === 'desc' ? b.value - a.value : a.value - b.value,
        );
        return { ranked: sorted.slice(0, limit) };
      },
    },

    {
      name: 'classify_verdict',
      description:
        'Classify an aggregate scorecard against a goal. Returns one of: crushing-it, on-track, underperforming, mixed. Useful when Nick needs a defensible overall verdict.',
      inputSchema: {
        properties: {
          avg_engagement_rate_pct: { type: 'number' },
          goal_engagement_rate_pct: { type: 'number' },
          winners_count: { type: 'number' },
          losers_count: { type: 'number' },
        },
        required: ['avg_engagement_rate_pct', 'goal_engagement_rate_pct'],
      },
      handler: async (input) => {
        const avg = Number(input.avg_engagement_rate_pct);
        const goal = Number(input.goal_engagement_rate_pct);
        const winners = Number(input.winners_count) || 0;
        const losers = Number(input.losers_count) || 0;

        let verdict: 'crushing-it' | 'on-track' | 'underperforming' | 'mixed';
        if (avg >= goal * 1.5) verdict = 'crushing-it';
        else if (avg >= goal * 0.85 && avg < goal * 1.5) verdict = 'on-track';
        else if (winners > 0 && losers > 0 && Math.abs(winners - losers) <= 2) verdict = 'mixed';
        else verdict = 'underperforming';

        return { verdict, ratio_to_goal: Number((avg / goal).toFixed(2)) };
      },
    },

    {
      name: 'fetch_platform_analytics',
      description:
        'Fetch real analytics data from all connected social platforms (Instagram, TikTok, X, LinkedIn) for a user. Returns NickContentItem[] array ready for analysis.',
      inputSchema: {
        properties: {
          userId: { type: 'string' },
          platforms: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter to specific platforms. Omit for all connected.',
          },
          sinceDate: {
            type: 'string',
            description: 'ISO date string. Default: 30 days ago.',
          },
          limit: {
            type: 'number',
            description: 'Max posts per platform. Default 25.',
          },
        },
        required: ['userId'],
      },
      handler: async (input) => {
        if (!analytics) return { error: 'PlatformAnalyticsService not available' };
        const items = await analytics.fetchAll({
          userId: input.userId as string,
          platforms: input.platforms as string[] | undefined,
          sinceDate: input.sinceDate ? new Date(input.sinceDate as string) : undefined,
          limit: input.limit as number | undefined,
        });
        return { count: items.length, items };
      },
    },
  ];
}
