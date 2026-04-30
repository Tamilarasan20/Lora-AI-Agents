import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: string, platform?: string) {
    const where: any = { userId };
    if (platform) where.platform = platform;

    const [posts, totals] = await Promise.all([
      this.prisma.publishedPost.count({ where }),
      this.prisma.publishedPost.aggregate({
        where,
        _sum: { impressions: true, reach: true, likes: true, comments: true, shares: true, saves: true, clicks: true, videoViews: true },
        _avg: { engagementRate: true },
      }),
    ]);

    const tierCounts = await this.prisma.publishedPost.groupBy({
      by: ['performanceTier'],
      where,
      _count: true,
    });

    return {
      totalPosts: posts,
      totals: totals._sum,
      avgEngagementRate: Number(totals._avg.engagementRate ?? 0).toFixed(3),
      performanceTiers: Object.fromEntries(tierCounts.map((t: any) => [t.performanceTier, t._count])),
    };
  }

  async getPostPerformance(userId: string, opts: {
    platform?: string; from?: string; to?: string; page: number; limit: number; sortBy: string;
  }) {
    const { platform, from, to, page, limit, sortBy } = opts;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (platform) where.platform = platform;
    if (from || to) {
      where.publishedAt = {};
      if (from) where.publishedAt.gte = new Date(from);
      if (to) where.publishedAt.lte = new Date(to);
    }

    const orderMap: Record<string, object> = {
      engagementRate: { engagementRate: 'desc' },
      impressions: { impressions: 'desc' },
      publishedAt: { publishedAt: 'desc' },
    };

    const [items, total] = await Promise.all([
      this.prisma.publishedPost.findMany({
        where,
        orderBy: orderMap[sortBy] ?? { publishedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, platform: true, platformPostId: true, platformUrl: true,
          publishedAt: true, impressions: true, reach: true, likes: true,
          comments: true, shares: true, saves: true, clicks: true,
          videoViews: true, engagementRate: true, performanceTier: true,
        },
      }),
      this.prisma.publishedPost.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getPlatformBreakdown(userId: string) {
    const byPlatform = await this.prisma.publishedPost.groupBy({
      by: ['platform'],
      where: { userId },
      _count: true,
      _avg: { engagementRate: true },
      _sum: { impressions: true, reach: true },
    });

    return byPlatform.map((p: any) => ({
      platform: p.platform,
      posts: p._count,
      avgEngagementRate: Number(p._avg.engagementRate ?? 0).toFixed(3),
      totalImpressions: p._sum.impressions,
      totalReach: p._sum.reach,
    }));
  }

  async getTimeSeries(userId: string, platform?: string, days = 30) {
    const from = new Date(Date.now() - days * 86_400_000);
    return this.prisma.$queryRaw<Array<{ date: string; posts: number; avg_engagement: number; total_impressions: number }>>`
      SELECT
        DATE_TRUNC('day', published_at)::date::text AS date,
        COUNT(*)::int                               AS posts,
        AVG(CAST(engagement_rate AS FLOAT))         AS avg_engagement,
        SUM(impressions)::int                       AS total_impressions
      FROM published_posts
      WHERE user_id = ${userId}::uuid
        AND published_at >= ${from}
        ${platform ? this.prisma.$queryRaw`AND platform = ${platform}` : this.prisma.$queryRaw``}
      GROUP BY DATE_TRUNC('day', published_at)
      ORDER BY date ASC
    `;
  }

  async getTopPosts(userId: string, platform?: string, limit = 10) {
    const where: any = { userId };
    if (platform) where.platform = platform;

    return this.prisma.publishedPost.findMany({
      where,
      orderBy: { engagementRate: 'desc' },
      take: limit,
      select: {
        id: true, platform: true, platformUrl: true, publishedAt: true,
        impressions: true, reach: true, engagementRate: true, performanceTier: true,
      },
    });
  }
}
