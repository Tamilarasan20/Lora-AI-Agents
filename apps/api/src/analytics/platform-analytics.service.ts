import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { NickContentItem } from '../agents/nick/nick.agent';

export interface AnalyticsFetchOptions {
  userId: string;
  platforms?: string[];  // filter to specific platforms; empty = all connected
  sinceDate?: Date;
  limit?: number;
}

@Injectable()
export class PlatformAnalyticsService {
  private readonly logger = new Logger(PlatformAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async fetchAll(opts: AnalyticsFetchOptions): Promise<NickContentItem[]> {
    const connections = await this.prisma.platformConnection.findMany({
      where: {
        userId: opts.userId,
        connectionStatus: 'ACTIVE',
        ...(opts.platforms?.length ? { platform: { in: opts.platforms.map(p => p.toLowerCase()) } } : {}),
      },
    });

    const settled = await Promise.allSettled(
      connections.map(conn => this.fetchForConnection(conn, opts)),
    );

    const items: NickContentItem[] = [];
    for (const r of settled) {
      if (r.status === 'fulfilled') items.push(...r.value);
      else this.logger.warn(`Analytics fetch failed: ${r.reason}`);
    }
    return items;
  }

  private async fetchForConnection(conn: any, opts: AnalyticsFetchOptions): Promise<NickContentItem[]> {
    const accessToken = this.encryption.decrypt(conn.accessToken);
    const limit = opts.limit ?? 25;
    switch (conn.platform.toLowerCase()) {
      case 'instagram': return this.fetchInstagram(conn, accessToken, limit);
      case 'tiktok':    return this.fetchTikTok(conn, accessToken, limit);
      case 'x':
      case 'twitter':   return this.fetchX(conn, accessToken, opts.sinceDate, limit);
      case 'linkedin':  return this.fetchLinkedIn(conn, accessToken, limit);
      default:
        this.logger.debug(`No analytics adapter for platform: ${conn.platform}`);
        return [];
    }
  }

  // ── Instagram Graph API ────────────────────────────────────────────────────

  private async fetchInstagram(conn: any, token: string, limit: number): Promise<NickContentItem[]> {
    try {
      const mediaRes = await fetch(
        `https://graph.facebook.com/v19.0/${conn.platformUserId}/media?fields=id,caption,timestamp,like_count,comments_count,media_type&limit=${limit}&access_token=${token}`,
      );
      const media = await mediaRes.json() as any;
      if (media.error) throw new Error(media.error.message);

      const items: NickContentItem[] = [];
      for (const post of (media.data ?? []) as any[]) {
        const insRes = await fetch(
          `https://graph.facebook.com/v19.0/${post.id}/insights?metric=impressions,reach,saved&period=lifetime&access_token=${token}`,
        );
        const ins = await insRes.json() as any;
        const m: Record<string, number> = {};
        for (const x of (ins.data ?? []) as any[]) m[x.name] = x.values?.[0]?.value ?? 0;

        items.push({
          id: post.id,
          source: post.media_type === 'VIDEO' ? 'video' : 'organic-post',
          platform: 'instagram',
          title: (post.caption as string | undefined)?.slice(0, 100),
          publishedAt: post.timestamp as string,
          metrics: { impressions: m.impressions, reach: m.reach, likes: post.like_count as number, comments: post.comments_count as number, saves: m.saved },
          meta: { format: (post.media_type as string | undefined)?.toLowerCase() },
        });
      }
      return items;
    } catch (err) {
      this.logger.error(`Instagram analytics error: ${err}`);
      return [];
    }
  }

  // ── TikTok Analytics API ───────────────────────────────────────────────────

  private async fetchTikTok(conn: any, token: string, limit: number): Promise<NickContentItem[]> {
    try {
      const res = await fetch(
        'https://open.tiktokapis.com/v2/video/list/?fields=id,title,create_time,like_count,comment_count,share_count,view_count,average_time_watched,reach',
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ max_count: limit }),
        },
      );
      const data = await res.json() as any;
      if (data.error?.code !== 'ok') throw new Error(data.error?.message ?? 'TikTok API error');

      return ((data.data?.videos ?? []) as any[]).map(v => ({
        id: v.id as string,
        source: 'video' as const,
        platform: 'tiktok',
        title: (v.title as string | undefined)?.slice(0, 100),
        publishedAt: new Date((v.create_time as number) * 1000).toISOString(),
        metrics: { impressions: v.view_count as number, reach: v.reach as number, likes: v.like_count as number, comments: v.comment_count as number, shares: v.share_count as number, watchTimeSec: v.average_time_watched as number },
        meta: { format: 'video' },
      }));
    } catch (err) {
      this.logger.error(`TikTok analytics error: ${err}`);
      return [];
    }
  }

  // ── X (Twitter) API v2 ─────────────────────────────────────────────────────

  private async fetchX(conn: any, token: string, since: Date | undefined, limit: number): Promise<NickContentItem[]> {
    try {
      const startTime = (since ?? new Date(Date.now() - 30 * 86400000)).toISOString();
      const res = await fetch(
        `https://api.twitter.com/2/users/${conn.platformUserId}/tweets?max_results=${Math.min(limit, 100)}&start_time=${startTime}&tweet.fields=public_metrics,created_at,text`,
        { headers: { 'Authorization': `Bearer ${token}` } },
      );
      const data = await res.json() as any;
      if (data.errors) throw new Error(data.errors[0]?.message ?? 'X API error');

      return ((data.data ?? []) as any[]).map(t => ({
        id: t.id as string,
        source: 'organic-post' as const,
        platform: 'x',
        title: (t.text as string | undefined)?.slice(0, 100),
        publishedAt: t.created_at as string,
        metrics: { impressions: t.public_metrics?.impression_count as number, likes: t.public_metrics?.like_count as number, comments: t.public_metrics?.reply_count as number, shares: t.public_metrics?.retweet_count as number, clicks: t.public_metrics?.url_link_clicks as number },
        meta: { format: 'tweet' },
      }));
    } catch (err) {
      this.logger.error(`X analytics error: ${err}`);
      return [];
    }
  }

  // ── LinkedIn UGC API ───────────────────────────────────────────────────────

  private async fetchLinkedIn(conn: any, token: string, limit: number): Promise<NickContentItem[]> {
    try {
      const postsRes = await fetch(
        `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent(conn.platformUserId)})&count=${limit}`,
        { headers: { 'Authorization': `Bearer ${token}`, 'LinkedIn-Version': '202401' } },
      );
      const posts = await postsRes.json() as any;
      if (posts.status === 401) throw new Error('LinkedIn token expired');

      const items: NickContentItem[] = [];
      for (const post of (posts.elements ?? []) as any[]) {
        const statsRes = await fetch(
          `https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(conn.platformUserId)}&shares=List(${encodeURIComponent(post.id)})`,
          { headers: { 'Authorization': `Bearer ${token}`, 'LinkedIn-Version': '202401' } },
        );
        const stats = ((await statsRes.json() as any).elements?.[0]?.totalShareStatistics) ?? {};
        items.push({
          id: post.id as string,
          source: 'organic-post' as const,
          platform: 'linkedin',
          title: (post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text as string | undefined)?.slice(0, 100),
          publishedAt: new Date(post.created?.time as number).toISOString(),
          metrics: { impressions: stats.impressionCount as number, clicks: stats.clickCount as number, likes: stats.likeCount as number, comments: stats.commentCount as number, shares: stats.shareCount as number },
          meta: { format: 'post' },
        });
      }
      return items;
    } catch (err) {
      this.logger.error(`LinkedIn analytics error: ${err}`);
      return [];
    }
  }
}
