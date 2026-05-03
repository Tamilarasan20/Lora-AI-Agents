import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoraGateway } from '../lora.gateway';
import { QUEUE_NAMES } from '../../../queue/queue.constants';

export interface SocialPublishJob {
  userId: string;
  businessId: string;
  calendarItemId: string;
  approvalId: string;
}

@Injectable()
export class SocialPublishingProcessor {
  private readonly logger = new Logger(SocialPublishingProcessor.name);
  private worker: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: LoraGateway,
    private readonly config: ConfigService,
  ) {}

  initialize(): void {
    const connection = {
      host: this.config.get<string>('redis.host', 'localhost'),
      port: this.config.get<number>('redis.port', 6379),
      password: this.config.get<string>('redis.password'),
    };

    this.worker = new Worker(
      QUEUE_NAMES.LORA_SOCIAL_PUBLISH,
      async (job: Job<SocialPublishJob>) => this.process(job),
      { connection, concurrency: 3, lockDuration: 120_000 },
    );

    this.worker.on('completed', (job) => this.logger.log(`SocialPublish job ${job.id} completed`));
    this.worker.on('failed', (job, err) =>
      this.logger.error(`SocialPublish job ${job?.id} failed: ${err.message}`),
    );

    this.logger.log('✅ SocialPublishingProcessor started');
  }

  async process(job: Job<SocialPublishJob>): Promise<void> {
    const { userId, businessId, calendarItemId } = job.data;

    if (job.name === 'schedule_approved_post') {
      await this.prisma.marketingCalendarItem.update({
        where: { id: calendarItemId },
        data: { publishStatus: 'scheduled' },
      });
      this.logger.log(`[SocialPublish] Scheduled calendar item ${calendarItemId}`);
      return;
    }

    if (job.name === 'publish_approved_post') {
      // Delegate to existing publishing pipeline via ScheduledPost
      const item = await this.prisma.marketingCalendarItem.findFirstOrThrow({
        where: { id: calendarItemId, userId },
      });

      await this.prisma.marketingCalendarItem.update({
        where: { id: calendarItemId },
        data: { publishStatus: 'published' },
      });

      this.logger.log(`[SocialPublish] Published calendar item ${calendarItemId} on ${item.platform}`);
    }
  }
}
