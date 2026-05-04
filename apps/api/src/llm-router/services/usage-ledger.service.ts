import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NormalizedLlmResponse } from '../adapters/llm-provider.interface';
import { RouterDecision } from '../schemas/router-decision.schema';

export interface LedgerCreateInput {
  workspaceId: string;
  userId:      string;
  requestId:   string;
  agentName?:  string;
  decision:    RouterDecision;
  selectedProvider: string;
  selectedModel:    string;
  estimatedCostUsd: number;
  creditsReserved:  number;
}

export interface LedgerCompleteInput {
  ledgerId:         string;
  response:         NormalizedLlmResponse;
  actualCostUsd:    number;
  creditsDeducted:  number;
  fallbackUsed:     boolean;
  fallbackFromModel?: string;
  fallbackToModel?:   string;
}

@Injectable()
export class UsageLedgerService {
  private readonly logger = new Logger(UsageLedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(input: LedgerCreateInput): Promise<string> {
    const record = await this.prisma.aiUsageLedger.create({
      data: {
        workspaceId:      input.workspaceId,
        userId:           input.userId,
        agentName:        input.agentName,
        taskType:         input.decision.taskType,
        modality:         input.decision.modality,
        provider:         input.selectedProvider,
        modelId:          input.selectedModel,
        routeTier:        input.decision.recommendedTier,
        estimatedCostUsd: input.estimatedCostUsd,
        creditsReserved:  input.creditsReserved,
        status:           'pending',
        requestId:        input.requestId,
      },
    });
    return record.id;
  }

  async complete(input: LedgerCompleteInput): Promise<void> {
    const usage = input.response.usage;
    await this.prisma.aiUsageLedger.update({
      where: { id: input.ledgerId },
      data: {
        inputTokens:   usage?.inputTokens  ?? 0,
        outputTokens:  usage?.outputTokens ?? 0,
        totalTokens:   usage?.totalTokens  ?? 0,
        actualCostUsd: input.actualCostUsd,
        creditsDeducted: input.creditsDeducted,
        fallbackUsed:  input.fallbackUsed,
        fallbackFromModel: input.fallbackFromModel,
        fallbackToModel:   input.fallbackToModel,
        status:        'completed',
        updatedAt:     new Date(),
      },
    });
  }

  async fail(ledgerId: string, errorCode: string, errorMessage: string): Promise<void> {
    await this.prisma.aiUsageLedger.update({
      where: { id: ledgerId },
      data: {
        status:       'failed',
        errorCode,
        errorMessage: errorMessage.slice(0, 500),
        updatedAt:    new Date(),
      },
    });
  }

  async getUserUsage(userId: string, since?: Date): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalCostUsd: number;
    byProvider: Record<string, number>;
  }> {
    const records = await this.prisma.aiUsageLedger.findMany({
      where: {
        userId,
        status:    'completed',
        createdAt: since ? { gte: since } : undefined,
      },
    });

    const byProvider: Record<string, number> = {};
    let totalCostUsd = 0;
    let totalTokens = 0;

    for (const r of records) {
      totalTokens  += r.totalTokens;
      totalCostUsd += Number(r.actualCostUsd ?? r.estimatedCostUsd);
      byProvider[r.provider] = (byProvider[r.provider] ?? 0) + 1;
    }

    return {
      totalRequests: records.length,
      totalTokens,
      totalCostUsd,
      byProvider,
    };
  }

  async getMonthlySpendUsd(userId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await this.prisma.aiUsageLedger.aggregate({
      where: { userId, status: 'completed', createdAt: { gte: startOfMonth } },
      _sum: { actualCostUsd: true, estimatedCostUsd: true },
    });

    return Number(result._sum.actualCostUsd ?? result._sum.estimatedCostUsd ?? 0);
  }
}
