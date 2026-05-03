import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoraOrchestrator } from './lora.orchestrator';
import { QueueService } from '../../queue/queue.service';
import { CreateStrategyDto } from './dto/create-strategy.dto';
import { ApprovalActionDto, RunAgentTaskDto } from './dto/review-output.dto';
import { LoraChatDto } from './dto/lora-chat.dto';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { Prisma } from '@prisma/client';

@Injectable()
export class LoraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: LoraOrchestrator,
    private readonly queue: QueueService,
  ) {}

  // ─── Chat ─────────────────────────────────────────────────────────────────

  async chat(dto: LoraChatDto, userId: string) {
    // Resolve or create conversation
    let conversation = dto.conversationId
      ? await this.prisma.loraConversation.findFirst({
          where: { id: dto.conversationId, userId },
        })
      : null;

    if (!conversation) {
      conversation = await this.prisma.loraConversation.create({
        data: {
          userId,
          businessId: dto.businessId,
          title: dto.message.slice(0, 200),
          status: 'active',
          updatedAt: new Date(),
        },
      });
    }

    // Save user message
    await this.prisma.loraMessage.create({
      data: {
        conversationId: conversation.id,
        userId,
        businessId: dto.businessId,
        role: 'user',
        content: dto.message,
        metadata: {} as Prisma.InputJsonValue,
      },
    });

    // Queue async workflow — respond instantly
    const jobId = await this.queue.addJob(
      QUEUE_NAMES.LORA_STRATEGY,
      'create_strategy_from_chat',
      { userId, businessId: dto.businessId, conversationId: conversation.id, message: dto.message },
      { attempts: 3, backoff: { type: 'exponential' as const, delay: 3000 } },
    );

    // Update conversation with jobId
    await this.prisma.loraConversation.update({
      where: { id: conversation.id },
      data: { jobId, updatedAt: new Date() },
    });

    return {
      conversationId: conversation.id,
      jobId,
      status: 'queued',
      message: "Lora is on it. I'll update you as the team gets to work.",
    };
  }

  async getConversation(conversationId: string, userId: string) {
    const conv = await this.prisma.loraConversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  async listConversations(userId: string) {
    return this.prisma.loraConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    });
  }

  // ─── Strategy ────────────────────────────────────────────────────────────

  async createStrategy(dto: CreateStrategyDto, userId: string) {
    return this.orchestrator.createMarketingStrategy(dto, userId);
  }

  async getStrategy(strategyId: string, userId: string) {
    const s = await this.prisma.marketingStrategy.findFirst({
      where: { id: strategyId, userId },
      include: {
        campaigns: true,
        tasks: { include: { assignments: true, outputs: true } },
      },
    });
    if (!s) throw new NotFoundException('Strategy not found');
    return s;
  }

  async listStrategies(userId: string) {
    return this.prisma.marketingStrategy.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async updateStrategyStatus(
    strategyId: string,
    status: 'active' | 'paused' | 'completed' | 'archived',
    userId: string,
  ) {
    const s = await this.prisma.marketingStrategy.findFirst({ where: { id: strategyId, userId } });
    if (!s) throw new NotFoundException('Strategy not found');
    return this.prisma.marketingStrategy.update({ where: { id: strategyId }, data: { status } });
  }

  // ─── Agent Tasks ──────────────────────────────────────────────────────────

  async runAgentTask(taskId: string, agentName: string, userId: string) {
    return this.orchestrator.runAgentTask(taskId, agentName, userId);
  }

  async listTasks(userId: string, status?: string) {
    return this.prisma.marketingTask.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { assignments: true },
    });
  }

  // ─── Content / Outputs ──────────────────────────────────────────────────

  async reviewOutput(outputId: string, taskId: string, userId: string) {
    const task = await this.prisma.marketingTask.findFirst({ where: { id: taskId, userId } });
    if (!task) throw new NotFoundException('Task not found');
    const output = await this.prisma.agentOutput.findFirst({ where: { id: outputId, userId } });
    if (!output) throw new NotFoundException('Output not found');
    return { output, task };
  }

  async getOutput(outputId: string, userId: string) {
    const output = await this.prisma.agentOutput.findFirst({ where: { id: outputId, userId } });
    if (!output) throw new NotFoundException('Output not found');
    const revisions = await this.prisma.contentRevision.findMany({
      where: { outputId },
      orderBy: { version: 'desc' },
    });
    return { output, revisions };
  }

  async updateOutputContent(outputId: string, content: unknown, userId: string) {
    const output = await this.prisma.agentOutput.findFirst({ where: { id: outputId, userId } });
    if (!output) throw new NotFoundException('Output not found');

    // Count existing revisions to set version number
    const count = await this.prisma.contentRevision.count({ where: { outputId } });

    await this.prisma.contentRevision.create({
      data: {
        userId,
        businessId: output.businessId,
        outputId,
        version: count + 1,
        content: content as Prisma.InputJsonValue,
        editedBy: userId,
      },
    });

    return this.prisma.agentOutput.update({
      where: { id: outputId },
      data: { content: content as Prisma.InputJsonValue },
    });
  }

  async approveOutput(outputId: string, userId: string, notes?: string) {
    return this.orchestrator.approveOutput(outputId, userId, notes);
  }

  async rejectOutput(outputId: string, userId: string, notes?: string) {
    return this.orchestrator.rejectOutput(outputId, userId, notes);
  }

  // ─── Approvals ───────────────────────────────────────────────────────────

  async listApprovals(userId: string) {
    return this.prisma.approval.findMany({
      where: { userId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: { output: true },
    });
  }

  // ─── Creative Assets ─────────────────────────────────────────────────────

  async listAssets(userId: string, filters: { campaignId?: string; platform?: string; status?: string }) {
    return this.prisma.creativeAsset.findMany({
      where: {
        userId,
        ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
        ...(filters.platform ? { platform: filters.platform } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        NOT: { assetUrl: '' },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getAsset(assetId: string, userId: string) {
    const asset = await this.prisma.creativeAsset.findFirst({ where: { id: assetId, userId } });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async deleteAsset(assetId: string, userId: string) {
    const asset = await this.prisma.creativeAsset.findFirst({ where: { id: assetId, userId } });
    if (!asset) throw new NotFoundException('Asset not found');
    return this.prisma.creativeAsset.delete({ where: { id: assetId } });
  }

  // ─── Calendar ────────────────────────────────────────────────────────────

  async getCalendar(userId: string, from?: string, to?: string) {
    return this.prisma.marketingCalendarItem.findMany({
      where: {
        userId,
        ...(from && to ? { scheduledAt: { gte: new Date(from), lte: new Date(to) } } : {}),
      },
      orderBy: { scheduledAt: 'asc' },
      take: 100,
    });
  }

  async scheduleCalendarItem(itemId: string, scheduledAt: string, userId: string) {
    const item = await this.prisma.marketingCalendarItem.findFirst({ where: { id: itemId, userId } });
    if (!item) throw new NotFoundException('Calendar item not found');
    if (item.approvalStatus !== 'approved') throw new Error('Item must be approved before scheduling');

    const updated = await this.prisma.marketingCalendarItem.update({
      where: { id: itemId },
      data: { scheduledAt: new Date(scheduledAt), publishStatus: 'scheduled' },
    });

    await this.queue.addJob(
      QUEUE_NAMES.LORA_SOCIAL_PUBLISH,
      'schedule_approved_post',
      { userId, businessId: item.businessId, calendarItemId: itemId, approvalId: '' },
      {},
    );

    return updated;
  }

  // ─── Credits ────────────────────────────────────────────────────────────

  async getCreditUsage(userId: string) {
    const usage = await this.prisma.agentCreditUsage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const total = usage.reduce((sum, u) => sum + u.credits, 0);

    const byAgent = usage.reduce<Record<string, number>>((acc, u) => {
      acc[u.agentName] = (acc[u.agentName] ?? 0) + u.credits;
      return acc;
    }, {});

    const byStrategy: Record<string, number> = {};
    for (const u of usage) {
      const meta = u.metadata as Record<string, unknown>;
      if (meta?.strategyId && typeof meta.strategyId === 'string') {
        byStrategy[meta.strategyId] = (byStrategy[meta.strategyId] ?? 0) + u.credits;
      }
    }

    return { total, byAgent, byStrategy, transactions: usage };
  }

  // ─── Dashboard ──────────────────────────────────────────────────────────

  async getDashboard(userId: string) {
    return this.orchestrator.getDashboard(userId);
  }

  // ─── Competitors ────────────────────────────────────────────────────────

  async listCompetitors(userId: string, businessId: string) {
    return this.prisma.competitorWatchlistItem.findMany({
      where: { userId, businessId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addCompetitor(userId: string, businessId: string, data: { name: string; websiteUrl?: string; notes?: string }) {
    return this.prisma.competitorWatchlistItem.create({
      data: { userId, businessId, name: data.name, websiteUrl: data.websiteUrl, notes: data.notes, updatedAt: new Date() },
    });
  }

  async removeCompetitor(id: string, userId: string) {
    return this.prisma.competitorWatchlistItem.updateMany({
      where: { id, userId },
      data: { status: 'archived' },
    });
  }
}
