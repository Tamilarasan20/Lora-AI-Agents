import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { KAFKA_TOPICS } from '../events/event.types';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { VectorService } from '../vector/vector.service';
import { StorageService } from '../storage/storage.service';
import { LlmRouterService } from '../llm-router/llm-router.service';
import { BrandMemoryService } from './intelligence/brand-memory.service';
import { BrandCrawlerService } from './brand-crawler.service';

export interface Competitor {
  id: string;
  platform: string;
  handle: string;
  addedAt: string;
}

export interface BrandAnalysisResult {
  brandName: string;
  industry: string;
  targetAudience: string;
  valueProposition: string;
  productDescription: string;
  tone: string;
  voiceCharacteristics: string[];
  contentPillars: string[];
  preferredHashtags: string[];
  prohibitedWords: string[];
  brandColors: { primary: string; secondary: string[]; accent: string };
  competitors: string[];
  logoUrl: string;
  imageUrls: string[];
  pagesScraped: string[];
  // Multi-pass intelligence
  audiencePsychology: object;
  marketIntelligence: object;
  socialStrategy: object;
  visualIntelligence: object;
  confidenceScores: Record<string, { confidence: number; sources: string[] }>;
  validationScore: number;
  contradictions: object[];
  missingInsights: object[];
  // 5 knowledge documents
  documents: {
    businessProfile: { r2Key: string; url: string; content: string };
    marketResearch: { r2Key: string; url: string; content: string };
    socialStrategy: { r2Key: string; url: string; content: string };
    brandGuidelines: { r2Key: string; url: string; content: string };
    visualIntelligence: { r2Key: string; url: string; content: string };
  };
}

