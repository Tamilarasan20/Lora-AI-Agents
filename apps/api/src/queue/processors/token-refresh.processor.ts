import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../queue.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaService } from '../../meta/meta.service';

interface TokenRefreshPayload {
  connectionId: string;
  userId: string;
  jobId: string; // TokenRefreshJob DB id
}

@Injectable()
export class TokenRefreshProcessor {
  private readonly logger = new Logger(TokenRefreshProcessor.name);
  private worker: Worker;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MetaService))
    private readonly metaService: MetaService,
    private readonly configService: ConfigService,
  ) {}

  initialize(): void {
    const connection = {
      host: this.configService.get<string>('redis.host', 'localhost'),
      port: this.configService.get<number>('redis.port', 6379),
      password: this.configService.get<string>('redis.password'),
    };

    this.worker = new Worker(
      QUEUE_NAMES.REFRESH_TOKEN,
      async (job: Job<TokenRefreshPayload>) => this.process(job),
      {
        connection,
        concurrency: 3,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Token refresh job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Token refresh job ${job?.id} failed: ${err.message}`);
      if (job?.data?.jobId) {
        this.markJobFailed(job.data.jobId, err.message).catch(() => null);
      }
    });

    this.logger.log('✅ TokenRefreshProcessor worker started');
  }

  async process(job: Job<TokenRefreshPayload>): Promise<void> {
    if (job.name !== JOB_NAMES.REFRESH_PLATFORM_TOKEN) return;

    const { connectionId, userId, jobId } = job.data;
    this.logger.log(`Refreshing token for connection ${connectionId}`);

    await this.prisma.tokenRefreshJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', lastAttemptAt: new Date(), attempts: { increment: 1 } },
    });

    try {
      await this.metaService.refreshToken(connectionId);

      await this.prisma.tokenRefreshJob.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      await this.prisma.notification.create({
        data: {
          userId,
          type: 'TOKEN_EXPIRED',
          title: 'Instagram token refreshed',
          body: 'Your Instagram access has been automatically renewed.',
          metadata: { connectionId },
        },
      }).catch(() => null);
    } catch (err) {
      const message = (err as Error).message;
      await this.markJobFailed(jobId, message);

      await this.prisma.platformConnection.update({
        where: { id: connectionId },
        data: { connectionStatus: 'EXPIRED' },
      }).catch(() => null);

      await this.prisma.notification.create({
        data: {
          userId,
          type: 'TOKEN_EXPIRED',
          title: 'Instagram reconnection required',
          body: 'Your Instagram access token could not be refreshed. Please reconnect your account.',
          metadata: { connectionId, error: message },
        },
      }).catch(() => null);

      throw err; // let BullMQ retry with exponential backoff
    }
  }

  async close(): Promise<void> {
    await this.worker?.close();
  }

  private async markJobFailed(jobId: string, error: string): Promise<void> {
    await this.prisma.tokenRefreshJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', error },
    }).catch(() => null);
  }
}
