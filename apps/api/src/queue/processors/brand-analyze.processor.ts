import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../queue.constants';
import { BrandService, BrandAnalysisStageKey } from '../../brand/brand.service';

interface BrandAnalyzePayload {
  jobId: string;
  userId: string;
  websiteUrl: string;
}

@Injectable()
export class BrandAnalyzeProcessor {
  private readonly logger = new Logger(BrandAnalyzeProcessor.name);
  private worker: Worker;

  constructor(
    private readonly brand: BrandService,
    private readonly configService: ConfigService,
  ) {}

  initialize(): void {
    const connection = {
      host: this.configService.get<string>('redis.host', 'localhost'),
      port: this.configService.get<number>('redis.port', 6379),
      password: this.configService.get<string>('redis.password'),
    };

    this.worker = new Worker(
      QUEUE_NAMES.BRAND_ANALYZE,
      async (job: Job<BrandAnalyzePayload>) => this.process(job),
      {
        connection,
        concurrency: 2,
        // Brand analysis is long-running (multi-page crawl + Gemini calls).
        // Allow up to 10 minutes per attempt.
        lockDuration: 600_000,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`BrandAnalyze job ${job.id} (jobId=${job.data.jobId}) completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`BrandAnalyze job ${job?.id} failed: ${err.message}`);
      const data = job?.data;
      if (data?.jobId) {
        this.brand.markJobFailed(data.jobId, err.message ?? 'Unknown error').catch(() => null);
      }
    });

    this.logger.log('✅ BrandAnalyzeProcessor worker started');
  }

  async process(job: Job<BrandAnalyzePayload>): Promise<void> {
    const { jobId, userId, websiteUrl } = job.data;

    if (job.name !== JOB_NAMES.BRAND_ANALYZE_WEBSITE) {
      this.logger.warn(`Unknown brand-analyze job name: ${job.name}`);
      return;
    }

    await this.brand.markJobStarted(jobId, job.id ?? undefined);

    const draft = await this.brand.runDraftPipeline(
      userId,
      websiteUrl,
      async (key: BrandAnalysisStageKey, phase, error) => {
        await this.brand.updateJobStage(jobId, key, phase, error);
      },
    );

    // Final stage marker — finalize is a no-op aside from progress UI
    await this.brand.updateJobStage(jobId, 'finalize', 'start');
    await this.brand.markJobAwaitingReview(jobId, draft);
    await this.brand.updateJobStage(jobId, 'finalize', 'end');
  }

  async close(): Promise<void> {
    await this.worker?.close();
  }
}