@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly crawler: BrandCrawlerService,
    @Optional() private readonly vector: VectorService,
    @Optional() private readonly storage: StorageService,
    @Optional() private readonly llm: LlmRouterService,
    @Optional() private readonly memory: BrandMemoryService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTI-PASS INTELLIGENCE PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════

  async analyzeWebsite(userId: string, websiteUrl: string): Promise<BrandAnalysisResult> {
    const url = this.normalizeUrl(websiteUrl);
    this.logger.log(`[PIPELINE] Starting brand analysis for user=${userId}: ${url}`);

    // ── STAGE 1: Deep Multi-Page Crawl ───────────────────────────────────────
    this.logger.log('[STAGE 1] Crawling...');
    const crawled = await this.crawler.crawl(url);

    // ── STAGE 2: Download brand assets to R2 ─────────────────────────────────
    const { logoUrl, savedImageUrls } = await this.downloadImages(
      userId, crawled.imageUrls, crawled.logoUrl, url,
    );

    // ── STAGE 3: Gemini 2.5 Pro — full brand intelligence extraction ──────────
    this.logger.log('[STAGE 3] Gemini 2.5 Pro extraction...');
    const profile = await this.extractWithGemini(url, crawled);

    // ── STAGE 4: Generate 5 Knowledge Documents ───────────────────────────────
    this.logger.log('[STAGE 4] Generating documents...');
    const documents = await this.generateDocuments(userId, url, profile, logoUrl, savedImageUrls);

    // ── STAGE 5: Snapshot previous → record memory changes ───────────────────
    const previousProfile = await this.prisma.brandKnowledge.findUnique({ where: { userId } });

    // ── STAGE 6: Persist to DB ────────────────────────────────────────────────
    const dbData = {
      websiteUrl: url,
      brandName: profile.brandName,
      industry: profile.industry,
      targetAudience: profile.targetAudience,
      valueProposition: profile.valueProposition,
      productDescription: profile.productDescription,
      tone: profile.tone,
      voiceCharacteristics: profile.voiceCharacteristics ?? [],
      contentPillars: profile.contentPillars ?? [],
      preferredHashtags: profile.preferredHashtags ?? [],
      prohibitedWords: profile.prohibitedWords ?? [],
      brandColors: (profile.brandColors ?? {}) as object,
      competitors: (profile.competitors ?? []).map((name: string) => ({
        id: crypto.randomUUID(), platform: 'web', handle: name, addedAt: new Date().toISOString(),
      })),
      logoUrl,
      audiencePsychology: (profile.audiencePsychology ?? {}) as object,
      marketIntelligence: (profile.marketIntelligence ?? {}) as object,
      socialStrategy: (profile.socialStrategy ?? {}) as object,
      visualIntelligence: (profile.visualIntelligence ?? {}) as object,
      pagesScraped: crawled.pagesVisited,
      lastValidatedAt: new Date(),
    };

    await this.prisma.brandKnowledge.upsert({
      where: { userId },
      create: { userId, ...dbData },
      update: dbData,
    });

    // ── STAGE 7: Audit log ────────────────────────────────────────────────────
    await this.prisma.brandValidationLog.create({
      data: {
        userId, websiteUrl: url,
        pass1Extraction: profile as any,
        pass2Strategic: {},
        pass3Market: {},
        pass4Social: {},
        geminiReport: {} as any,
        contradictions: [] as any,
        missingInsights: [] as any,
        validationWarnings: [] as any,
        overallScore: 1,
        pagesScraped: crawled.pagesVisited.length,
        imagesFound: crawled.imageUrls.length,
      },
    }).catch((err) => this.logger.warn(`Audit log failed: ${err}`));

    // ── STAGE 8: Memory ────────────────────────────────────────────────────────
    if (this.memory && previousProfile) {
      await this.memory.detectAndRecord(
        userId,
        previousProfile as unknown as Record<string, unknown>,
        profile as Record<string, unknown>,
        'website_analysis',
      ).catch(() => null);
    }

    // ── STAGE 9: Vector embedding ─────────────────────────────────────────────
    if (this.vector) {
      const embeddingText = [
        profile.brandName, profile.industry, profile.valueProposition,
        profile.targetAudience, profile.tone,
        (profile.voiceCharacteristics as string[])?.join(' '),
        (profile.contentPillars as string[])?.join(' '),
      ].filter(Boolean).join('. ');

      await this.vector.upsert('brand_knowledge', userId, embeddingText, {
        userId, updatedAt: new Date().toISOString(),
      }).catch((err) => this.logger.warn(`Vector upsert failed: ${err}`));
    }

    // ── STAGE 10: Kafka event ─────────────────────────────────────────────────
    await this.eventBus.emit(KAFKA_TOPICS.BRAND_KNOWLEDGE_UPDATED, {
      eventType: 'brand.knowledge.analyzed',
      userId,
      payload: { brandId: userId, userId, changedFields: ['full_analysis'] },
    }).catch(() => null);

    this.logger.log(`[PIPELINE COMPLETE] Brand intelligence built for user=${userId}: ${profile.brandName}`);

    return {
      ...profile,
      logoUrl,
      imageUrls: savedImageUrls,
      pagesScraped: crawled.pagesVisited,
      documents,
    } as BrandAnalysisResult;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GEMINI 2.5 PRO — FULL BRAND INTELLIGENCE EXTRACTION
  // ═══════════════════════════════════════════════════════════════════════════

  private async extractWithGemini(
    websiteUrl: string,
    crawled: import('./brand-crawler.service').CrawledBrandData,
  ): Promise<Record<string, any>> {
    if (!this.llm) return this.fallbackProfile(websiteUrl, crawled.metaTags);

    const metaStr = Object.entries(crawled.metaTags).map(([k, v]) => `${k}: ${v}`).join('\n').slice(0, 800);
    const ldStr = crawled.structuredData.length ? JSON.stringify(crawled.structuredData).slice(0, 800) : '';
    const reviewStr = crawled.reviews.slice(0, 10).join('\n').slice(0, 2000);
    const pricingStr = crawled.pricing.slice(0, 5).join('\n').slice(0, 400);

    try {
      const response = await this.llm.route({
        systemPrompt: 'You are a senior brand strategist and market intelligence analyst. Extract comprehensive brand intelligence from website content. Be specific and evidence-based. Respond with valid JSON only.',
        messages: [{
          role: 'user',
          content: `Analyze this website and return a complete brand intelligence profile.

Website: ${websiteUrl}
Meta tags: ${metaStr}
${ldStr ? `Structured data: ${ldStr}` : ''}
${reviewStr ? `Customer reviews/testimonials:\n${reviewStr}` : ''}
${pricingStr ? `Pricing info:\n${pricingStr}` : ''}

Website content (multi-page):
${crawled.allText.slice(0, 18000)}

Return ONLY valid JSON:
{
  "brandName": "exact brand name",
  "industry": "specific industry (e.g. DTC Supplements, B2B SaaS, Luxury Fashion)",
  "targetAudience": "specific audience with demographics and psychographics",
  "valueProposition": "core value proposition in 1-2 sentences",
  "productDescription": "what they sell in 2-3 sentences",
  "tone": "professional|casual|witty|inspirational|educational|authoritative|friendly|bold|empathetic|luxury",
  "voiceCharacteristics": ["4-6 voice adjectives"],
  "contentPillars": ["4-6 content themes"],
  "preferredHashtags": ["10-15 hashtags without #"],
  "prohibitedWords": ["5-10 words that clash with brand"],
  "brandColors": { "primary": "#hex", "secondary": ["#hex"], "accent": "#hex" },
  "competitors": ["3-6 named competitors"],
  "businessModel": "D2C|B2B|SaaS|Marketplace|Agency|etc",
  "pricePoint": "budget|mid-range|premium|luxury",
  "callToAction": "primary CTA text",
  "uniqueSellingPoints": ["3-5 differentiators"],
  "brandArchetype": "Hero|Sage|Explorer|Creator|Ruler|Caregiver|Everyman|Jester|Lover|Magician|Outlaw|Innocent",
  "brandPromise": "one sentence brand promise",
  "messagingHierarchy": ["primary message", "secondary", "tertiary"],
  "audiencePsychology": {
    "emotionalTriggers": ["5-8 emotional hooks"],
    "fears": ["4-6 core fears"],
    "aspirations": ["4-6 aspirations"],
    "buyingMotivations": ["4-6 buying reasons"],
    "psychographics": "2-3 sentence psychographic profile"
  },
  "marketIntelligence": {
    "industryTrends": ["3-5 relevant trends"],
    "opportunities": ["3-5 growth opportunities"],
    "categoryRisks": ["2-4 market risks"],
    "competitivePositioning": "positioning assessment",
    "positioningGaps": ["2-3 gaps to own"]
  },
  "socialStrategy": {
    "platformPriority": { "instagram": "high|medium|low", "tiktok": "high|medium|low", "linkedin": "high|medium|low" },
    "contentHooks": ["5-8 high-performing hook templates"],
    "viralOpportunities": ["3-5 viral content angles"],
    "hashtagStrategy": { "branded": ["3-5"], "community": ["5-8"] }
  },
  "visualIntelligence": {
    "aestheticCategory": "e.g. Clean Minimal, Bold Maximalist",
    "moodKeywords": ["5-8 visual mood words"],
    "photographyStyle": "e.g. lifestyle, product-forward",
    "adCreativeStyle": "ad creative recommendation"
  }
}`,
        }],
        routing: { forceModel: 'gemini-2.5-pro' },
      });

      return this.parseJson(response.content, this.fallbackProfile(websiteUrl, crawled.metaTags));
    } catch (err) {
      this.logger.warn(`Gemini extraction failed: ${err}`);
      return this.fallbackProfile(websiteUrl, crawled.metaTags);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5 STRUCTURED KNOWLEDGE DOCUMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  private async generateDocuments(
    userId: string,
    websiteUrl: string,
    profile: Record<string, any>,
    logoUrl: string,
    imageUrls: string[],
  ) {
    const now = new Date().toISOString().split('T')[0];
    const docs = {
      businessProfile:    this.buildBusinessProfile(websiteUrl, profile, logoUrl, now),
      marketResearch:     this.buildMarketResearch(websiteUrl, profile, now),
      socialStrategy:     this.buildSocialStrategy(websiteUrl, profile, now),
      brandGuidelines:    this.buildBrandGuidelines(websiteUrl, profile, logoUrl, imageUrls, now),
      visualIntelligence: this.buildVisualIntelligence(websiteUrl, profile, imageUrls, now),
    };

    const saved: Record<string, { r2Key: string; url: string; content: string }> = {};

    const docMap: Array<[string, string, string]> = [
      ['businessProfile',    `${userId}/brand/business-profile.md`,     docs.businessProfile],
      ['marketResearch',     `${userId}/brand/market-research.md`,      docs.marketResearch],
      ['socialStrategy',     `${userId}/brand/social-strategy.md`,      docs.socialStrategy],
      ['brandGuidelines',    `${userId}/brand/brand-guidelines.md`,     docs.brandGuidelines],
      ['visualIntelligence', `${userId}/brand/visual-intelligence.md`,  docs.visualIntelligence],
    ];

    for (const [key, r2Key, content] of docMap) {
      let url = '';
      if (this.storage) {
        try {
          const stored = await this.storage.putObject(r2Key, Buffer.from(content, 'utf8'), 'text/markdown', {
            userId, source: 'brand-intelligence', website: websiteUrl, generatedAt: now,
          });
          url = stored.publicUrl;
        } catch (err) {
          this.logger.warn(`Failed to save ${key} to R2: ${err}`);
        }
      }
      saved[key] = { r2Key, url, content };
    }

    return saved as BrandAnalysisResult['documents'];
  }

  private buildBusinessProfile(url: string, p: any, logo: string, date: string): string {
    const lines: string[] = [];
    lines.push(`# Business Profile — ${p.brandName}`);
    lines.push(`> Loraloop Brand Intelligence · ${date} · Source: ${url}`);
    if (logo) { lines.push(''); lines.push(`![Logo](${logo})`); }
    lines.push(''); lines.push('---'); lines.push('');
    lines.push(`## 🏢 Brand Overview`); lines.push('');
    lines.push(`| Field | Value |`); lines.push(`|-------|-------|`);
    lines.push(`| **Brand Name** | ${p.brandName} |`);
    lines.push(`| **Industry** | ${p.industry} |`);
    lines.push(`| **Business Model** | ${p.businessModel ?? 'N/A'} |`);
    lines.push(`| **Price Point** | ${p.pricePoint ?? 'N/A'} |`);
    lines.push(`| **Website** | [${url}](${url}) |`);
    lines.push('');
    lines.push(`## 🎯 Value Proposition${''}`); lines.push('');
    lines.push(`> ${p.valueProposition}`); lines.push('');
    lines.push(`## 📦 Products & Services${''}`); lines.push('');
    lines.push(p.productDescription); lines.push('');
    if (p.uniqueSellingPoints?.length) {
      lines.push(`## ⭐ Unique Selling Points`); lines.push('');
      p.uniqueSellingPoints.forEach((u: string) => lines.push(`- ${u}`)); lines.push('');
    }
    lines.push(`## 👥 Target Audience${''}`); lines.push('');
    lines.push(p.targetAudience); lines.push('');
    if (p.audiencePsychology?.emotionalTriggers?.length) {
      const ap = p.audiencePsychology;
      lines.push(`## 🧠 Audience Psychology`); lines.push('');
      if (ap.psychographics) { lines.push(`> ${ap.psychographics}`); lines.push(''); }
      if (ap.emotionalTriggers?.length) {
        lines.push('**Emotional Triggers:**');
        ap.emotionalTriggers.forEach((t: string) => lines.push(`- ${t}`)); lines.push('');
      }
      if (ap.fears?.length) {
        lines.push('**Core Fears:**');
        ap.fears.forEach((f: string) => lines.push(`- ${f}`)); lines.push('');
      }
      if (ap.aspirations?.length) {
        lines.push('**Aspirations:**');
        ap.aspirations.forEach((a: string) => lines.push(`- ${a}`)); lines.push('');
      }
      if (ap.buyingMotivations?.length) {
        lines.push('**Buying Motivations:**');
        ap.buyingMotivations.forEach((m: string) => lines.push(`- ${m}`)); lines.push('');
      }
    }
    if (p.customerJourney) {
      lines.push(`## 🗺️ Customer Journey`); lines.push('');
      const cj = p.customerJourney;
      Object.entries(cj).forEach(([stage, desc]) => lines.push(`- **${stage}**: ${desc}`));
      lines.push('');
    }
    if (p.competitors?.length) {
      lines.push(`## 🏆 Competitors`); lines.push('');
      p.competitors.forEach((c: string) => lines.push(`- ${c}`)); lines.push('');
    }
    lines.push('---'); lines.push(`_Generated by Loraloop Intelligence Engine · ${date}_`);
    return lines.join('\n');
  }

  private buildMarketResearch(url: string, p: any, date: string): string {
    const mi = p.marketIntelligence ?? {};
    const lines: string[] = [];
    lines.push(`# Market Research — ${p.brandName}`);
    lines.push(`> Loraloop Brand Intelligence · ${date} · Source: ${url}`);
    lines.push(''); lines.push('---'); lines.push('');
    lines.push(`## 📊 Market Overview`); lines.push('');
    lines.push(`- **Industry:** ${p.industry}`);
    lines.push(`- **Market Sophistication:** ${mi.marketSophistication ?? p.marketSophistication ?? 'N/A'}/5`);
    lines.push(`- **Awareness Level:** ${p.awarenessLevel ?? 'N/A'}/5`);
    lines.push(`- **Risk Level:** ${mi.riskLevel ?? 'Medium'}`);
    lines.push('');
    if (mi.industryTrends?.length) {
      lines.push(`## 📈 Industry Trends`); lines.push('');
      mi.industryTrends.forEach((t: string) => lines.push(`- ${t}`)); lines.push('');
    }
    if (mi.opportunities?.length) {
      lines.push(`## 🚀 Growth Opportunities`); lines.push('');
      mi.opportunities.forEach((o: string) => lines.push(`- ${o}`)); lines.push('');
    }
    if (mi.categoryRisks?.length) {
      lines.push(`## ⚠️ Category Risks`); lines.push('');
      mi.categoryRisks.forEach((r: string) => lines.push(`- ${r}`)); lines.push('');
    }
    if (mi.positioningGaps?.length) {
      lines.push(`## 🎯 Positioning Gaps to Own`); lines.push('');
      mi.positioningGaps.forEach((g: string) => lines.push(`- ${g}`)); lines.push('');
    }
    if (mi.categoryLeaders?.length) {
      lines.push(`## 🏆 Category Leaders`); lines.push('');
      mi.categoryLeaders.forEach((l: string) => lines.push(`- ${l}`)); lines.push('');
    }
    if (mi.competitivePositioning) {
      lines.push(`## ⚡ Competitive Positioning Assessment`); lines.push('');
      lines.push(`> ${mi.competitivePositioning}`); lines.push('');
    }
    if (mi.audienceTrends?.length) {
      lines.push(`## 👥 Audience Behavior Trends`); lines.push('');
      mi.audienceTrends.forEach((t: string) => lines.push(`- ${t}`)); lines.push('');
    }
    if (p.objections?.length) {
      lines.push(`## 🤔 Audience Objections`); lines.push('');
      p.objections.forEach((o: string) => lines.push(`- ${o}`)); lines.push('');
    }
    lines.push('---'); lines.push(`_Generated by Loraloop Intelligence Engine · ${date}_`);
    return lines.join('\n');
  }

  private buildSocialStrategy(url: string, p: any, date: string): string {
    const ss = p.socialStrategy ?? p;
    const lines: string[] = [];
    lines.push(`# Social Media Strategy — ${p.brandName}`);
    lines.push(`> Loraloop Brand Intelligence · ${date} · Source: ${url}`);
    lines.push(''); lines.push('---'); lines.push('');
    if (ss.platformStrategy) {
      lines.push(`## 📱 Platform Strategy`); lines.push('');
      for (const [platform, config] of Object.entries(ss.platformStrategy as Record<string, any>)) {
        lines.push(`### ${platform.charAt(0).toUpperCase() + platform.slice(1)} — Priority: ${config.priority?.toUpperCase()}`);
        lines.push(`- **Frequency:** ${config.postingFrequency}`);
        if (config.contentTypes?.length) lines.push(`- **Formats:** ${config.contentTypes.join(', ')}`);
        if (config.growthTactics?.length) {
          lines.push('- **Growth Tactics:**');
          config.growthTactics.forEach((t: string) => lines.push(`  - ${t}`));
        }
        lines.push('');
      }
    }
    if (ss.contentPillars?.length && Array.isArray(ss.contentPillars) && typeof ss.contentPillars[0] === 'object') {
      lines.push(`## 🏛️ Content Pillars`); lines.push('');
      ss.contentPillars.forEach((pillar: any) => {
        if (typeof pillar === 'object') {
          lines.push(`### ${pillar.name || pillar}`);
          if (pillar.theme) lines.push(pillar.theme);
          if (pillar.contentIdeas?.length) { lines.push('**Ideas:**'); pillar.contentIdeas.forEach((i: string) => lines.push(`- ${i}`)); }
          lines.push('');
        }
      });
    } else if (p.contentPillars?.length) {
      lines.push(`## 🏛️ Content Pillars`); lines.push('');
      p.contentPillars.forEach((c: string) => lines.push(`- ${c}`)); lines.push('');
    }
    if (ss.contentHooks?.length || p.contentHooks?.length) {
      const hooks = ss.contentHooks ?? p.contentHooks;
      lines.push(`## 🎣 High-Converting Content Hooks`); lines.push('');
      hooks.forEach((h: string) => lines.push(`- ${h}`)); lines.push('');
    }
    if (ss.viralOpportunities?.length) {
      lines.push(`## 🔥 Viral Content Opportunities`); lines.push('');
      ss.viralOpportunities.forEach((v: string) => lines.push(`- ${v}`)); lines.push('');
    }
    if (ss.growthRecommendations?.length) {
      lines.push(`## 🚀 Growth Recommendations`); lines.push('');
      ss.growthRecommendations.forEach((r: string) => lines.push(`- ${r}`)); lines.push('');
    }
    if (ss.hashtagStrategy) {
      lines.push(`## #️⃣ Hashtag Strategy`); lines.push('');
      const hs = ss.hashtagStrategy;
      if (hs.branded?.length) { lines.push(`**Branded:** ${hs.branded.map((h: string) => `#${h.replace('#', '')}`).join(' ')}`); }
      if (hs.community?.length) { lines.push(`**Community:** ${hs.community.map((h: string) => `#${h.replace('#', '')}`).join(' ')}`); }
      if (hs.trending?.length) { lines.push(`**Trending:** ${hs.trending.map((h: string) => `#${h.replace('#', '')}`).join(' ')}`); }
      lines.push('');
    } else if (p.preferredHashtags?.length) {
      lines.push(`## #️⃣ Hashtags`); lines.push('');
      lines.push(p.preferredHashtags.map((h: string) => `#${h.replace('#', '')}`).join(' ')); lines.push('');
    }
    if (ss.messagingHierarchy?.length || p.messagingHierarchy?.length) {
      const mh = ss.messagingHierarchy ?? p.messagingHierarchy;
      lines.push(`## 📢 Messaging Hierarchy`); lines.push('');
      mh.forEach((m: string, i: number) => lines.push(`${i + 1}. ${m}`)); lines.push('');
    }
    lines.push('---'); lines.push(`_Generated by Loraloop Intelligence Engine · ${date}_`);
    return lines.join('\n');
  }

  private buildBrandGuidelines(url: string, p: any, logo: string, images: string[], date: string): string {
    const lines: string[] = [];
    lines.push(`# Brand Guidelines — ${p.brandName}`);
    lines.push(`> Loraloop Brand Intelligence · ${date} · Source: ${url}`);
    if (logo) { lines.push(''); lines.push(`![Logo](${logo})`); }
    lines.push(''); lines.push('---'); lines.push('');
    lines.push(`## 🎨 Colors`); lines.push('');
    if (p.brandColors) {
      lines.push(`- **Primary:** \`${p.brandColors.primary}\``);
      if (p.brandColors.secondary?.length) lines.push(`- **Secondary:** ${p.brandColors.secondary.map((c: string) => `\`${c}\``).join(', ')}`);
      if (p.brandColors.accent) lines.push(`- **Accent:** \`${p.brandColors.accent}\``);
      lines.push('');
    }
    lines.push(`## 🎙️ Tone of Voice`); lines.push('');
    lines.push(`**Primary Tone:** ${p.tone}`); lines.push('');
    if (p.voiceCharacteristics?.length) {
      lines.push('**Voice Characteristics:**');
      p.voiceCharacteristics.forEach((v: string) => lines.push(`- ${v}`)); lines.push('');
    }
    if (p.brandPromise) { lines.push(`**Brand Promise:** ${p.brandPromise}`); lines.push(''); }
    if (p.messagingHierarchy?.length) {
      lines.push(`**Messaging Hierarchy:**`);
      p.messagingHierarchy.forEach((m: string, i: number) => lines.push(`${i + 1}. ${m}`)); lines.push('');
    }
    if (p.callToAction) { lines.push(`**Primary CTA:** ${p.callToAction}`); lines.push(''); }
    lines.push(`## ✅ Voice Do's`); lines.push('');
    (p.voiceCharacteristics ?? ['Be authentic', 'Be specific', 'Be consistent']).forEach((v: string) => lines.push(`- ${v}`));
    lines.push('');
    if (p.prohibitedWords?.length) {
      lines.push(`## 🚫 Prohibited Words`); lines.push('');
      lines.push(p.prohibitedWords.join(' · ')); lines.push('');
    }
    if (p.brandArchetype) {
      lines.push(`## 🧬 Brand Archetype: ${p.brandArchetype}`); lines.push('');
      if (p.storyArc) lines.push(`**Story Arc:** ${p.storyArc}`);
      if (p.persuasionStyle) lines.push(`**Persuasion Style:** ${p.persuasionStyle}`);
      lines.push('');
    }
    if (p.seoKeywords?.length) {
      lines.push(`## 🔍 SEO Keywords`); lines.push('');
      lines.push(p.seoKeywords.join(', ')); lines.push('');
    }
    lines.push('---'); lines.push(`_Generated by Loraloop Intelligence Engine · ${date}_`);
    return lines.join('\n');
  }

  private buildVisualIntelligence(url: string, p: any, images: string[], date: string): string {
    const vi = p.visualIntelligence ?? p.marketIntelligence?.visualIntelligence ?? {};
    const lines: string[] = [];
    lines.push(`# Visual Intelligence — ${p.brandName}`);
    lines.push(`> Loraloop Brand Intelligence · ${date} · Source: ${url}`);
    lines.push(''); lines.push('---'); lines.push('');
    lines.push(`## 🎨 Visual Identity`); lines.push('');
    if (vi.aestheticCategory) lines.push(`**Aesthetic Category:** ${vi.aestheticCategory}`);
    if (vi.photographyStyle) lines.push(`**Photography Style:** ${vi.photographyStyle}`);
    if (vi.adCreativeStyle) lines.push(`**Ad Creative Style:** ${vi.adCreativeStyle}`);
    lines.push('');
    if (vi.moodKeywords?.length) {
      lines.push(`## 🌈 Visual Mood`); lines.push('');
      lines.push(vi.moodKeywords.join(' · ')); lines.push('');
    }
    if (vi.contentFormats?.length) {
      lines.push(`## 📐 Content Formats`); lines.push('');
      vi.contentFormats.forEach((f: string) => lines.push(`- ${f}`)); lines.push('');
    }
    if (vi.videoDirection) {
      lines.push(`## 🎬 Video Direction`); lines.push('');
      lines.push(vi.videoDirection); lines.push('');
    }
    if (p.brandColors) {
      lines.push(`## 🎨 Brand Colors`); lines.push('');
      lines.push(`- Primary: \`${p.brandColors.primary}\``);
      if (p.brandColors.secondary?.length) lines.push(`- Secondary: ${p.brandColors.secondary.map((c: string) => `\`${c}\``).join(', ')}`);
      if (p.brandColors.accent) lines.push(`- Accent: \`${p.brandColors.accent}\``);
      lines.push('');
    }
    if (images.length > 0) {
      lines.push(`## 🖼️ Brand Images (${images.length} found)`); lines.push('');
      images.slice(0, 8).forEach((url: string, i: number) => lines.push(`![Brand Image ${i + 1}](${url})`));
      lines.push('');
    }
    lines.push(`**Agent Use:**`);
    lines.push('- **Nova (Design):** Use aesthetic category, mood, colors, and photography style for creatives');
    lines.push('- **Kip (Video):** Use video direction and content formats for video briefs');
    lines.push('- **Leo (Ads):** Use ad creative style for paid media assets');
    lines.push('');
    lines.push('---'); lines.push(`_Generated by Loraloop Intelligence Engine · ${date}_`);
    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMAGE DOWNLOAD
  // ═══════════════════════════════════════════════════════════════════════════

  private async downloadImages(
    userId: string, imageUrls: string[], logoUrl: string, websiteUrl: string,
  ): Promise<{ logoUrl: string; savedImageUrls: string[] }> {
    if (!this.storage) return { logoUrl, savedImageUrls: imageUrls.slice(0, 10) };

    const savedUrls: string[] = [];
    const origin = new URL(websiteUrl).hostname;
    let savedLogoUrl = logoUrl;

    if (logoUrl) {
      try {
        const res = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const mime = res.headers.get('content-type') ?? 'image/png';
          const ext = mime.split('/')[1]?.split(';')[0] ?? 'png';
          const stored = await this.storage.putObject(`${userId}/brand/logo.${ext}`, buf, mime, { source: 'brand-analysis', origin });
          savedLogoUrl = stored.publicUrl;
        }
      } catch { /* non-fatal */ }
    }

    for (let i = 0; i < Math.min(imageUrls.filter((u) => u !== logoUrl).length, 12); i++) {
      const imgUrl = imageUrls.filter((u) => u !== logoUrl)[i];
      try {
        const res = await fetch(imgUrl, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        const mime = res.headers.get('content-type') ?? 'image/jpeg';
        if (!mime.startsWith('image/')) continue;
        const ext = mime.split('/')[1]?.split(';')[0] ?? 'jpg';
        const stored = await this.storage.putObject(`${userId}/brand/images/${i + 1}.${ext}`, buf, mime, { source: 'brand-analysis', origin });
        savedUrls.push(stored.publicUrl);
      } catch { /* non-fatal */ }
    }

    return { logoUrl: savedLogoUrl, savedImageUrls: savedUrls };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private parseJson(text: string, fallback: Record<string, any>): Record<string, any> {
    try {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/s);
      return JSON.parse(match?.[1] ?? text);
    } catch {
      return fallback;
    }
  }

  private normalizeUrl(url: string): string {
    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      return u.toString();
    } catch {
      return url;
    }
  }

  private fallbackProfile(websiteUrl: string, metaTags: Record<string, string>): Record<string, any> {
    return {
      brandName: metaTags['og:site_name'] ?? new URL(websiteUrl).hostname,
      industry: '', targetAudience: metaTags['og:description'] ?? '',
      valueProposition: metaTags['description'] ?? metaTags['og:description'] ?? '',
      productDescription: metaTags['og:description'] ?? '',
      tone: 'professional', voiceCharacteristics: [], contentPillars: [],
      preferredHashtags: [], prohibitedWords: [],
      brandColors: { primary: '#000000', secondary: [], accent: '#ffffff' },
      competitors: [],
    };
  }

  // ─── Documents endpoint ───────────────────────────────────────────────────

  async getDocuments(userId: string) {
    if (!this.storage) return null;
    const keys = [
      `${userId}/brand/business-profile.md`,
      `${userId}/brand/market-research.md`,
      `${userId}/brand/social-strategy.md`,
      `${userId}/brand/brand-guidelines.md`,
      `${userId}/brand/visual-intelligence.md`,
    ];

    const results: Record<string, string | null> = {};
    for (const key of keys) {
      try {
        const url = await this.storage.generatePresignedDownloadUrl(key, 3600);
        const name = key.split('/').pop()!.replace('.md', '').replace(/-/g, '_');
        results[name] = url;
      } catch { /* not yet generated */ }
    }
    return results;
  }

  async getMarkdown(userId: string): Promise<{ url: string; key: string } | null> {
    const r2Key = `${userId}/brand/brand-guidelines.md`;
    try {
      const url = await this.storage?.generatePresignedDownloadUrl(r2Key, 3600) ?? '';
      return url ? { url, key: r2Key } : null;
    } catch { return null; }
  }

  async getValidationHistory(userId: string, limit = 10) {
    return this.prisma.brandValidationLog.findMany({
      where: { userId },
      orderBy: { validatedAt: 'desc' },
      take: limit,
    });
  }

  // ─── Core CRUD ────────────────────────────────────────────────────────────

  async get(userId: string) {
    return this.prisma.brandKnowledge.upsert({
      where: { userId }, create: { userId }, update: {},
    });
  }

  async update(userId: string, dto: UpdateBrandDto) {
    const updated = await this.prisma.brandKnowledge.upsert({
      where: { userId }, create: { userId, ...dto }, update: dto,
    });

    await this.eventBus.emit(KAFKA_TOPICS.BRAND_KNOWLEDGE_UPDATED, {
      eventType: 'brand.knowledge.updated', userId,
      payload: { brandId: userId, userId, changedFields: Object.keys(dto) },
    }).catch(() => null);

    if (this.vector) {
      const text = [dto.brandName, dto.brandDescription, dto.tone,
        (dto.preferredHashtags as string[] | undefined)?.join(' ')].filter(Boolean).join('. ');
      if (text.trim()) {
        await this.vector.upsert('brand_knowledge', userId, text, { userId, updatedAt: new Date().toISOString() })
          .catch((err: unknown) => this.logger.warn(`Vector upsert failed: ${err}`));
      }
    }
    return updated;
  }

  async getVoice(userId: string) {
    const brand = await this.get(userId);
    return {
      tone: brand.tone,
      voiceCharacteristics: brand.voiceCharacteristics,
      brandDescription: brand.productDescription,
      valueProposition: brand.valueProposition,
      autoReplyEnabled: brand.autoReplyEnabled,
      sentimentThreshold: brand.sentimentThreshold,
    };
  }

  async updateVoice(userId: string, dto: {
    tone?: string; voiceCharacteristics?: string[]; brandDescription?: string;
    valueProposition?: string; autoReplyEnabled?: boolean; sentimentThreshold?: number;
  }) {
    const data: Record<string, unknown> = {};
    if (dto.tone !== undefined) data.tone = dto.tone;
    if (dto.voiceCharacteristics !== undefined) data.voiceCharacteristics = dto.voiceCharacteristics;
    if (dto.brandDescription !== undefined) data.productDescription = dto.brandDescription;
    if (dto.valueProposition !== undefined) data.valueProposition = dto.valueProposition;
    if (dto.autoReplyEnabled !== undefined) data.autoReplyEnabled = dto.autoReplyEnabled;
    if (dto.sentimentThreshold !== undefined) data.sentimentThreshold = dto.sentimentThreshold;
    return this.prisma.brandKnowledge.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  }

  async getCompetitors(userId: string): Promise<Competitor[]> {
    const brand = await this.get(userId);
    return (brand.competitors as unknown as Competitor[]) ?? [];
  }

  async addCompetitor(userId: string, platform: string, handle: string): Promise<Competitor> {
    const brand = await this.get(userId);
    const existing = (brand.competitors as unknown as Competitor[]) ?? [];
    const dupe = existing.find((c) => c.platform === platform && c.handle.toLowerCase() === handle.toLowerCase());
    if (dupe) return dupe;
    const entry: Competitor = { id: crypto.randomUUID(), platform, handle, addedAt: new Date().toISOString() };
    await this.prisma.brandKnowledge.update({ where: { userId }, data: { competitors: [...existing, entry] as any } });
    return entry;
  }

  async removeCompetitor(userId: string, competitorId: string): Promise<void> {
    const brand = await this.get(userId);
    const existing = (brand.competitors as unknown as Competitor[]) ?? [];
    const filtered = existing.filter((c) => c.id !== competitorId);
    if (filtered.length === existing.length) throw new NotFoundException('Competitor not found');
    await this.prisma.brandKnowledge.update({ where: { userId }, data: { competitors: filtered as any } });
  }

  async addHashtags(userId: string, hashtags: string[]) {
    const brand = await this.get(userId);
    const merged = [...new Set([...(brand.preferredHashtags as string[]) ?? [], ...hashtags])];
    return this.prisma.brandKnowledge.update({ where: { userId }, data: { preferredHashtags: merged } });
  }

  async removeHashtag(userId: string, hashtag: string) {
    const brand = await this.get(userId);
    const updated = ((brand.preferredHashtags as string[]) ?? []).filter((h) => h !== hashtag);
    return this.prisma.brandKnowledge.update({ where: { userId }, data: { preferredHashtags: updated } });
  }

  async addProhibitedWords(userId: string, words: string[]) {
    const brand = await this.get(userId);
    const merged = [...new Set([...(brand.prohibitedWords as string[]) ?? [], ...words.map((w) => w.toLowerCase())])];
    return this.prisma.brandKnowledge.update({ where: { userId }, data: { prohibitedWords: merged } });
  }
}
