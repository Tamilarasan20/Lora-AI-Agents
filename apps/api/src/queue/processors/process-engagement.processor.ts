import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../queue.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { SarahAgent } from '../../agents/sarah/sarah.agent';
import { EventBusService } from '../../events/event-bus.service';

interface ProcessEngagementPayload {
  engagementItemId: string;
  platform: string;
  type: 'comment' | 'mention' | 'dm' | 'reply';
  text: string;
  authorUsername: string;
  authorFollowerCount?: number;
  postContext: string;
  brandTone: string;
  userId: string;
}

@Injectable()
export class ProcessEngagementProcessor {
  private readonly logger = new Logger(ProcessEngagementProcessor.name);
  private worker: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sarah: SarahAgent,
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
      QUEUE_NAMES.PROCESS_ENGAGEMENT,
      async (job: Job<ProcessEngagementPayload>) => this.process(job),
      { connection, concurrency: 20 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`ProcessEngagement job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('✅ ProcessEngagementProcessor worker started');
  }

  async process(job: Job<ProcessEngagementPayload>): Promise<void> {
    const validJobs = [JOB_NAMES.PROCESS_COMMENT, JOB_NAMES.PROCESS_MENTION, JOB_NAMES.PROCESS_DM];
    if (!validJobs.includes(job.name as (typeof validJobs)[number])) return;

    const data = job.data;
    this.logger.debug(`Processing engagement ${data.engagementItemId} (${data.type})`);

    const result = await this.sarah.processEngagement({
      id: data.engagementItemId,
      platform: data.platform,
      type: data.type,
      text: data.text,
      authorUsername: data.authorUsername,
      authorFollowerCount: data.authorFollowerCount,
      postContext: data.postContext,
      brandTone: data.brandTone,
    });

    // Parse Sarah's JSON output
    let parsed: {
      sentiment?: string;
      sentimentScore?: number;
      shouldEscalate?: boolean;
      escalationReason?: string;
      replyText?: string;
      replyApproved?: boolean;
    } = {};

    try {
      const jsonMatch = result.output.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      this.logger.warn(`Could not parse Sarah output for engagement ${data.engagementItemId}`);
    }

    // Persist analysis to DB
    await this.prisma.engagementItem.updateMany({
      where: { id: data.engagementItemId },
      data: {
        sentiment: (parsed.sentiment?.toUpperCase() as 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE') ?? 'NEUTRAL',
        sentimentScore: parsed.sentimentScore,
        escalated: parsed.shouldEscalate ?? false,
        replyText: parsed.replyText,
        replied: false,
      },
    });

    if (parsed.replyApproved && parsed.replyText) {
      await this.eventBus.emit(
        'loraloop.engagement.replied' as Parameters<typeof this.eventBus.emit>[0],
        {
          eventType: 'engagement.replied',
          payload: {
            engagementItemId: data.engagementItemId,
            replyText: parsed.replyText,
            repliedBy: 'AI',
            repliedAt: new Date().toISOString(),
          },
        },
      );
    }
  }

  async close(): Promise<void> {
    await this.worker?.close();
  }
}
