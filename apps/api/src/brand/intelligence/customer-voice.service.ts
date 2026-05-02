import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmRouterService } from '../../llm-router/llm-router.service';
import { VectorService } from '../../vector/vector.service';

export interface CustomerVoiceInput {
  sourceType: 'review' | 'reddit' | 'comment' | 'testimonial' | 'support_ticket' | 'social';
  sourceUrl?: string;
  texts: string[];
}

@Injectable()
export class CustomerVoiceService {
  private readonly logger = new Logger(CustomerVoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly llm: LlmRouterService,
    @Optional() private readonly vector: VectorService,
  ) {}

  async getInsights(userId: string) {
    return this.prisma.customerVoiceInsight.findMany({
      where: { userId },
      orderBy: { processedAt: 'desc' },
      take: 20,
    });
  }

  async getAggregated(userId: string) {
    const insights = await this.prisma.customerVoiceInsight.findMany({ where: { userId } });

    const merge = (field: keyof typeof insights[0]): string[] => {
      const all = insights.flatMap((i) => (i[field] as string[]) ?? []);
      const freq = new Map<string, number>();
      all.forEach((v) => freq.set(v, (freq.get(v) ?? 0) + 1));
      return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([v]) => v);
    };

    return {
      totalSources: insights.length,
      topObjections: merge('topObjections'),
      customerDesires: merge('customerDesires'),
      emotionalLanguage: merge('emotionalLanguage'),
      frequentPhrases: merge('frequentPhrases'),
      painPoints: merge('painPoints'),
      transformationOutcomes: merge('transformationOutcomes'),
      avgSentiment: insights.length
        ? insights.reduce((s, i) => s + i.sentimentScore, 0) / insights.length
        : 0,
    };
  }

  async ingest(userId: string, input: CustomerVoiceInput) {
    const allText = input.texts.join('\n\n').slice(0, 20000);

    let extracted: any = this.fallbackExtract(allText);

    if (this.llm && allText.length > 50) {
      try {
        const response = await this.llm.route({
          systemPrompt: 'You are a customer psychology expert. Extract customer voice patterns from reviews and feedback. Respond with JSON only.',
          messages: [{
            role: 'user',
            content: `Analyze these customer texts and extract patterns.

Source type: ${input.sourceType}
Texts:
${allText.slice(0, 15000)}

Return ONLY valid JSON:
{
  "topObjections": ["5-8 repeated objections or hesitations"],
  "customerDesires": ["5-8 things customers want most"],
  "emotionalLanguage": ["10-15 emotional words/phrases customers use"],
  "frequentPhrases": ["8-12 exact phrases customers repeat"],
  "painPoints": ["5-8 specific pain points mentioned"],
  "transformationOutcomes": ["3-6 outcomes or results customers mention"],
  "overallSentiment": "positive|neutral|negative|mixed",
  "sentimentScore": -1.0 to 1.0,
  "keyInsight": "one sentence summary of what customers really want"
}`,
          }],
          routing: { forceModel: 'gemini-flash-2' },
        });

        const match = response.content.match(/```(?:json)?\s*([\s\S]*?)```/) ?? response.content.match(/(\{[\s\S]*\})/);
        extracted = JSON.parse(match?.[1] ?? response.content);
      } catch (err) {
        this.logger.warn(`Customer voice LLM failed: ${err}`);
      }
    }

    // Get or create the aggregated insight record for this source type
    const existing = await this.prisma.customerVoiceInsight.findFirst({
      where: { userId, sourceType: input.sourceType },
    });

    const merge = (old: string[], fresh: string[]) =>
      [...new Set([...old, ...fresh])].slice(0, 30);

    const data = {
      userId,
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl,
      rawTexts: input.texts.slice(0, 50),
      topObjections: merge(existing?.topObjections ?? [], extracted.topObjections ?? []),
      customerDesires: merge(existing?.customerDesires ?? [], extracted.customerDesires ?? []),
      emotionalLanguage: merge(existing?.emotionalLanguage ?? [], extracted.emotionalLanguage ?? []),
      frequentPhrases: merge(existing?.frequentPhrases ?? [], extracted.frequentPhrases ?? []),
      painPoints: merge(existing?.painPoints ?? [], extracted.painPoints ?? []),
      transformationOutcomes: merge(existing?.transformationOutcomes ?? [], extracted.transformationOutcomes ?? []),
      overallSentiment: extracted.overallSentiment ?? 'neutral',
      sentimentScore: extracted.sentimentScore ?? 0,
    };

    const insight = existing
      ? await this.prisma.customerVoiceInsight.update({ where: { id: existing.id }, data })
      : await this.prisma.customerVoiceInsight.create({ data });

    // Embed into vector DB for semantic retrieval
    if (this.vector) {
      const embeddingText = [
        ...data.topObjections,
        ...data.customerDesires,
        ...data.emotionalLanguage,
        ...data.painPoints,
      ].join('. ');
      await this.vector.upsert('brand_knowledge', `${userId}-voice-${input.sourceType}`, embeddingText, {
        userId,
        updatedAt: new Date().toISOString(),
      }).catch(() => null);
    }

    this.logger.log(`Customer voice ingested for user=${userId} source=${input.sourceType}: ${input.texts.length} texts`);
    return insight;
  }

  private fallbackExtract(text: string) {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    const negativeKeywords = ['expensive', 'slow', 'hard', 'difficult', 'confusing', 'missing', 'wish', 'need', 'want', "can't", 'not'];
    const positiveKeywords = ['love', 'great', 'amazing', 'easy', 'fast', 'helpful', 'best', 'recommend', 'excellent'];

    const objections = sentences.filter((s) => negativeKeywords.some((k) => s.toLowerCase().includes(k))).slice(0, 5).map((s) => s.trim());
    const desires = sentences.filter((s) => positiveKeywords.some((k) => s.toLowerCase().includes(k))).slice(0, 5).map((s) => s.trim());

    return {
      topObjections: objections,
      customerDesires: desires,
      emotionalLanguage: [],
      frequentPhrases: [],
      painPoints: objections,
      transformationOutcomes: desires,
      overallSentiment: 'neutral',
      sentimentScore: 0,
    };
  }
}
