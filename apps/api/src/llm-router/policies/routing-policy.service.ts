import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PolicyMatch {
  minTier?:           string;
  maxTier?:           string;
  preferredProviders: string[];
  blockedProviders:   string[];
  requiredStrengths:  string[];
  maxEstimatedCredits?: number;
  maxEstimatedCostUsd?: number;
}

@Injectable()
export class RoutingPolicyService {
  private readonly logger = new Logger(RoutingPolicyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolve(agentName?: string, taskType?: string, modality?: string): Promise<PolicyMatch> {
    // Load policies ordered by specificity: agentName+taskType > agentName only > taskType only > wildcard
    const policies = await this.prisma.llmRoutingPolicy.findMany({
      where: {
        isActive: true,
        OR: [
          { agentName: agentName ?? null, taskType: taskType ?? null },
          { agentName: agentName ?? null, taskType: null },
          { agentName: null,              taskType: taskType ?? null },
          { agentName: null,              taskType: null, modality: modality ?? null },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    if (policies.length === 0) {
      return { preferredProviders: [], blockedProviders: [], requiredStrengths: [] };
    }

    // Merge all matching policies (most specific wins for tier/cost, union for provider lists)
    const blockedSet  = new Set<string>();
    const preferredSet = new Set<string>();
    const strengthSet = new Set<string>();
    let minTier: string | undefined;
    let maxTier: string | undefined;
    let maxCredits: number | undefined;
    let maxCost: number | undefined;

    for (const policy of policies) {
      policy.blockedProviders.forEach((p) => blockedSet.add(p));
      policy.preferredProviders.forEach((p) => preferredSet.add(p));
      policy.requiredStrengths.forEach((s) => strengthSet.add(s));
      if (policy.minTier) minTier = policy.minTier;
      if (policy.maxTier) maxTier = policy.maxTier;
      if (policy.maxEstimatedCredits) maxCredits = policy.maxEstimatedCredits;
      if (policy.maxEstimatedCostUsd) maxCost = Number(policy.maxEstimatedCostUsd);
    }

    return {
      minTier,
      maxTier,
      preferredProviders:   [...preferredSet],
      blockedProviders:     [...blockedSet],
      requiredStrengths:    [...strengthSet],
      maxEstimatedCredits:  maxCredits,
      maxEstimatedCostUsd:  maxCost,
    };
  }
}
