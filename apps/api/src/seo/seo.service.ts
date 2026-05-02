import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmRouterService } from '../llm-router/llm-router.service';
import { VectorService } from '../vector/vector.service';
import { VECTOR_COLLECTIONS } from '../vector/vector.types';

@Injectable()
export class SeoService {
  private readonly logger = new Logger(SeoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmRouterService,
    private readonly vector: VectorService,
  ) {}

  async generateForProject(userId: string, projectId: string, crawlId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new NotFoundException('Project not found');

    const pages = await this.prisma.crawledPage.findMany({
      where: { crawlId, status: 'DONE' },
      select: { url: true, title: true, textContent: true, headings: true, metaTags: true },
      take: 50,
    });

    const corpus = pages.map((p) => `URL: ${p.url}\nTitle: ${p.title}\n${p.textContent?.slice(0, 2000)}`).join('\n\n---\n\n');
    const metaCorpus = pages.map((p) => JSON.stringify(p.metaTags)).join(' ');

    const response = await this.llm.route({
      systemPrompt: 'You are an expert SEO analyst. Always respond with valid JSON only.',
      messages: [{
        role: 'user',
        content: `You are an expert SEO analyst. Analyze this website content and generate comprehensive SEO intelligence.

Website: ${project.websiteUrl}
Content (${pages.length} pages):
${corpus.slice(0, 15000)}

Meta data:
${metaCorpus.slice(0, 2000)}

Return ONLY valid JSON:
{
  "keywords": [
    { "keyword": "string", "intent": "informational|navigational|transactional|commercial", "priority": "high|medium|low", "type": "head|body|long-tail" }
  ],
  "clusters": [
    { "pillar": "main topic", "subtopics": ["related keywords"], "contentIdea": "article title" }
  ],
  "longTailKeywords": [
    { "keyword": "4-6 word phrase", "intent": "string", "contentFormat": "blog|FAQ|landing page|video" }
  ],
  "contentGaps": [
    { "topic": "string", "reason": "why this is a gap", "suggestedTitle": "string" }
  ],
  "intentMap": {
    "informational": ["keywords"],
    "transactional": ["keywords"],
    "commercial": ["keywords"],
    "navigational": ["keywords"]
  },
  "topPages": [
    { "url": "string", "keywordOpportunities": ["keywords"], "improvements": ["suggestions"] }
  ],
  "technicalSeoNotes": ["observations about the site structure"],
  "competitorKeywords": ["keywords competitors likely rank for"]
}`,
      }],
      routing: { forceModel: 'gpt-4o' },
    });

    const seoData = this.parseJson(response.content, {});

    const record = await this.prisma.seoData.upsert({
      where: { projectId },
      create: {
        projectId, userId,
        keywords: (seoData as any).keywords ?? [],
        clusters: (seoData as any).clusters ?? [],
        longTailKeywords: (seoData as any).longTailKeywords ?? [],
        contentGaps: (seoData as any).contentGaps ?? [],
        intentMap: (seoData as any).intentMap ?? {},
        topPages: (seoData as any).topPages ?? [],
        competitorKeywords: (seoData as any).competitorKeywords ?? [],
        generatedAt: new Date(),
      },
      update: {
        keywords: (seoData as any).keywords ?? [],
        clusters: (seoData as any).clusters ?? [],
        longTailKeywords: (seoData as any).longTailKeywords ?? [],
        contentGaps: (seoData as any).contentGaps ?? [],
        intentMap: (seoData as any).intentMap ?? {},
        topPages: (seoData as any).topPages ?? [],
        competitorKeywords: (seoData as any).competitorKeywords ?? [],
        generatedAt: new Date(),
      },
    });

    // Embed keyword clusters into vector DB
    const keywords = ((seoData as any).keywords ?? []) as Array<{ keyword: string; intent: string; type: string }>;
    for (const kw of keywords.slice(0, 100)) {
      await this.vector.upsert(
        VECTOR_COLLECTIONS.AKE_SEO,
        `${projectId}-${Buffer.from(kw.keyword).toString('base64url')}`,
        kw.keyword,
        {
          projectId,
          userId,
          keyword: kw.keyword,
          intent: kw.intent,
          cluster: kw.type,
          generatedAt: new Date().toISOString(),
        },
      );
    }

    this.logger.log(`SEO data generated for project ${projectId}: ${keywords.length} keywords`);
    return record;
  }

  async getSeoData(userId: string, projectId: string) {
    const data = await this.prisma.seoData.findFirst({ where: { projectId, userId } });
    if (!data) throw new NotFoundException('SEO data not yet generated. Run a crawl first.');
    return data;
  }

  async findRelatedKeywords(userId: string, projectId: string, seed: string) {
    return this.vector.search(VECTOR_COLLECTIONS.AKE_SEO, seed, 20, {
      must: [{ key: 'projectId', match: { value: projectId } }],
    });
  }

  private parseJson(text: string, fallback: object): object {
    try {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/({[\s\S]*})/);
      return JSON.parse(match?.[1] ?? text);
    } catch {
      return fallback;
    }
  }
}
