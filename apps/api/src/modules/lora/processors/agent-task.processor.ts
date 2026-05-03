import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job, Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgentsService } from '../../../modules/agents/agents.service';
import { SteveService } from '../../../modules/agents/steve/steve.service';
import { LoraGateway } from '../lora.gateway';
import { QUEUE_NAMES } from '../../../queue/queue.constants';
import { Prisma } from '@prisma/client';

export interface AgentTaskJob {
  userId: string;
  businessId: string;
  conversationId: string;
  strategyId: string;
  taskId: string;
}

@Injectable()
export class LoraAgentTaskProcessor {
  private readonly logger = new Logger(LoraAgentTaskProcessor.name);
  private worker: Worker;
  private reviewQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly agents: AgentsService,
    private readonly steve: SteveService,
    private readonly gateway: LoraGateway,
    private readonly config: ConfigService,
  ) {}

  initialize(): void {
    const connection = {
      host: this.config.get<string>('redis.host', 'localhost'),
      port: this.config.get<number>('redis.port', 6379),
      password: this.config.get<string>('redis.password'),
    };

    this.reviewQueue = new Queue(QUEUE_NAMES.LORA_REVIEW, { connection });

    this.worker = new Worker(
      QUEUE_NAMES.LORA_AGENT_TASK,
      async (job: Job<AgentTaskJob>) => this.process(job),
      { connection, concurrency: 10, lockDuration: 180_000 },
    );

    this.worker.on('completed', (job) => this.logger.log(`AgentTask job ${job.id} (${job.name}) completed`));
    this.worker.on('failed', (job, err) => {
      this.logger.error(`AgentTask job ${job?.id} (${job?.name}) failed: ${err.message}`);
      if (job?.data) this.handleFailure(job.data, job.name, err.message);
    });

    this.logger.log('✅ LoraAgentTaskProcessor started');
  }

  async process(job: Job<AgentTaskJob>): Promise<void> {
    const { userId, businessId, conversationId, taskId } = job.data;

    const task = await this.prisma.marketingTask.findFirstOrThrow({ where: { id: taskId } });

    await this.prisma.marketingTask.update({ where: { id: taskId }, data: { status: 'in_progress' } });
    await this.prisma.marketingStrategy.updateMany({
      where: { id: task.strategyId ?? undefined, status: 'draft' },
      data: { status: 'active' },
    });

    this.gateway.emitAgentTaskStarted(userId, { taskId, agentName: task.assignedAgent, title: task.title });

    let outputContent: unknown;

    switch (job.name) {
      case 'run_sam_research':
        outputContent = await this.agents.runSam(task.description, userId, businessId);
        break;

      case 'run_clara_content':
        outputContent = await this.agents.runClara(task.description, userId, businessId);
        break;

      case 'run_steve_image_generation':
      case 'run_steve_carousel_generation': {
        const steveOutput = await this.agents.runSteve(task.description, userId, businessId);
        outputContent = steveOutput;

        const brand = await this.prisma.brandKnowledge.findUnique({ where: { userId } });
        const brandContext = brand ? {
          brandName: brand.brandName ?? undefined,
          colors: (brand.brandColors as Record<string, string>
            ? Object.values(brand.brandColors as Record<string, string>) : []),
          visualStyle: (brand.visualIntelligence as Record<string, unknown>)?.style as string | undefined,
          audience: brand.targetAudience ?? undefined,
        } : undefined;

        if (steveOutput.carouselSlides?.length) {
          const slides = await this.steve.generateCarousel({
            userId, businessId,
            campaignId: task.campaignId ?? undefined,
            taskId,
            platform: steveOutput.platform,
            brandContext,
            slides: steveOutput.carouselSlides.map((s) => ({
              slideNumber: s.slideNumber,
              slideGoal: s.slideGoal,
              headline: s.headline,
              supportingText: s.supportingText,
              imagePrompt: s.imagePrompt,
            })),
          });
          outputContent = { ...steveOutput, generatedSlides: slides };
        } else if (steveOutput.imagePrompts?.length) {
          const assets = await this.steve.generateVisualAsset({
            userId, businessId,
            campaignId: task.campaignId ?? undefined,
            taskId,
            platform: steveOutput.platform,
            creativeType: steveOutput.creativeType,
            prompt: steveOutput.imagePrompts[0],
            brandContext,
            count: 1,
          });
          outputContent = { ...steveOutput, generatedAssets: assets };
        }
        break;
      }

      case 'run_sarah_schedule_plan':
        outputContent = await this.agents.runSarah(task.description, userId, businessId);
        break;

      default:
        outputContent = { message: `Task processed by ${task.assignedAgent}` };
    }

    const output = await this.prisma.agentOutput.create({
      data: {
        userId, businessId,
        taskId,
        agentName: task.assignedAgent,
        outputType: this.inferOutputType(task.assignedAgent),
        content: outputContent as Prisma.InputJsonValue,
        status: 'needs_review',
      },
    });

    await this.prisma.marketingTask.update({
      where: { id: taskId },
      data: { status: 'pending_approval', outputId: output.id },
    });

    this.gateway.emitAgentTaskCompleted(userId, { taskId, agentName: task.assignedAgent, outputId: output.id });

    // Queue Lora review
    await this.reviewQueue.add(
      'review_agent_output',
      { userId, businessId, conversationId, outputId: output.id, taskId, strategyId: task.strategyId },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );
  }

  private async handleFailure(data: AgentTaskJob, jobName: string, error: string) {
    await this.prisma.marketingTask.update({
      where: { id: data.taskId },
      data: { status: 'needs_revision' },
    }).catch(() => null);
    this.gateway.emitAgentTaskFailed(data.userId, { taskId: data.taskId, jobName, error });
  }

  private inferOutputType(agent: string): string {
    const map: Record<string, string> = {
      Sam: 'trend_analysis', Clara: 'written_content',
      Steve: 'visual_concept', Sarah: 'social_schedule',
    };
    return map[agent] ?? 'general';
  }
}
