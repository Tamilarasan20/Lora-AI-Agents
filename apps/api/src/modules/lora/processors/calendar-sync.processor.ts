import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoraGateway } from '../lora.gateway';
import { QUEUE_NAMES } from '../../../queue/queue.constants';
import { Prisma } from '@prisma/client';

export interface CalendarSyncJob {
  userId: string;
  businessId: string;
  conversationId: string;
  strategyId: string;
  calendarItems: Array<{
    title: string;
    platform: string;
    contentType: string;
    assignedTo: string;
    status: string;
    scheduledAt?: string;
    campaignId?: string;
  }>;
}

@Injectable()
export class CalendarSyncProcessor {
  private readonly logger = new Logger(CalendarSyncProcessor.name);
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
      QUEUE_NAMES.LORA_CALENDAR_SYNC,
      async (job: Job<CalendarSyncJob>) => this.process(job),
      { connection, concurrency: 5 },
    );

    this.worker.on('completed', (job) => this.logger.log(`CalendarSync job ${job.id} completed`));
    this.worker.on('failed', (job, err) =>
      this.logger.error(`CalendarSync job ${job?.id} failed: ${err.message}`),
    );

    this.logger.log('✅ CalendarSyncProcessor started');
  }

  async process(job: Job<CalendarSyncJob>): Promise<void> {
    const { userId, businessId, conversationId, strategyId, calendarItems } = job.data;

    const created = await Promise.all(
      calendarItems.map((item) =>
        this.prisma.marketingCalendarItem.create({
          data: {
            userId, businessId,
            campaignId: item.campaignId ?? null,
            title: item.title,
            platform: item.platform,
            contentType: item.contentType,
            assignedAgent: item.assignedTo,
            scheduledAt: item.scheduledAt ? new Date(item.scheduledAt) : null,
            publishStatus: 'draft',
            approvalStatus: 'pending',
            assetIds: [] as Prisma.InputJsonValue,
          },
        }),
      ),
    );

    this.gateway.emitCalendarUpdated(userId, { conversationId, items: created });
    this.logger.log(`[CalendarSync] Created ${created.length} calendar items for strategy=${strategyId}`);
  }
}
