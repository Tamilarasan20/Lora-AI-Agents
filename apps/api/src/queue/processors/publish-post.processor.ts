import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../queue.constants';
import { PublisherService, PublishJobPayload } from '../publisher/publisher.service';

@Injectable()
export class PublishPostProcessor {
  private readonly logger = new Logger(PublishPostProcessor.name);
  private worker: Worker;

  constructor(
    private readonly publisher: PublisherService,
    private readonly configService: ConfigService,
  ) {}

  initialize(): void {
    const connection = {
      host: this.configService.get<string>('redis.host', 'localhost'),
      port: this.configService.get<number>('redis.port', 6379),
      password: this.configService.get<string>('redis.password'),
    };

    this.worker = new Worker(
      QUEUE_NAMES.PUBLISH_POST,
      async (job: Job<PublishJobPayload>) => this.process(job),
      {
        connection,
        concurrency: 5,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`PublishPost job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`PublishPost job ${job?.id} failed: ${err.message}`, err.stack);
    });

    this.logger.log('✅ PublishPostProcessor worker started');
  }

  async process(job: Job<PublishJobPayload>): Promise<void> {
    if (job.name !== JOB_NAMES.PUBLISH_SCHEDULED_POST) {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return;
    }

    this.logger.log(`Processing publish job ${job.id}: platform=${job.data.platform}`);
    const outcome = await this.publisher.publish(job.data);

    if (!outcome.success) {
      throw new Error(outcome.error ?? 'Publish failed');
    }
  }

  async close(): Promise<void> {
    await this.worker?.close();
  }
}
