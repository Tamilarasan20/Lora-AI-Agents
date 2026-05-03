import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job, Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoraOrchestrator } from '../lora.orchestrator';
import { LoraGateway } from '../lora.gateway';
import { QUEUE_NAMES } from '../../../queue/queue.constants';
import { Prisma } from '@prisma/client';

export interface CreateStrategyFromChatJob {
  userId: string;
  businessId: string;
  conversationId: string;
  message: string;
}

@Injectable()
export class LoraStrategyProcessor {
  private readonly logger = new Logger(LoraStrategyProcessor.name);
  private worker: Worker;
  private agentTaskQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: LoraOrchestrator,
    private readonly gateway: LoraGateway,
    private readonly config: ConfigService,
  ) {}

  initialize(): void {
    const connection = {
      host: this.config.get<string>('redis.host', 'localhost'),
      port: this.config.get<number>('redis.port', 6379),
      password: this.config.get<string>('redis.password'),
    };

    this.agentTaskQueue = new Queue(QUEUE_NAMES.LORA_AGENT_TASK, { connection });

    this.worker = new Worker(
      QUEUE_NAMES.LORA_STRATEGY,
      async (job: Job<CreateStrategyFromChatJob>) => this.process(job),
      { connection, concurrency: 5, lockDuration: 300_000 },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`LoraStrategy job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`LoraStrategy job ${job?.id} failed: ${err.message}`);
      if (job?.data) this.handleFailure(job.data, err.message);
    });

    this.logger.log('✅ LoraStrategyProcessor started');
  }

  async process(job: Job<CreateStrategyFromChatJob>): Promise<void> {
    const { userId, businessId, conversationId, message } = job.data;

    this.gateway.emitToUser(userId, 'lora.strategy.started', {
      conversationId,
      message: 'Lora is building your marketing strategy…',
    });

    await this.saveMessage(conversationId, userId, businessId, 'lora',
      'Got it. I\'m building your strategy now. Sam, Clara, Steve, and Sarah are standing by…', 'Lora');

    const result = await this.orchestrator.createMarketingStrategy(
      { businessId, goal: message },
      userId,
    );

    await this.prisma.loraConversation.update({
      where: { id: conversationId },
      data: {
        strategyId: result.strategyId,
        title: message.slice(0, 200),
        updatedAt: new Date(),
      },
    });

    this.gateway.emitStrategyCreated(userId, {
      conversationId,
      strategyId: result.strategyId,
      message: `Strategy created! I'm assigning ${result.tasks.length} tasks to the team.`,
    });

    await this.saveMessage(conversationId, userId, businessId, 'lora',
      `✅ Strategy created. I'm assigning ${result.tasks.length} tasks to ${
        [...new Set(result.tasks.map((t: any) => t.assignedAgent))].join(', ')
      }.`, 'Lora');

    for (const task of result.tasks) {
      const jobName = this.mapAgentToJob(task.assignedAgent);
      await this.agentTaskQueue.add(
        jobName,
        { userId, businessId, conversationId, strategyId: result.strategyId, taskId: task.id },
        { attempts: 3, backoff: { type: 'exponential', delay: 3000 } },
      );
    }

    this.gateway.emitToUser(userId, 'lora.task.created', {
      conversationId,
      taskCount: result.tasks.length,
      message: 'Tasks queued. Your team is getting to work.',
    });
  }

  private async handleFailure(data: CreateStrategyFromChatJob, error: string) {
    await this.saveMessage(data.conversationId, data.userId, data.businessId, 'system',
      `Something went wrong: ${error}. Please try again.`).catch(() => null);
    this.gateway.emitToUser(data.userId, 'workflow.failed', {
      conversationId: data.conversationId,
      error,
    });
  }

  private async saveMessage(
    conversationId: string, userId: string, businessId: string,
    role: string, content: string, agentName?: string,
  ) {
    return this.prisma.loraMessage.create({
      data: { conversationId, userId, businessId, role, content, agentName: agentName ?? null,
        metadata: {} as Prisma.InputJsonValue },
    });
  }

  private mapAgentToJob(agent: string): string {
    const map: Record<string, string> = {
      Sam: 'run_sam_research', Clara: 'run_clara_content',
      Steve: 'run_steve_image_generation', Sarah: 'run_sarah_schedule_plan',
    };
    return map[agent] ?? 'run_sam_research';
  }
}
