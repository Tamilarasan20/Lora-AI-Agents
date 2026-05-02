import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ToolDefinition } from '../base-agent';

export function buildSarahTools(
  prisma: PrismaService,
  notifications?: NotificationsService,
): ToolDefinition[] {
  return [
    {
      name: 'get_optimal_posting_time',
      description:
        'Calculate the best time to publish on a platform. ' +
        'Merges three signals: (1) real-time audience online hours fetched from the platform API, ' +
        '(2) this brand\'s own historical engagement rate per hour, ' +
        '(3) platform day-of-week multipliers. Returns top 5 time slots ranked by composite score.',
      inputSchema: {
        properties: {
          platform:     { type: 'string', description: 'Target platform (instagram, twitter, etc.)' },
          userId:       { type: 'string', description: 'UUID of the brand owner' },
          timezone:     { type: 'string', description: 'IANA timezone string, e.g. America/New_York' },
          contentType:  { type: 'string', enum: ['image', 'video', 'carousel', 'text', 'story'] },
          lookAheadDays:{ type: 'number', description: 'Only suggest slots in the next N days (default 7)' },
        },
        required: ['platform', 'userId', 'timezone'],
      },
      handler: async (input) => {
        const { platform, userId, timezone } = input as {
          platform: string;
          userId: string;
          timezone: string;
          lookAheadDays?: number;
        };

        // ── 1. Read pre-computed SchedulingInsight rows (written by SyncAudienceAnalyticsProcessor)
        const insights = await prisma.schedulingInsight.findMany({
          where: { userId, platform },
          orderBy: { avgEngagementRate: 'desc' },
          take: 20,
        });

        // ── 2. Read raw platform audience data for additional context
        const audienceData = await prisma.platformAudienceInsights.findFirst({
          where: { userId, platform },
          orderBy: { fetchedAt: 'desc' },
        });

        // ── 3. Convert top SchedulingInsight rows to local time slots
        const tzOffset = getTimezoneOffsetHours(timezone);
        const now = new Date();

        const slots = insights.map((row: any) => {
          // Convert UTC hour to local hour
          const localHour = (row.hourOfDay + tzOffset + 24) % 24;
          const dayName = DAY_NAMES[row.dayOfWeek];

          // Find next occurrence of this day/hour that is in the future
          const nextDate = nextOccurrence(row.dayOfWeek, localHour, timezone);
          const hoursUntil = Math.round((nextDate.getTime() - now.getTime()) / 3_600_000);

          return {
            scheduledFor: nextDate.toISOString(),
            dayOfWeek: dayName,
            localHour: `${String(localHour).padStart(2, '0')}:00 ${timezone}`,
            utcHour: row.hourOfDay,
            compositeScore: Number(row.avgEngagementRate),
            confidenceScore: Number(row.confidenceScore),
            samplePosts: row.totalPosts,
            hoursFromNow: hoursUntil,
          };
        });

        // ── 4. Build context summary for Sarah's LLM reasoning
        const followerCount = audienceData?.followerCount ?? 0;
        const avgEngRate = audienceData?.avgEngagementRate ?? 0;
        const lastFetched = audienceData?.fetchedAt?.toISOString() ?? 'never';
        const dataAge = audienceData
          ? Math.round((now.getTime() - audienceData.fetchedAt.getTime()) / 3_600_000)
          : null;

        return {
          platform,
          timezone,
          topSlots: slots.slice(0, 5),
          audienceSummary: {
            followerCount,
            avgEngagementRate: Number(avgEngRate),
            topCountry: audienceData?.topCountry ?? null,
            topCity: audienceData?.topCity ?? null,
            topAgeRange: audienceData?.topAgeRange ?? null,
            topGender: audienceData?.topGender ?? null,
            dataFreshnessHours: dataAge,
            lastFetchedAt: lastFetched,
          },
          hasRealData: insights.length > 0,
          fallbackUsed: insights.length === 0,
          fallbackReason: insights.length === 0
            ? 'No historical data yet — using platform industry averages'
            : null,
          // If no real data, provide industry baseline so Sarah can still reason
          industryBaseline: insights.length === 0 ? PLATFORM_BASELINES[platform] ?? null : null,
        };
      },
    },

    {
      name: 'get_recent_post_performance',
      description:
        'Fetch the brand\'s last N published posts and their analytics to help Sarah understand ' +
        'what content is performing well and inform scheduling decisions.',
      inputSchema: {
        properties: {
          userId:   { type: 'string' },
          platform: { type: 'string' },
          limit:    { type: 'number', description: 'Number of posts (default 10, max 50)' },
        },
        required: ['userId', 'platform'],
      },
      handler: async (input) => {
        const { userId, platform } = input as { userId: string; platform: string; limit?: number };
        const limit = Math.min((input.limit as number) ?? 10, 50);

        const posts = await prisma.publishedPost.findMany({
          where: { userId, platform },
          orderBy: { publishedAt: 'desc' },
          take: limit,
          select: {
            id: true,
            publishedAt: true,
            impressions: true,
            reach: true,
            likes: true,
            comments: true,
            shares: true,
            saves: true,
            engagementRate: true,
            performanceTier: true,
          },
        });

        const avg = (arr: number[]) =>
          arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

        return {
          platform,
          postCount: posts.length,
          posts: posts.map((p: any) => ({
            publishedAt: p.publishedAt.toISOString(),
            dayOfWeek: DAY_NAMES[p.publishedAt.getUTCDay()],
            utcHour: p.publishedAt.getUTCHours(),
            engagementRate: Number(p.engagementRate),
            impressions: p.impressions,
            performanceTier: p.performanceTier,
          })),
          averages: {
            engagementRate: avg(posts.map((p: any) => Number(p.engagementRate))).toFixed(3),
            impressions: Math.round(avg(posts.map((p: any) => p.impressions))),
            likes: Math.round(avg(posts.map((p: any) => p.likes))),
            comments: Math.round(avg(posts.map((p: any) => p.comments))),
          },
        };
      },
    },

    {
      name: 'check_posting_cadence',
      description:
        'Check how many posts are already scheduled for a platform in the next N hours ' +
        'to avoid over-posting and audience fatigue.',
      inputSchema: {
        properties: {
          platform:      { type: 'string' },
          userId:        { type: 'string' },
          lookAheadHours:{ type: 'number', description: 'Window to check in hours (default 24)' },
        },
        required: ['platform', 'userId'],
      },
      handler: async (input) => {
        const { platform, userId } = input as { platform: string; userId: string; lookAheadHours?: number };
        const hours = (input.lookAheadHours as number) ?? 24;
        const windowEnd = new Date(Date.now() + hours * 3_600_000);

        const count = await prisma.scheduledPost.count({
          where: {
            userId,
            platform,
            scheduledAt: { lte: windowEnd, gte: new Date() },
            status: { in: ['SCHEDULED', 'PUBLISHING'] },
          },
        });

        const maxPerDay: Record<string, number> = {
          instagram: 3, twitter: 15, linkedin: 2, tiktok: 4,
          youtube: 2, facebook: 3, pinterest: 10, wordpress: 2,
        };
        const max = maxPerDay[platform] ?? 3;
        const dailyMax = Math.round(max * (hours / 24));

        return {
          platform,
          scheduledInWindow: count,
          windowHours: hours,
          dailyMax: max,
          windowMax: dailyMax,
          canPost: count < dailyMax,
          slotsRemaining: Math.max(0, dailyMax - count),
        };
      },
    },

    {
      name: 'analyze_engagement_sentiment',
      description: 'Analyze sentiment of a comment or DM and classify urgency.',
      inputSchema: {
        properties: {
          text:                { type: 'string' },
          platform:            { type: 'string' },
          authorFollowerCount: { type: 'number' },
        },
        required: ['text', 'platform'],
      },
      handler: async (input) => {
        const text = (input.text as string).toLowerCase();
        const negKw = ['bad', 'terrible', 'awful', 'hate', 'worst', 'disappointed', 'scam', 'fake'];
        const posKw = ['love', 'great', 'amazing', 'awesome', 'perfect', 'excellent'];
        const isNeg = negKw.some((k) => text.includes(k));
        const isPos = posKw.some((k) => text.includes(k));
        const score = isNeg ? -0.7 : isPos ? 0.8 : 0.1;
        return {
          sentiment: isNeg ? 'negative' : isPos ? 'positive' : 'neutral',
          score,
          urgency: isNeg ? 'high' : 'normal',
          escalate: score < -0.6,
        };
      },
    },

    {
      name: 'draft_reply',
      description: 'Structure a reply output target. Sarah generates the actual text in its response.',
      inputSchema: {
        properties: {
          originalComment: { type: 'string' },
          postContext:     { type: 'string' },
          brandTone:       { type: 'string' },
          authorUsername:  { type: 'string' },
          sentiment:       { type: 'string', enum: ['positive', 'neutral', 'negative'] },
        },
        required: ['originalComment', 'brandTone', 'sentiment'],
      },
      handler: async (input) => ({
        replyDraft: `@${(input.authorUsername as string) ?? 'there'} [Sarah generates reply here]`,
        tone: input.brandTone,
      }),
    },

    {
      name: 'flag_escalation',
      description: 'Create an escalation alert for a human moderator.',
      inputSchema: {
        properties: {
          engagementItemId: { type: 'string' },
          reason:    { type: 'string' },
          urgency:   { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          platform:  { type: 'string' },
          summary:   { type: 'string' },
        },
        required: ['engagementItemId', 'reason', 'urgency'],
      },
      handler: async (input) => {
        const { engagementItemId, reason, urgency, platform, summary } = input as {
          engagementItemId: string;
          reason: string;
          urgency: 'low' | 'medium' | 'high' | 'critical';
          platform?: string;
          summary?: string;
        };

        // Look up which user owns this engagement item so we can target the notification
        const item = await prisma.engagementItem.findUnique({
          where: { id: engagementItemId },
          select: { userId: true },
        });

        if (item?.userId && notifications) {
          const urgencyEmoji = { low: '🟡', medium: '🟠', high: '🔴', critical: '🚨' }[urgency] ?? '⚠️';
          await notifications.create(item.userId, {
            type: 'ESCALATION',
            title: `${urgencyEmoji} Escalation required${platform ? ` on ${platform}` : ''}`,
            message: summary ?? reason,
            metadata: { engagementItemId, reason, urgency, platform },
          });
        }

        return { escalated: true, engagementItemId, urgency };
      },
    },
  ];
}

// ── helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getTimezoneOffsetHours(tz: string): number {
  try {
    const now = new Date();
    const utcMs = now.getTime();
    const localStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    }).format(now);
    const utcStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hour: 'numeric',
      hour12: false,
    }).format(now);
    return parseInt(localStr, 10) - parseInt(utcStr, 10);
  } catch {
    return 0;
  }
}

