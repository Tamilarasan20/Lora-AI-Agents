import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Queue, Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../queue.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../encryption/encryption.service';
import { PluginRegistryService } from '../../plugins/plugin-registry.service';
import { AudienceInsights, NotImplementedError } from '../../plugins/platform-plugin.interface';

interface SyncInsightsPayload {
  connectionId: string;
  userId: string;
  platform: string;
}

@Injectable()
export class SyncAudienceAnalyticsProcessor {
  private readonly logger = new Logger(SyncAudienceAnalyticsProcessor.name);
  private worker: Worker;
  private queue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly plugins: PluginRegistryService,
    private readonly configService: ConfigService,
  ) {}

  initialize(): void {
    const connection = {
      host: this.configService.get<string>('redis.host', 'localhost'),
      port: this.configService.get<number>('redis.port', 6379),
      password: this.configService.get<string>('redis.password'),
    };

    // Queue for individual sync jobs
    this.queue = new Queue(QUEUE_NAMES.SYNC_AUDIENCE_ANALYTICS, {
      connection,
      defaultJobOptions: { removeOnComplete: { count: 500 }, removeOnFail: { count: 500 } },
    });

    // Worker that does the actual platform API fetch
    this.worker = new Worker(
      QUEUE_NAMES.SYNC_AUDIENCE_ANALYTICS,
      async (job: Job<SyncInsightsPayload>) => this.processOne(job),
      { connection, concurrency: 5 },
    );

    this.worker.on('completed', (job) => {
      this.logger.debug(`Synced audience insights: ${job.data.platform}/${job.data.connectionId}`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Sync failed for ${job?.data.platform}: ${err.message}`);
    });

    this.logger.log('✅ SyncAudienceAnalyticsProcessor worker started');
  }

  /**
   * Called by the scheduler every 6 hours.
   * Enqueues one sync job per active platform connection.
   */
  async enqueueAllConnections(): Promise<void> {
    const connections = await this.prisma.platformConnection.findMany({
      where: { connectionStatus: 'ACTIVE' },
      select: { id: true, userId: true, platform: true },
    });

    this.logger.log(`Enqueuing audience analytics sync for ${connections.length} connections`);

    const jobs = connections.map((c: any) => ({
      name: JOB_NAMES.SYNC_PLATFORM_INSIGHTS,
      data: { connectionId: c.id, userId: c.userId, platform: c.platform } satisfies SyncInsightsPayload,
    }));

    // BullMQ addBulk for efficiency — one DB round-trip to Redis
    await this.queue.addBulk(jobs);
  }

  private async processOne(job: Job<SyncInsightsPayload>): Promise<void> {
    const { connectionId, userId, platform } = job.data;

    const connection = await this.prisma.platformConnection.findUnique({
      where: { id: connectionId },
    });
    if (!connection || connection.connectionStatus !== 'ACTIVE') return;

    const plugin = this.plugins.getPlugin(platform);
    if (!plugin) {
      this.logger.warn(`No plugin for platform: ${platform}`);
      return;
    }

    const credentials = {
      accessToken: this.encryption.decrypt(connection.accessToken),
      refreshToken: connection.refreshToken
        ? this.encryption.decrypt(connection.refreshToken)
        : undefined,
      platformUserId: connection.platformUserId ?? undefined,
    };

    let insights: AudienceInsights;
    try {
      insights = await plugin.fetchAudienceInsights(credentials);
    } catch (err) {
      if (err instanceof NotImplementedError) {
        // Plugin stub — use the base fallback which resolves instead of throwing
        insights = await plugin.fetchAudienceInsights(credentials).catch(() => null as never);
        if (!insights) return;
      } else {
        throw err;
      }
    }

    // Compute the best UTC hour from merged signals:
    // 1. Followers online right now (platform API)
    // 2. Historical engagement rate per hour (from our own published_posts)
    const mergedHourlyScore = await this.computeMergedHourlyScore(userId, platform, insights);

    // Upsert into platform_audience_insights
    await this.prisma.platformAudienceInsights.upsert({
      where: { connectionId },
      create: {
        connectionId,
        userId,
        platform,
        hourlyOnlineFollowers: insights.hourlyOnlineFollowers,
        hourlyEngagementRate: insights.hourlyEngagementRate,
        dailyEngagementMultiplier: insights.dailyEngagementMultiplier,
        platformRecommendedTimes: insights.platformRecommendedTimes,
        followerCount: insights.followerCount,
        topAgeRange: insights.topAgeRange,
        topGender: insights.topGender,
        topCountry: insights.topCountries[0]?.name,
        topCity: insights.topCities?.[0]?.name,
        avgDailyImpressions: insights.avgDailyImpressions,
        avgDailyReach: insights.avgDailyReach,
        avgEngagementRate: insights.avgEngagementRate,
        fetchedAt: insights.fetchedAt,
      },
      update: {
        hourlyOnlineFollowers: insights.hourlyOnlineFollowers,
        hourlyEngagementRate: insights.hourlyEngagementRate,
        dailyEngagementMultiplier: insights.dailyEngagementMultiplier,
        platformRecommendedTimes: insights.platformRecommendedTimes,
        followerCount: insights.followerCount,
        topAgeRange: insights.topAgeRange,
        topGender: insights.topGender,
        topCountry: insights.topCountries[0]?.name,
        topCity: insights.topCities?.[0]?.name,
        avgDailyImpressions: insights.avgDailyImpressions,
        avgDailyReach: insights.avgDailyReach,
        avgEngagementRate: insights.avgEngagementRate,
        fetchedAt: insights.fetchedAt,
      },
    });

    // Also refresh the SchedulingInsight rollup table (used for quick queries)
    await this.upsertSchedulingInsights(userId, platform, mergedHourlyScore);
  }

  /**
   * Merges platform-reported online followers with brand's own historical
   * engagement rate per hour to produce a composite score 0-1 per UTC hour.
   *
   * Formula:
   *   score(h) = 0.4 × normalised_online_followers(h)
   *            + 0.6 × normalised_engagement_rate(h)
   *
   * The 60/40 weighting favours actual engagement over raw online presence
   * because a smaller engaged audience is more valuable than a large passive one.
   */
  private async computeMergedHourlyScore(
    userId: string,
    platform: string,
    insights: AudienceInsights,
  ): Promise<Array<{ hour: number; dayOfWeek: number; score: number }>> {
    // Pull brand's own post performance grouped by hour + day from TimescaleDB
    const ownAnalytics = await this.prisma.$queryRaw<
      Array<{ day_of_week: number; hour_of_day: number; avg_engagement: number; sample_count: number }>
    >`
      SELECT
        EXTRACT(DOW  FROM published_at AT TIME ZONE 'UTC')::int AS day_of_week,
        EXTRACT(HOUR FROM published_at AT TIME ZONE 'UTC')::int AS hour_of_day,
        AVG(CAST(engagement_rate AS FLOAT))                      AS avg_engagement,
        COUNT(*)::int                                            AS sample_count
      FROM published_posts
      WHERE user_id    = ${userId}::uuid
        AND platform   = ${platform}
        AND published_at > NOW() - INTERVAL '90 days'
      GROUP BY day_of_week, hour_of_day
    `;

    // Normalise online-follower values 0→1
    const followerValues = Object.values(insights.hourlyOnlineFollowers);
    const maxFollowers = Math.max(...followerValues, 1);
    const normFollowers = (h: number): number =>
      (insights.hourlyOnlineFollowers[String(h)] ?? 0) / maxFollowers;

    // Normalise own engagement rate values 0→1
    const engRateMap: Record<string, number> = {};
    for (const row of ownAnalytics) {
      const key = `${row.day_of_week}_${row.hour_of_day}`;
      engRateMap[key] = row.avg_engagement;
    }
    const engValues = Object.values(engRateMap);
    const maxEng = Math.max(...engValues, 0.001);
    const normEng = (dow: number, h: number): number =>
      (engRateMap[`${dow}_${h}`] ?? 0) / maxEng;

    // Apply day-of-week multiplier from platform insights
    const dowMultiplier = (dow: number): number =>
      insights.dailyEngagementMultiplier[String(dow)] ?? 1.0;

    // Build combined score matrix for all 7 days × 24 hours
    const scores: Array<{ hour: number; dayOfWeek: number; score: number }> = [];
    for (let dow = 0; dow < 7; dow++) {
      for (let h = 0; h < 24; h++) {
        const combined = (0.4 * normFollowers(h) + 0.6 * normEng(dow, h)) * dowMultiplier(dow);
        scores.push({ hour: h, dayOfWeek: dow, score: parseFloat(combined.toFixed(4)) });
      }
    }

    return scores;
  }

  /**
   * Writes the merged scores into SchedulingInsight for fast lookup by Sarah's tool.
   */
  private async upsertSchedulingInsights(
    userId: string,
    platform: string,
    scores: Array<{ hour: number; dayOfWeek: number; score: number }>,
  ): Promise<void> {
    // Batch upsert — Prisma doesn't support createMany with onConflict yet for all providers,
    // so we use raw SQL for efficiency
    for (const { hour, dayOfWeek, score } of scores) {
      await this.prisma.$executeRaw`
        INSERT INTO scheduling_insights
          (id, user_id, platform, day_of_week, hour_of_day, avg_engagement_rate, confidence_score, created_at, updated_at)
        VALUES
          (gen_random_uuid(), ${userId}::uuid, ${platform}, ${dayOfWeek}, ${hour},
           ${score}::numeric(6,3), 1.0, NOW(), NOW())
        ON CONFLICT (user_id, platform, day_of_week, hour_of_day)
        DO UPDATE SET
          avg_engagement_rate = EXCLUDED.avg_engagement_rate,
          confidence_score    = EXCLUDED.confidence_score,
          updated_at          = NOW()
      `;
    }
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
