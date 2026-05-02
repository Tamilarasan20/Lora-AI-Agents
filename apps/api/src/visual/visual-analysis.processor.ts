import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../queue/queue.constants';
import { VisualService } from './visual.service';

interface AnalyzeImageJob {
  userId: string;
  projectId: string;
  imageUrl: string;
}

@Injectable()
export class VisualAnalysisProcessor {
  private readonly logger = new Logger(VisualAnalysisProcessor.name);
  private worker: Worker;

  constructor(
    private readonly visualService: VisualService,
    private readonly config: ConfigService,
  ) {}

  initialize(): void {
    const connection = {
      host: this.config.get<string>('redis.host', 'localhost'),
      port: this.config.get<number>('redis.port', 6379),
      password: this.config.get<string>('redis.password'),
    };

    this.worker = new Worker(
      QUEUE_NAMES.AKE_VISUAL,
      async (job: Job<AnalyzeImageJob>) => {
        if (job.name !== JOB_NAMES.AKE_ANALYZE_IMAGE) return;
        await this.visualService.analyzeAndStore(job.data.userId, job.data.projectId, job.data.imageUrl);
      },
      { connection, concurrency: 5 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.warn(`VisualAnalysis job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('✅ VisualAnalysisProcessor worker started');
  }

  async close(): Promise<void> {
    await this.worker?.close();
  }
}
