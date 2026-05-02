import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../queue.constants';
import { ClaraAgent, ContentBrief } from '../../agents/clara/clara.agent';
import { MarkAgent } from '../../agents/mark/mark.agent';
import { SarahAgent, EngagementItem } from '../../agents/sarah/sarah.agent';
import { EventBusService } from '../../events/event-bus.service';
import { KAFKA_TOPICS } from '../../events/event.types';

interface AgentTaskPayload {
  taskId: string;
  userId: string;
  brandId: string;
  agentType: 'CLARA' | 'SARAH' | 'MARK';
  taskType: string;
  input: Record<string, unknown>;
}

@Injectable()
export class AgentTaskProcessor {
  private readonly logger = new Logger(AgentTaskProcessor.name);
  private worker: Worker;

  constructor(
    private readonly clara: ClaraAgent,
    private readonly mark: MarkAgent,
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
      QUEUE_NAMES.AGENT_TASK,
      async (job: Job<AgentTaskPayload>) => this.process(job),
      { connection, concurrency: 3 },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`AgentTask job ${job.id} (${job.data.agentType}) completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`AgentTask job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('✅ AgentTaskProcessor worker started');
  }

  async process(job: Job<AgentTaskPayload>): Promise<void> {
    const { taskId, userId, brandId, agentType, taskType, input } = job.data;
    const startedAt = Date.now();

    let result: { output: string; tokensUsed: number };

    switch (job.name) {
      case JOB_NAMES.CLARA_GENERATE_CONTENT:
        result = await this.clara.generateContent(input as unknown as ContentBrief);
        break;

      case JOB_NAMES.CLARA_ADAPT_PLATFORM:
        result = await this.clara.adaptForPlatform(
          input.masterCaption as string,
          input.platform as string,
          input.brand as Parameters<typeof this.clara.adaptForPlatform>[2],
        );
        break;

      case JOB_NAMES.SARAH_PROCESS_ENGAGEMENT:
        result = await this.sarah.processEngagement(input as unknown as EngagementItem);
        break;

      case JOB_NAMES.MARK_ANALYZE_TRENDS:
        result = await this.mark.analyzeTrends(
          input as unknown as Parameters<typeof this.mark.analyzeTrends>[0],
        );
        break;

      case JOB_NAMES.MARK_GENERATE_REPORT:
        result = await this.mark.generateReport(
          input as unknown as Parameters<typeof this.mark.generateReport>[0],
        );
        break;

      default:
        this.logger.warn(`Unknown agent task job: ${job.name}`);
        return;
    }

    await this.eventBus.emit(KAFKA_TOPICS.AGENT_TASK_COMPLETED, {
      eventType: 'agent.task.completed',
      correlationId: taskId,
      userId,
      brandId,
      payload: {
        taskId,
        agentType,
        userId,
        durationMs: Date.now() - startedAt,
        outputSummary: result.output.slice(0, 500),
        tokensUsed: result.tokensUsed,
      },
    });
  }

  async close(): Promise<void> {
    await this.worker?.close();
  }
}
