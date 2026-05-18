import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../queue.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { FacebookPageService, FbPostType } from '../../facebook/facebook-page.service';

interface FacebookPublishPayload {
  facebookPostDbId: string;
  facebookPageDbId: string;
  userId: string;
  type: FbPostType;
  message?: string;
  link?: string;
  mediaUrls?: string[];
}

@Injectable()
export class FacebookPublishProcessor {
  private readonly logger = new Logger(FacebookPublishProcessor.name);
  private worker: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fbPage: FacebookPageService,
    private readonly configService: ConfigService,
  ) {}

  initialize(): void {
    const connection = {
      host: this.configService.get<string>('redis.host', 'localhost'),
      port: this.configService.get<number>('redis.port', 6379),
      password: this.configService.get<string>('redis.password'),
    };

    this.worker = new Worker(
      QUEUE_NAMES.FACEBOOK_PUBLISH,
      async (job: Job<FacebookPublishPayload>) => this.process(job),
      { connection, concurrency: 3 },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Facebook publish job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Facebook publish job ${job?.id} failed: ${err.message}`);
      if (job?.data?.facebookPostDbId) {
        this.markFailed(job.data.facebookPostDbId, err.message).catch(() => null);
      }
    });

    this.logger.log('✅ FacebookPublishProcessor worker started');
  }

  async process(job: Job<FacebookPublishPayload>): Promise<void> {
    if (job.name !== JOB_NAMES.FACEBOOK_PUBLISH_POST) return;

    const { facebookPostDbId, facebookPageDbId, userId, type, message, link, mediaUrls } = job.data;

    await this.prisma.facebookPost.update({
      where: { id: facebookPostDbId },
      data: { status: 'PUBLISHING' },
    });

    try {
      const { postId } = await this.fbPage.publishNow({
        facebookPageDbId,
        userId,
        type,
        message,
        link,
        mediaUrls,
      });

      await this.prisma.facebookPost.update({
        where: { id: facebookPostDbId },
        data: { status: 'PUBLISHED', pagePostId: postId, publishedAt: new Date() },
      });
    } catch (err) {
      await this.markFailed(facebookPostDbId, (err as Error).message);
      throw err;
    }
  }

  async close(): Promise<void> {
    await this.worker?.close();
  }

  private async markFailed(postDbId: string, error: string): Promise<void> {
    await this.prisma.facebookPost.update({
      where: { id: postDbId },
      data: { status: 'FAILED', lastError: error },
    }).catch(() => null);
  }
}
