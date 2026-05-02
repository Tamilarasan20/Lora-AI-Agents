import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmRouterService } from '../llm-router/llm-router.service';
import { VectorService } from '../vector/vector.service';
import { VECTOR_COLLECTIONS } from '../vector/vector.types';

interface KnowledgeContext {
  projectId: string;
  userId: string;
  websiteUrl: string;
  pages: Array<{ url: string; title: string | null; textContent: string | null }>;
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmRouterService,
    private readonly vector: VectorService,
  ) {}

  async generateForProject(userId: string, crawlId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new NotFoundException('Project not found');

    const pages = await this.prisma.crawledPage.findMany({
      where: { crawlId, status: 'DONE' },
      select: { url: true, title: true, textContent: true },
      take: 50,
    });

    if (pages.length === 0) {
      this.logger.warn(`No crawled pages for project ${projectId}`);
      return null;
    }

    const ctx: KnowledgeContext = {
      projectId,
      userId,
      websiteUrl: project.websiteUrl,
      pages,
    };

    this.logger.log(`Generating knowledge base for project ${projectId} with ${pages.length} pages`);

    const [businessProfile, marketingStrategy, marketResearch, brandVoice] = await Promise.all([
      this.generateBusinessProfile(ctx),
      this.generateMarketingStrategy(ctx),
      this.generateMarketResearch(ctx),
      this.generateBrandVoice(ctx),
    ]);

    const competitors = (marketResearch as any).competitors ?? [];
    const confidence = this.calcConfidence(pages.length);

    const kb = await this.prisma.knowledgeBase.upsert({
      where: { projectId },
      create: {
        projectId,
        userId,
        businessProfile,
        marketingStrategy,
        marketResearch,
        competitorInsights: competitors,
        brandVoice,
        valueProposition: (businessProfile as any).valueProposition,
        targetAudience: (businessProfile as any).targetAudience,
        industry: (businessProfile as any).industry,
        confidenceScore: confidence,
        generatedAt: new Date(),
      },
      update: {
        businessProfile,
        marketingStrategy,
        marketResearch,
        competitorInsights: competitors,
        brandVoice,
        valueProposition: (businessProfile as any).valueProposition,
        targetAudience: (businessProfile as any).targetAudience,
        industry: (businessProfile as any).industry,
        confidenceScore: confidence,
        generatedAt: new Date(),
      },
    });

    // Embed into Qdrant
    await this.embedKnowledge(kb.id, projectId, userId, businessProfile, marketingStrategy, marketResearch);

    this.logger.log(`Knowledge base generated for project ${projectId}`);
    return kb;
  }

  async getKnowledgeBase(userId: string, projectId: string) {
    const kb = await this.prisma.knowledgeBase.findFirst({ where: { projectId, userId } });
    if (!kb) throw new NotFoundException('Knowledge base not yet generated. Run a crawl first.');
    return kb;
  }

  async searchKnowledge(userId: string, projectId: string, query: string) {
    return this.vector.search(VECTOR_COLLECTIONS.AKE_KNOWLEDGE, query, 10, {
      must: [
        { key: 'projectId', match: { value: projectId } },
        { key: 'userId', match: { value: userId } },
      ],
    });
  }

  private async generateBusinessProfile(ctx: KnowledgeContext) {
    const corpus = this.buildCorpus(ctx.pages, 12000);
    const response = await this.llm.route({
      systemPrompt: 'You are an expert business analyst. Always respond with valid JSON only.',
      messages: [{
        role: 'user',
        content: `Analyze this website content and extract a structured business profile.

Website: ${ctx.websiteUrl}
Content:
${corpus}

Return ONLY valid JSON with this exact structure:
{
  "companyName": "string",
  "industry": "string",
  "businessModel": "B2B|B2C|B2B2C|marketplace|SaaS|ecommerce|service|other",
  "productLines": ["array of products/services"],
  "targetAudience": "string describing ideal customer",
  "valueProposition": "string (1-2 sentences, the core promise)",
  "revenueModel": "string (how they make money)",
  "brandPersonality": ["array of adjectives: e.g. innovative, trustworthy"],
  "geographicFocus": "string (local/regional/national/global)",
  "companySize": "startup|SMB|midmarket|enterprise|unknown",
  "founded": "year or unknown",
  "keyDifferentiators": ["array of what makes them unique"],
  "mainCTA": "string (what action they want visitors to take)",
  "socialProof": ["testimonials/awards/logos if detected"]
}`,
      }],
      routing: { forceModel: 'claude-sonnet-4-6' },
    });

    return this.parseJson(response.content, {});
  }

  private async generateMarketingStrategy(ctx: KnowledgeContext) {
    const corpus = this.buildCorpus(ctx.pages, 8000);
    const response = await this.llm.route({
      systemPrompt: 'You are an expert marketing strategist. Always respond with valid JSON only.',
      messages: [{
        role: 'user',
        content: `Based on this website content, generate a comprehensive marketing strategy.

Website: ${ctx.websiteUrl}
Content:
${corpus}

Return ONLY valid JSON:
{
  "social": {
    "bestPlatforms": ["instagram", "linkedin", etc],
    "contentPillars": ["array of themes"],
    "postingFrequency": "e.g. 5x/week",
    "contentMix": { "educational": 40, "promotional": 20, "engagement": 40 },
    "hooks": ["3-5 compelling opening lines"],
    "hashtagStrategy": ["primary", "secondary", "niche tags"]
  },
  "seo": {
    "primaryKeywords": ["top 10"],
    "contentStrategy": "description",
    "linkBuildingIdeas": ["3-5 ideas"]
  },
  "ads": {
    "platforms": ["Google Ads", "Meta Ads"],
    "adAngles": ["3-5 angles"],
    "targetingIdeas": ["audience segments"],
    "budgetAllocation": { "google": 40, "meta": 40, "other": 20 }
  },
  "email": {
    "sequenceIdeas": ["welcome", "nurture", "conversion"],
    "subjectLineFormulas": ["3-5 formulas"],
    "segmentationIdeas": ["by behaviour/interest"]
  }
}`,
      }],
      routing: { forceModel: 'claude-sonnet-4-6' },
    });

    return this.parseJson(response.content, {});
  }

  private async generateMarketResearch(ctx: KnowledgeContext) {
    const corpus = this.buildCorpus(ctx.pages, 8000);
    const response = await this.llm.route({
      systemPrompt: 'You are an expert market researcher. Always respond with valid JSON only.',
      messages: [{
        role: 'user',
        content: `Analyze this website and generate market research intelligence.

Website: ${ctx.websiteUrl}
Content:
${corpus}

Return ONLY valid JSON:
{
  "marketSize": "estimated or unknown",
  "growthTrend": "growing|stable|declining|unknown",
  "competitors": [
    { "name": "string", "strengths": ["..."], "weaknesses": ["..."], "positioning": "string" }
  ],
  "threats": ["SWOT threats"],
  "opportunities": ["SWOT opportunities"],
  "industryTrends": ["current trends impacting this business"],
  "customerPainPoints": ["problems their customers face"],
  "buyingTriggers": ["what motivates purchase"],
  "objections": ["common sales objections"],
  "seasonality": "string describing seasonal patterns if any"
}`,
      }],
      routing: { forceModel: 'claude-sonnet-4-6' },
    });

    return this.parseJson(response.content, {});
  }

  private async generateBrandVoice(ctx: KnowledgeContext) {
    const corpus = this.buildCorpus(ctx.pages, 5000);
    const response = await this.llm.route({
      systemPrompt: 'You are an expert brand strategist. Always respond with valid JSON only.',
      messages: [{
        role: 'user',
        content: `Analyze the brand voice and communication style from this website.

Website: ${ctx.websiteUrl}
Content:
${corpus}

Return ONLY valid JSON:
{
  "tone": "professional|casual|witty|inspirational|educational|authoritative|friendly",
  "voiceAttributes": ["3-5 adjectives"],
  "vocabulary": ["industry-specific terms they use"],
  "writingStyle": "formal|conversational|technical|storytelling",
  "sentenceStructure": "short|long|mixed",
  "emojiUsage": "none|minimal|moderate|heavy",
  "sampleCaptions": ["3 example social posts in their voice"],
  "avoidWords": ["words that don't fit their brand"],
  "cta_style": "e.g. action-oriented, urgency-based, value-focused"
}`,
      }],
      routing: { forceModel: 'claude-sonnet-4-6' },
    });

    return this.parseJson(response.content, {});
  }

  private async embedKnowledge(
    kbId: string, projectId: string, userId: string,
    businessProfile: object, marketingStrategy: object, marketResearch: object,
  ) {
    const sections: Array<{ section: 'business_profile' | 'marketing_strategy' | 'market_research'; text: string }> = [
      { section: 'business_profile', text: JSON.stringify(businessProfile) },
      { section: 'marketing_strategy', text: JSON.stringify(marketingStrategy) },
      { section: 'market_research', text: JSON.stringify(marketResearch) },
    ];

    for (const { section, text } of sections) {
      await this.vector.upsert(
        VECTOR_COLLECTIONS.AKE_KNOWLEDGE,
        `${kbId}-${section}`,
        text,
        { projectId, userId, section, content: text.slice(0, 500), generatedAt: new Date().toISOString() } as any,
      );
    }
  }

  private buildCorpus(pages: Array<{ url: string; title: string | null; textContent: string | null }>, maxChars: number): string {
    let corpus = '';
    for (const page of pages) {
      const chunk = `\n\n=== ${page.title ?? page.url} ===\n${page.textContent ?? ''}`;
      if (corpus.length + chunk.length > maxChars) break;
      corpus += chunk;
    }
    return corpus;
  }

  private parseJson(text: string, fallback: object): object {
    try {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/({[\s\S]*})/);
      return JSON.parse(match?.[1] ?? text);
    } catch {
      return fallback;
    }
  }

  private calcConfidence(pageCount: number): number {
    if (pageCount >= 20) return 0.95;
    if (pageCount >= 10) return 0.80;
    if (pageCount >= 5) return 0.65;
    return 0.40;
  }
}
