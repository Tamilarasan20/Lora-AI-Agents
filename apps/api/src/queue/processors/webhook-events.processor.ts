import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../queue.constants';
import { MetaWebhookService, MetaWebhookBody } from '../../meta/meta-webhook.service';

interface WebhookEventJobData {
  webhookEventId: string;
  body: MetaWebhookBody;
}

@Injectable()
export class WebhookEventsProcessor {
  private readonly logger = new Logger(WebhookEventsProcessor.name);
  private worker: Worker;

  constructor(
    @Inject(forwardRef(() => MetaWebhookService))
    private readonly webhookService: MetaWebhookService,
    private readonly configService: ConfigService,
  ) {}

  initialize(): void {
    const connection = {
      host: this.configService.get<string>('redis.host', 'localhost'),
      port: this.configService.get<number>('redis.port', 6379),
      password: this.configService.get<string>('redis.password'),
    };

    this.worker = new Worker(
      QUEUE_NAMES.WEBHOOK_EVENTS,
      async (job: Job<WebhookEventJobData>) => this.process(job),
      {
        connection,
        concurrency: 10,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.debug(`Webhook event ${job.id} processed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Webhook event ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('✅ WebhookEventsProcessor worker started');
  }

  async process(job: Job<WebhookEventJobData>): Promise<void> {
    if (job.name !== JOB_NAMES.PROCESS_WEBHOOK_EVENT) return;
    const { webhookEventId, body } = job.data;
    await this.webhookService.processWebhookEvent(webhookEventId, body);
  }

  async close(): Promise<void> {
    await this.worker?.close();
  }
}
