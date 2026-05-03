import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgentsService } from '../../../modules/agents/agents.service';
import { LoraGateway } from '../lora.gateway';
import { QUEUE_NAMES } from '../../../queue/queue.constants';
import { Prisma } from '@prisma/client';

export interface ReviewOutputJob {
  userId: string;
  businessId: string;
  conversationId: string;
  outputId: string;
  taskId: string;
  strategyId?: string | null;
}

@Injectable()
export class LoraReviewProcessor {
  private readonly logger = new Logger(LoraReviewProcessor.name);
  private worker: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly agents: AgentsService,
    private readonly gateway: LoraGateway,
    private readonly config: ConfigService,
  ) {}

  initialize(): void {
    const connection = {
      host: this.config.get<string>('redis.host', 'localhost'),
      port: this.config.get<number>('redis.port', 6379),
      password: this.config.get<string>('redis.password'),
    };

    this.worker = new Worker(
      QUEUE_NAMES.LORA_REVIEW,
      async (job: Job<ReviewOutputJob>) => this.process(job),
      { connection, concurrency: 10, lockDuration: 120_000 },
    );

    this.worker.on('completed', (job) => this.logger.log(`LoraReview job ${job.id} completed`));
    this.worker.on('failed', (job, err) =>
      this.logger.error(`LoraReview job ${job?.id} failed: ${err.message}`),
    );

    this.logger.log('✅ LoraReviewProcessor started');
  }

  async process(job: Job<ReviewOutputJob>): Promise<void> {
    const { userId, businessId, conversationId, outputId, taskId, strategyId } = job.data;

    const output = await this.prisma.agentOutput.findFirstOrThrow({ where: { id: outputId } });
    const strategy = strategyId
      ? await this.prisma.marketingStrategy.findUnique({ where: { id: strategyId } })
      : null;

    this.gateway.emitOutputReviewed(userId, { outputId, status: 'reviewing' });

    const review = await this.agents.runLoraReview(
      output.content,
      strategy?.goal ?? 'marketing task',
      userId,
      businessId,
    );

    await this.prisma.agentOutput.update({
      where: { id: outputId },
      data: {
        qualityScore: review.qualityScore,
        brandFitScore: review.brandFitScore,
        goalAlignmentScore: review.goalAlignmentScore,
        reviewNotes: review.notes,
        reviewedByLora: true,
        status: review.approved ? 'pending_approval' : 'needs_revision',
      },
    });

    if (review.approved) {
      const approval = await this.prisma.approval.upsert({
        where: { outputId },
        create: {
          userId, businessId, outputId,
          type: output.outputType,
          status: 'pending',
          requestedBy: 'Lora',
        },
        update: { status: 'pending', updatedAt: new Date() },
      });

      this.gateway.emitApprovalPending(userId, { approvalId: approval.id, outputId, conversationId });

      await this.prisma.loraMessage.create({
        data: {
          conversationId, userId, businessId,
          role: 'lora', agentName: 'Lora',
          content: `✅ ${output.agentName} finished. Quality: ${review.qualityScore}/100 · Brand fit: ${review.brandFitScore}/100. ${review.notes} Ready for your approval.`,
          metadata: {
            approvalId: approval.id,
            outputId,
            scores: {
              quality: review.qualityScore,
              brandFit: review.brandFitScore,
              goalAlignment: review.goalAlignmentScore,
            },
          } as Prisma.InputJsonValue,
        },
      });
    } else {
      await this.prisma.loraMessage.create({
        data: {
          conversationId, userId, businessId,
          role: 'lora', agentName: 'Lora',
          content: `${output.agentName}'s output needs revision. ${review.notes}`,
          metadata: { outputId, requiredChanges: review.requiredChanges } as Prisma.InputJsonValue,
        },
      });
    }

    this.gateway.emitOutputReviewed(userId, {
      outputId,
      approved: review.approved,
      qualityScore: review.qualityScore,
      brandFitScore: review.brandFitScore,
      notes: review.notes,
    });
  }
}
