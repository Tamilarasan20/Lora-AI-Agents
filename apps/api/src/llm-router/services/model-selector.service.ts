import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RouterDecision } from '../schemas/router-decision.schema';

export interface ModelCandidate {
  modelId:       string;
  displayName:   string;
  provider:      string;
  tier:          string;
  score:         number;
  estimatedCostUsd: number;
  estimatedLatencyMs: number;
  inputCostPerMTok: number;
  outputCostPerMTok: number;
}

@Injectable()
export class ModelSelectorService {
  private readonly logger = new Logger(ModelSelectorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async select(
    decision: RouterDecision,
    estimatedInputTokens: number,
    preferredProviders?: string[],
    blockedProviders?: string[],
  ): Promise<ModelCandidate[]> {
    const tierPriority = this.getTierPool(decision.recommendedTier);
    const blocked = new Set(blockedProviders ?? []);

    const models = await this.prisma.llmModelRegistry.findMany({
      where: {
        isActive:    true,
        isDeprecated: false,
        tier:        { in: tierPriority },
        modality:    { has: decision.modality },
        ...(decision.requiresStructuredOutput ? { supportsJson: true } : {}),
        ...(decision.requiresVision ? { supportsVision: true } : {}),
        ...(decision.requiresSearch ? { supportsSearch: true } : {}),
        provider: {
          healthStatus: { not: 'down' },
          isActive: true,
        },
      },
      include: { provider: true },
    });

    const scored = models
      .filter((m) => !blocked.has(m.provider.name))
      .map((m) => {
        const score = this.scoreModel(m, decision, estimatedInputTokens, preferredProviders ?? []);
        const estimatedCostUsd =
          (estimatedInputTokens / 1e6) * Number(m.inputCostPerMTok) +
          (decision.maxOutputTokens / 1e6) * Number(m.outputCostPerMTok);

        return {
          modelId:           m.modelId,
          displayName:       m.displayName,
          provider:          m.provider.name,
          tier:              m.tier,
          score,
          estimatedCostUsd,
          estimatedLatencyMs: this.latencyEstimate(m.latencyClass, estimatedInputTokens),
          inputCostPerMTok:  Number(m.inputCostPerMTok),
          outputCostPerMTok: Number(m.outputCostPerMTok),
        };
      })
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      this.logger.warn(`No models found for tier=${decision.recommendedTier} modality=${decision.modality}`);
    }

    return scored;
  }

  private scoreModel(
    model: any,
    decision: RouterDecision,
    inputTokens: number,
    preferred: string[],
  ): number {
    let score = 0;

    // Quality weight (0-40 pts)
    const qualityWeight = this.qualityWeight(decision.costPriority, decision.complexity);
    score += model.qualityScore * qualityWeight * 40;

    // Latency weight (0-30 pts)
    const latencyWeight = this.latencyWeight(decision.latencyPriority);
    score += model.latencyScore * latencyWeight * 30;

    // Reliability (0-20 pts)
    score += model.reliabilityScore * 20;

    // Cost efficiency (0-10 pts) — inverse of cost per million tokens
    const costPerMTok = Number(model.inputCostPerMTok) + Number(model.outputCostPerMTok);
    const costScore = costPerMTok > 0 ? Math.min(10, 50 / costPerMTok) : 10;
    score += costScore;

    // Provider preference bonus (+15 pts)
    if (preferred.includes(model.provider.name)) score += 15;

    // Strength match (+5 pts per matching strength)
    const strengths = model.strengths as string[];
    if (decision.taskType === 'research' && strengths.includes('research'))   score += 5;
    if (decision.taskType === 'copywriting' && strengths.includes('creative')) score += 5;
    if (decision.requiresRealtimeData && strengths.includes('search'))         score += 5;
    if (decision.requiresVision && strengths.includes('vision'))               score += 5;
    if (decision.requiresLongContext && strengths.includes('long-context'))    score += 5;

    return score;
  }

  private qualityWeight(costPriority: string, complexity: string): number {
    if (costPriority === 'quality' || complexity === 'critical') return 1.0;
    if (costPriority === 'balanced' || complexity === 'high')    return 0.7;
    return 0.4; // cheap/low
  }

  private latencyWeight(latencyPriority: string): number {
    if (latencyPriority === 'fast') return 1.0;
    if (latencyPriority === 'normal') return 0.6;
    return 0.3; // low
  }

  private getTierPool(recommendedTier: string): string[] {
    const pools: Record<string, string[]> = {
      cheap:      ['cheap'],
      standard:   ['standard', 'cheap'],
      premium:    ['premium', 'standard'],
      frontier:   ['frontier', 'premium'],
      specialist: ['specialist', 'frontier'],
      router:     ['cheap', 'standard'],
    };
    return pools[recommendedTier] ?? ['standard', 'cheap'];
  }

  private latencyEstimate(latencyClass: string, inputTokens: number): number {
    const base = latencyClass === 'fast' ? 500 : latencyClass === 'medium' ? 1500 : 4000;
    return base + Math.floor(inputTokens / 100); // ~10ms per 1k input tokens
  }
}
