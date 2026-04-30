import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, QueueOptions } from 'bullmq';
import {
  QUEUE_NAMES,
  QueueName,
  DEFAULT_JOB_OPTIONS,
} from './queue.constants';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private queues = new Map<QueueName, Queue>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const connection = this.getRedisConnection();
    for (const name of Object.values(QUEUE_NAMES)) {
      const queue = new Queue(name, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
      this.queues.set(name as QueueName, queue);
    }
    this.logger.log(`✅ Initialized ${this.queues.size} BullMQ queues`);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    this.logger.log('BullMQ queues closed');
  }

  getQueue(name: QueueName): Queue {
    const queue = this.queues.get(name);
    if (!queue) throw new Error(`Queue "${name}" not found`);
    return queue;
  }

  async addJob<T extends Record<string, unknown>>(
    queueName: QueueName,
    jobName: string,
    data: T,
    options?: Parameters<Queue['add']>[2],
  ): Promise<string> {
    const queue = this.getQueue(queueName);
    const job = await queue.add(jobName, data, options);
    this.logger.debug(`Job added: ${queueName}/${jobName} id=${job.id}`);
    return job.id ?? '';
  }

  async scheduleJob<T extends Record<string, unknown>>(
    queueName: QueueName,
    jobName: string,
    data: T,
    scheduledFor: Date,
  ): Promise<string> {
    const delay = Math.max(0, scheduledFor.getTime() - Date.now());
    return this.addJob(queueName, jobName, data, { delay });
  }

  async removeJob(queueName: QueueName, jobId: string): Promise<void> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (job) await job.remove();
  }

  async getJobStatus(queueName: QueueName, jobId: string) {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    return { id: job.id, state, progress: job.progress, failedReason: job.failedReason };
  }

  private getRedisConnection(): QueueOptions['connection'] {
    return {
      host: this.configService.get<string>('redis.host', 'localhost'),
      port: this.configService.get<number>('redis.port', 6379),
      password: this.configService.get<string>('redis.password'),
      db: this.configService.get<number>('redis.db', 0),
    };
  }
}
