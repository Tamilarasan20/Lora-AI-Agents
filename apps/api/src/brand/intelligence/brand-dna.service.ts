import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmRouterService } from '../../llm-router/llm-router.service';

const ARCHETYPES = ['Hero', 'Sage', 'Explorer', 'Creator', 'Ruler', 'Caregiver', 'Everyman', 'Jester', 'Lover', 'Magician', 'Outlaw', 'Innocent'];
const PERSUASION_STYLES = ['Transformation', 'Authority', 'Social Proof', 'Scarcity', 'Reciprocity', 'Story', 'Logic', 'Emotion'];

@Injectable()
export class BrandDnaService {
  private readonly logger = new Logger(BrandDnaService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly llm: LlmRouterService,
  ) {}

  async get(userId: string) {
    return this.prisma.brandDna.findUnique({ where: { userId } });
  }

  async extract(userId: string) {
    const brand = await this.prisma.brandKnowledge.findUnique({ where: { userId } });
    if (!brand) return null;

    const context = [
      brand.brandName, brand.industry, brand.valueProposition,
      brand.productDescription, brand.targetAudience, brand.tone,
      (brand.voiceCharacteristics as string[]).join(', '),
      (brand.contentPillars as string[]).join(', '),
    ].filter(Boolean).join('\n');

    if (!this.llm) return this.inferDna(brand);

    let parsed: any = {};
    try {
      const response = await this.llm.route({
        systemPrompt: 'You are a brand psychologist and marketing strategist. Extract the deep brand DNA. Respond with valid JSON only.',
        messages: [{
          role: 'user',
          content: `Analyze this brand and extract its DNA profile.

Brand data:
${context}

Return ONLY valid JSON:
{
  "archetype": "one of: ${ARCHETYPES.join(', ')}",
  "persuasionStyle": "one of: ${PERSUASION_STYLES.join(', ')}",
  "emotionalEnergy": "e.g. Ambitious, Nurturing, Rebellious, Aspirational",
  "sophisticationLevel": 1-5,
  "awarenessLevel": 1-5,
  "brandPersonality": {
    "openness": 0-10,
    "conscientiousness": 0-10,
    "extraversion": 0-10,
    "agreeableness": 0-10,
    "stability": 0-10
  },
  "coreValues": ["3-5 core brand values"],
  "brandPromise": "one sentence brand promise",
  "storyArc": "e.g. From Pain to Transformation, Underdog Rising, Discovery Journey",
  "messagingPillars": [
    { "pillar": "name", "theme": "description", "emotionalHook": "hook" }
  ],
  "confidenceScore": 0.0-1.0
}`,
        }],
        routing: { forceModel: 'gemini-flash-2' },
      });

      const match = response.content.match(/```(?:json)?\s*([\s\S]*?)```/) ?? response.content.match(/(\{[\s\S]*\})/);
      parsed = JSON.parse(match?.[1] ?? response.content);
    } catch (err) {
      this.logger.warn(`DNA LLM extraction failed: ${err}`);
      return this.inferDna(brand);
    }

    const dna = await this.prisma.brandDna.upsert({
      where: { userId },
      create: {
        userId,
        archetype: parsed.archetype ?? null,
        persuasionStyle: parsed.persuasionStyle ?? null,
        emotionalEnergy: parsed.emotionalEnergy ?? null,
        sophisticationLevel: parsed.sophisticationLevel ?? 3,
        awarenessLevel: parsed.awarenessLevel ?? 3,
        brandPersonality: parsed.brandPersonality ?? {},
        coreValues: parsed.coreValues ?? [],
        brandPromise: parsed.brandPromise ?? null,
        storyArc: parsed.storyArc ?? null,
        messagingPillars: parsed.messagingPillars ?? [],
        confidenceScore: parsed.confidenceScore ?? 0.7,
      },
      update: {
        archetype: parsed.archetype ?? null,
        persuasionStyle: parsed.persuasionStyle ?? null,
        emotionalEnergy: parsed.emotionalEnergy ?? null,
        sophisticationLevel: parsed.sophisticationLevel ?? 3,
        awarenessLevel: parsed.awarenessLevel ?? 3,
        brandPersonality: parsed.brandPersonality ?? {},
        coreValues: parsed.coreValues ?? [],
        brandPromise: parsed.brandPromise ?? null,
        storyArc: parsed.storyArc ?? null,
        messagingPillars: parsed.messagingPillars ?? [],
        confidenceScore: parsed.confidenceScore ?? 0.7,
      },
    });

    this.logger.log(`Brand DNA extracted for user=${userId}: archetype=${dna.archetype}`);
    return dna;
  }

  private async inferDna(brand: any) {
    const toneToArchetype: Record<string, string> = {
      professional: 'Ruler', bold: 'Hero', inspirational: 'Explorer',
      educational: 'Sage', friendly: 'Caregiver', casual: 'Everyman',
      witty: 'Jester', authoritative: 'Ruler', empathetic: 'Caregiver',
    };
    return this.prisma.brandDna.upsert({
      where: { userId: brand.userId },
      create: {
        userId: brand.userId,
        archetype: toneToArchetype[brand.tone ?? 'professional'] ?? 'Sage',
        persuasionStyle: 'Story',
        emotionalEnergy: 'Aspirational',
        sophisticationLevel: 3,
        awarenessLevel: 3,
        confidenceScore: 0.4,
      },
      update: { confidenceScore: 0.4 },
    });
  }
}
