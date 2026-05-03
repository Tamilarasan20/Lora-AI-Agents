import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoraOrchestrator } from './lora.orchestrator';
import { CreateStrategyDto } from './dto/create-strategy.dto';

@Injectable()
export class LoraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: LoraOrchestrator,
  ) {}

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

  async runAgentTask(taskId: string, agentName: string, userId: string) {
    return this.orchestrator.runAgentTask(taskId, agentName, userId);
  }

  async reviewOutput(outputId: string, taskId: string, userId: string) {
    const task = await this.prisma.marketingTask.findFirst({ where: { id: taskId, userId } });
    if (!task) throw new NotFoundException('Task not found');
    const output = await this.prisma.agentOutput.findFirst({ where: { id: outputId, userId } });
    if (!output) throw new NotFoundException('Output not found');
    return { output, task };
  }

  async approveOutput(outputId: string, userId: string, notes?: string) {
    return this.orchestrator.approveOutput(outputId, userId, notes);
  }

  async rejectOutput(outputId: string, userId: string, notes?: string) {
    return this.orchestrator.rejectOutput(outputId, userId, notes);
  }

  async getDashboard(userId: string) {
    return this.orchestrator.getDashboard(userId);
  }

  async listTasks(userId: string, status?: string) {
    return this.prisma.marketingTask.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { assignments: true },
    });
  }

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

  async listApprovals(userId: string) {
    return this.prisma.approval.findMany({
      where: { userId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: { output: true },
    });
  }
}