function nextOccurrence(dayOfWeek: number, localHour: number, _timezone: string): Date {
  const now = new Date();
  const result = new Date(now);
  result.setMinutes(0, 0, 0);
  result.setHours(localHour);

  const currentDay = now.getDay();
  let daysAhead = dayOfWeek - currentDay;
  if (daysAhead < 0 || (daysAhead === 0 && result <= now)) daysAhead += 7;
  result.setDate(result.getDate() + daysAhead);
  return result;
}

// Industry-average baselines used when a brand has no post history yet
const PLATFORM_BASELINES: Record<string, { bestDays: string[]; bestHoursUTC: number[] }> = {
  instagram: { bestDays: ['Tuesday', 'Wednesday', 'Friday'], bestHoursUTC: [13, 14, 0] },
  twitter:   { bestDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'], bestHoursUTC: [12, 13, 17] },
  linkedin:  { bestDays: ['Tuesday', 'Wednesday', 'Thursday'], bestHoursUTC: [13, 14, 17] },
  tiktok:    { bestDays: ['Tuesday', 'Thursday', 'Friday', 'Saturday'], bestHoursUTC: [23, 2, 6] },
  youtube:   { bestDays: ['Saturday', 'Sunday'], bestHoursUTC: [19, 20, 15] },
  facebook:  { bestDays: ['Wednesday', 'Thursday', 'Friday'], bestHoursUTC: [17, 18, 13] },
  pinterest: { bestDays: ['Saturday', 'Sunday'], bestHoursUTC: [1, 2, 20] },
  wordpress: { bestDays: ['Tuesday', 'Thursday'], bestHoursUTC: [14, 15] },
};
