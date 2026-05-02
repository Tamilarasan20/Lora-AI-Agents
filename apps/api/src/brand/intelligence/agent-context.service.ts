import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type AgentName = 'sophie' | 'leo' | 'nova' | 'atlas' | 'clara' | 'sarah' | 'mark' | 'general';

@Injectable()
export class AgentContextService {
  private readonly logger = new Logger(AgentContextService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getContext(userId: string, agent: AgentName) {
    const [brand, dna, voiceInsights, competitorSnapshots, latestDrift] = await Promise.all([
      this.prisma.brandKnowledge.findUnique({ where: { userId } }),
      this.prisma.brandDna.findUnique({ where: { userId } }),
      this.prisma.customerVoiceInsight.findMany({ where: { userId }, take: 5, orderBy: { processedAt: 'desc' } }),
      this.prisma.competitorSnapshot.findMany({ where: { userId }, distinct: ['competitorHandle'], take: 10, orderBy: { snapshotAt: 'desc' } }),
      this.prisma.brandDriftReport.findFirst({ where: { userId }, orderBy: { generatedAt: 'desc' } }),
    ]);

    const base = {
      brandName: brand?.brandName,
      industry: brand?.industry,
      tone: brand?.tone,
      valueProposition: brand?.valueProposition,
      voiceCharacteristics: brand?.voiceCharacteristics ?? [],
      prohibitedWords: brand?.prohibitedWords ?? [],
      contentPillars: brand?.contentPillars ?? [],
      preferredHashtags: brand?.preferredHashtags ?? [],
      archetype: dna?.archetype,
      brandPromise: dna?.brandPromise,
      coreValues: dna?.coreValues ?? [],
    };

    const customerVoice = this.aggregateVoice(voiceInsights);
    const competitorContext = {
      count: competitorSnapshots.length,
      handles: competitorSnapshots.map((c) => c.competitorHandle),
      topThemes: [...new Set(competitorSnapshots.flatMap((c) => c.contentThemes as string[]))].slice(0, 8),
      commonStrengths: [...new Set(competitorSnapshots.flatMap((c) => c.uniqueStrengths as string[]))].slice(0, 5),
      gaps: [...new Set(competitorSnapshots.flatMap((c) => c.weaknesses as string[]))].slice(0, 5),
    };

    switch (agent) {
      case 'sophie': // Copywriter — needs emotional language + voice
        return {
          agent: 'sophie',
          purpose: 'copywriting',
          brandVoice: {
            ...base,
            emotionalLanguage: customerVoice.emotionalLanguage,
            customerPhrases: customerVoice.frequentPhrases,
            desiredOutcomes: customerVoice.transformationOutcomes,
            doList: (brand?.voiceCharacteristics as string[]) ?? [],
            dontList: base.prohibitedWords,
          },
          messagingPillars: dna?.messagingPillars ?? [],
          storyArc: dna?.storyArc,
          consistencyScore: latestDrift?.consistencyScore ?? null,
        };

      case 'leo': // Ads specialist — hooks + objections + competitor patterns
        return {
          agent: 'leo',
          purpose: 'paid_ads',
          adIntelligence: {
            ...base,
            topObjections: customerVoice.topObjections,
            desiredTransformations: customerVoice.transformationOutcomes,
            painPoints: customerVoice.painPoints,
            persuasionStyle: dna?.persuasionStyle,
            emotionalEnergy: dna?.emotionalEnergy,
          },
          competitorInsights: competitorContext,
          sophisticationLevel: dna?.sophisticationLevel,
          awarenessLevel: dna?.awarenessLevel,
        };

      case 'nova': // Design — visual identity + aesthetic mood
        return {
          agent: 'nova',
          purpose: 'design',
          visualIdentity: {
            brandName: base.brandName,
            brandColors: brand?.brandColors ?? {},
            logoUrl: brand?.logoUrl,
            archetype: dna?.archetype,
            emotionalEnergy: dna?.emotionalEnergy,
            tone: base.tone,
            industry: base.industry,
          },
          moodKeywords: dna?.coreValues ?? [],
          brandPersonality: dna?.brandPersonality ?? {},
          websiteUrl: brand?.websiteUrl,
        };

      case 'atlas': // Strategist — positioning + market gaps + competitive intel
        return {
          agent: 'atlas',
          purpose: 'strategy',
          positioning: {
            ...base,
            archetype: dna?.archetype,
            persuasionStyle: dna?.persuasionStyle,
            sophisticationLevel: dna?.sophisticationLevel,
            awarenessLevel: dna?.awarenessLevel,
            storyArc: dna?.storyArc,
            brandPromise: dna?.brandPromise,
          },
          marketIntelligence: {
            ...competitorContext,
            customerNeeds: customerVoice.customerDesires,
            unmetNeeds: customerVoice.painPoints,
          },
          driftScore: latestDrift?.consistencyScore ?? null,
          driftAlerts: latestDrift?.detectedConflicts ?? [],
        };

      case 'clara': // Content creator
        return {
          agent: 'clara',
          purpose: 'content_creation',
          contentStrategy: {
            ...base,
            customerInsights: {
              desires: customerVoice.customerDesires.slice(0, 5),
              language: customerVoice.emotionalLanguage.slice(0, 10),
            },
          },
          messagingPillars: dna?.messagingPillars ?? [],
          competitorThemes: competitorContext.topThemes,
        };

      case 'sarah': // Analytics
        return {
          agent: 'sarah',
          purpose: 'analytics',
          benchmarks: {
            brandName: base.brandName,
            industry: base.industry,
            consistencyScore: latestDrift?.consistencyScore ?? null,
            competitorCount: competitorContext.count,
          },
          contentPillars: base.contentPillars,
          recommendedHashtags: base.preferredHashtags,
        };

      case 'mark': // Engagement
        return {
          agent: 'mark',
          purpose: 'engagement',
          replyGuidelines: {
            tone: base.tone,
            voice: base.voiceCharacteristics,
            prohibitedWords: base.prohibitedWords,
            brandPromise: dna?.brandPromise,
            autoReplyEnabled: brand?.autoReplyEnabled ?? true,
            sentimentThreshold: brand?.sentimentThreshold ?? -0.5,
          },
          customerContext: {
            topObjections: customerVoice.topObjections,
            emotionalLanguage: customerVoice.emotionalLanguage,
            commonPhrases: customerVoice.frequentPhrases,
          },
        };

      default: // general
        return {
          agent: 'general',
          brand: base,
          dna: dna ? { archetype: dna.archetype, persuasionStyle: dna.persuasionStyle, coreValues: dna.coreValues } : null,
          customerVoice,
          competitorContext,
          consistency: { score: latestDrift?.consistencyScore ?? null },
        };
    }
  }

  private aggregateVoice(insights: any[]) {
    const merge = (field: string) =>
      [...new Set(insights.flatMap((i) => (i[field] as string[]) ?? []))].slice(0, 15);
    return {
      topObjections: merge('topObjections'),
      customerDesires: merge('customerDesires'),
      emotionalLanguage: merge('emotionalLanguage'),
      frequentPhrases: merge('frequentPhrases'),
      painPoints: merge('painPoints'),
      transformationOutcomes: merge('transformationOutcomes'),
    };
  }
}
