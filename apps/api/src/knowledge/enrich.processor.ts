import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../queue/queue.constants';
import { KnowledgeService } from './knowledge.service';
import { SeoService } from '../seo/seo.service';
import { VisualService } from '../visual/visual.service';

interface EnrichJob {
  crawlId: string;
  projectId: string;
  userId: string;
}

@Injectable()
export class EnrichProcessor {
  private readonly logger = new Logger(EnrichProcessor.name);
  private worker: Worker;

  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly seoService: SeoService,
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
      QUEUE_NAMES.AKE_ENRICH,
      async (job: Job<EnrichJob>) => this.process(job),
      { connection, concurrency: 1 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Enrich job ${job?.id} failed: ${err.message}`, err.stack);
    });

    this.logger.log('✅ EnrichProcessor worker started');
  }

  private async process(job: Job<EnrichJob>): Promise<void> {
    const { crawlId, projectId, userId } = job.data;
    this.logger.log(`Starting enrichment pipeline for project ${projectId}`);

    // Run knowledge base + SEO in parallel, visual separately (image-heavy)
    await Promise.allSettled([
      this.knowledgeService.generateForProject(userId, crawlId, projectId).catch((err) =>
        this.logger.error(`Knowledge generation failed: ${err.message}`),
      ),
      this.seoService.generateForProject(userId, projectId, crawlId).catch((err) =>
        this.logger.error(`SEO generation failed: ${err.message}`),
      ),
    ]);

    // Queue visual analysis (async, non-blocking)
    await this.visualService.queueImagesForProject(userId, projectId, crawlId).catch((err) =>
      this.logger.warn(`Visual queuing failed: ${err.message}`),
    );

    this.logger.log(`Enrichment pipeline complete for project ${projectId}`);
  }

  async close(): Promise<void> {
    await this.worker?.close();
  }
}
