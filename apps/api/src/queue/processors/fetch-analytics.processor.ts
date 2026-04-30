import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../queue.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { PluginRegistryService } from '../../plugins/plugin-registry.service';
import { EncryptionService } from '../../encryption/encryption.service';
import { EventBusService } from '../../events/event-bus.service';
import { NotImplementedError } from '../../plugins/platform-plugin.interface';

interface FetchAnalyticsPayload {
  publishedPostId: string;
  platform: string;
  connectionId: string;
  userId: string;
}

@Injectable()
export class FetchAnalyticsProcessor {
  private readonly logger = new Logger(FetchAnalyticsProcessor.name);
  private worker: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly plugins: PluginRegistryService,
    private readonly encryption: EncryptionService,
    private readonly eventBus: EventBusService,
    private readonly configService: ConfigService,
  ) {}

  initialize(): void {
    const connection = {
      host: this.configService.get<string>('redis.host', 'localhost'),
      port: this.configService.get<number>('redis.port', 6379),
      password: this.configService.get<string>('redis.password'),
    };

    this.worker = new Worker(
      QUEUE_NAMES.FETCH_ANALYTICS,
      async (job: Job<FetchAnalyticsPayload>) => this.process(job),
      { connection, concurrency: 10 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`FetchAnalytics job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('✅ FetchAnalyticsProcessor worker started');
  }

  async process(job: Job<FetchAnalyticsPayload>): Promise<void> {
    if (job.name !== JOB_NAMES.FETCH_POST_ANALYTICS) return;

    const { publishedPostId, platform, connectionId, userId } = job.data;

    const connection = await this.prisma.platformConnection.findUnique({ where: { id: connectionId } });
    if (!connection) return;

    const plugin = this.plugins.getPlugin(platform);
    if (!plugin) return;

    const tokens = {
      accessToken: this.encryption.decrypt(connection.accessToken),
      refreshToken: connection.refreshToken ? this.encryption.decrypt(connection.refreshToken) : undefined,
    };

    const publishedPost = await this.prisma.publishedPost.findUnique({ where: { id: publishedPostId } });
    if (!publishedPost?.platformPostId) return;

    try {
      const analytics = await plugin.fetchPostAnalytics(publishedPost.platformPostId, tokens);

      await this.prisma.publishedPost.update({
        where: { id: publishedPostId },
        data: {
          impressions: analytics.impressions,
          reach: analytics.reach,
          likes: analytics.likes,
          comments: analytics.comments,
          shares: analytics.shares,
          saves: analytics.saves,
          clicks: analytics.clicks,
          videoViews: analytics.videoViews,
          engagementRate: analytics.engagementRate,
          lastAnalyticsFetch: new Date(),
        },
      });

      await this.eventBus.emitAnalyticsUpdated({
        payload: {
          publishedPostId,
          platform,
          userId,
          metrics: analytics,
          capturedAt: new Date().toISOString(),
        },
      });

      this.logger.debug(`Analytics updated for ${publishedPostId}`);
    } catch (err) {
      if (err instanceof NotImplementedError) {
        this.logger.debug(`Analytics fetch stub for ${platform} — skipping`);
        return;
      }
      throw err;
    }
  }

  async close(): Promise<void> {
    await this.worker?.close();
  }
}
