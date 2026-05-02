import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmRouterService } from '../../llm-router/llm-router.service';
import { Competitor } from '../brand.service';

@Injectable()
export class CompetitorIntelligenceService {
  private readonly logger = new Logger(CompetitorIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly llm: LlmRouterService,
  ) {}

  async getSnapshots(userId: string, handle?: string) {
    return this.prisma.competitorSnapshot.findMany({
      where: { userId, ...(handle ? { competitorHandle: handle } : {}) },
      orderBy: { snapshotAt: 'desc' },
      take: 50,
    });
  }

  async analyzeCompetitor(userId: string, competitor: Competitor, websiteUrl?: string) {
    const brand = await this.prisma.brandKnowledge.findUnique({ where: { userId } });

    let parsed: any = {
      messaging: `${competitor.handle} on ${competitor.platform}`,
      valueProposition: null,
      contentThemes: [],
      topHashtags: [],
      uniqueStrengths: [],
      weaknesses: [],
      positioningNotes: null,
      overlapScore: 0.3,
    };

    if (this.llm && brand) {
      const brandContext = [
        brand.brandName, brand.valueProposition, brand.industry,
        brand.tone, brand.targetAudience,
      ].filter(Boolean).join('. ');

      try {
        const response = await this.llm.route({
          systemPrompt: 'You are a competitive intelligence analyst. Analyze competitor positioning. Respond with JSON only.',
          messages: [{
            role: 'user',
            content: `Analyze this competitor and compare them to our brand.

Our brand:
${brandContext}

Competitor: ${competitor.handle} on ${competitor.platform}
${websiteUrl ? `Website: ${websiteUrl}` : ''}

Based on what you know about this competitor and similar brands in the ${brand.industry ?? 'marketing'} space, provide a competitive analysis.

Return ONLY valid JSON:
{
  "messaging": "their core messaging and positioning",
  "valueProposition": "their main value proposition",
  "contentThemes": ["4-6 content themes they likely focus on"],
  "postingFrequency": "e.g. daily, 3x/week",
  "topHashtags": ["5-10 hashtags they likely use"],
  "uniqueStrengths": ["3-5 their competitive strengths vs us"],
  "weaknesses": ["3-5 their likely weaknesses"],
  "positioningNotes": "how they position vs our brand",
  "overlapScore": 0.0-1.0,
  "differentiationGaps": ["2-4 gaps we could exploit"],
  "messagingSimilarities": ["areas where messaging overlaps"]
}`,
          }],
          routing: { forceModel: 'gemini-flash-2' },
        });

        const match = response.content.match(/```(?:json)?\s*([\s\S]*?)```/) ?? response.content.match(/(\{[\s\S]*\})/);
        parsed = { ...parsed, ...JSON.parse(match?.[1] ?? response.content) };
      } catch (err) {
        this.logger.warn(`Competitor analysis LLM failed: ${err}`);
      }
    }

    const snapshot = await this.prisma.competitorSnapshot.create({
      data: {
        userId,
        competitorHandle: competitor.handle,
        platform: competitor.platform,
        websiteUrl: websiteUrl ?? null,
        messaging: parsed.messaging,
        valueProposition: parsed.valueProposition,
        contentThemes: parsed.contentThemes ?? [],
        postingFrequency: parsed.postingFrequency ?? null,
        topHashtags: parsed.topHashtags ?? [],
        uniqueStrengths: parsed.uniqueStrengths ?? [],
        weaknesses: parsed.weaknesses ?? [],
        positioningNotes: parsed.positioningNotes ?? null,
        overlapScore: parsed.overlapScore ?? 0.3,
      },
    });

    this.logger.log(`Competitor snapshot for ${competitor.handle} saved for user=${userId}`);
    return { snapshot, differentiationGaps: parsed.differentiationGaps ?? [], messagingSimilarities: parsed.messagingSimilarities ?? [] };
  }

  async getCompetitiveReport(userId: string) {
    const [brand, snapshots] = await Promise.all([
      this.prisma.brandKnowledge.findUnique({ where: { userId } }),
      this.prisma.competitorSnapshot.findMany({
        where: { userId },
        orderBy: { snapshotAt: 'desc' },
        // Latest snapshot per handle
        distinct: ['competitorHandle'],
      }),
    ]);

    if (!snapshots.length) return { summary: 'No competitors analyzed yet.', competitors: [] };

    const avgOverlap = snapshots.reduce((s, c) => s + c.overlapScore, 0) / snapshots.length;

    return {
      brand: { name: brand?.brandName, industry: brand?.industry },
      avgOverlapScore: avgOverlap,
      highestOverlap: snapshots.sort((a, b) => b.overlapScore - a.overlapScore)[0],
      competitors: snapshots.map((s) => ({
        handle: s.competitorHandle,
        platform: s.platform,
        overlapScore: s.overlapScore,
        strengths: s.uniqueStrengths,
        weaknesses: s.weaknesses,
        topThemes: s.contentThemes.slice(0, 3),
      })),
      commonStrengthsToCounter: [...new Set(snapshots.flatMap((s) => s.uniqueStrengths))].slice(0, 8),
      differentiationOpportunities: [...new Set(snapshots.flatMap((s) => s.weaknesses))].slice(0, 6),
    };
  }
}
