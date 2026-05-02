import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { chromium } from 'playwright';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { KAFKA_TOPICS } from '../events/event.types';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { VectorService } from '../vector/vector.service';
import { VECTOR_COLLECTIONS } from '../vector/vector.types';
import { StorageService } from '../storage/storage.service';
import { LlmRouterService } from '../llm-router/llm-router.service';

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
  markdownR2Key: string;
  markdownUrl: string;
  markdownContent: string;
}

const USER_AGENT = 'Mozilla/5.0 (compatible; LoraBot/1.0; +https://loraloop.ai/bot)';

@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    @Optional() private readonly vector: VectorService,
    @Optional() private readonly storage: StorageService,
    @Optional() private readonly llm: LlmRouterService,
  ) {}

  // ── Website Analysis ───────────────────────────────────────────────────────

  async analyzeWebsite(userId: string, websiteUrl: string): Promise<BrandAnalysisResult> {
    this.logger.log(`Analyzing website for user=${userId}: ${websiteUrl}`);

    // 1. Scrape the homepage + up to 3 key sub-pages
    const scraped = await this.scrapeWebsite(websiteUrl);

    // 2. Download images (logo + top brand images) to R2
    const { logoUrl, savedImageUrls } = await this.downloadImages(
      userId, scraped.imageUrls, scraped.logoUrl, websiteUrl,
    );

    // 3. LLM enrichment — Claude extracts full brand profile from content
    const profile = await this.enrichWithLlm(websiteUrl, scraped.textContent, scraped.metaTags);

    // 4. Build and store markdown file in R2
    const { markdownContent, markdownR2Key, markdownUrl } = await this.saveMarkdown(
      userId, websiteUrl, profile, logoUrl, savedImageUrls,
    );

    // 5. Persist to BrandKnowledge table
    await this.prisma.brandKnowledge.upsert({
      where: { userId },
      create: {
        userId,
        websiteUrl,
        brandName: profile.brandName,
        industry: profile.industry,
        targetAudience: profile.targetAudience,
        valueProposition: profile.valueProposition,
        productDescription: profile.productDescription,
        tone: profile.tone,
        voiceCharacteristics: profile.voiceCharacteristics,
        contentPillars: profile.contentPillars,
        preferredHashtags: profile.preferredHashtags,
        prohibitedWords: profile.prohibitedWords,
        brandColors: profile.brandColors as object,
        competitors: profile.competitors.map((name, i) => ({
          id: crypto.randomUUID(),
          platform: 'web',
          handle: name,
          addedAt: new Date().toISOString(),
        })),
        logoUrl,
      },
      update: {
        websiteUrl,
        brandName: profile.brandName,
        industry: profile.industry,
        targetAudience: profile.targetAudience,
        valueProposition: profile.valueProposition,
        productDescription: profile.productDescription,
        tone: profile.tone,
        voiceCharacteristics: profile.voiceCharacteristics,
        contentPillars: profile.contentPillars,
        preferredHashtags: profile.preferredHashtags,
        prohibitedWords: profile.prohibitedWords,
        brandColors: profile.brandColors as object,
        logoUrl,
      },
    });

    // 6. Embed into vector DB
    if (this.vector) {
      const embeddingText = [
        profile.brandName, profile.industry, profile.valueProposition,
        profile.targetAudience, profile.tone, profile.voiceCharacteristics.join(' '),
      ].filter(Boolean).join('. ');

      await this.vector.upsert(
        VECTOR_COLLECTIONS.BRAND_KNOWLEDGE, userId, embeddingText,
        { userId, updatedAt: new Date().toISOString() },
      ).catch((err: unknown) => this.logger.warn(`Vector upsert failed: ${err}`));
    }

    this.logger.log(`Brand analysis complete for user=${userId}: ${profile.brandName}`);

    return {
      ...profile,
      logoUrl,
      imageUrls: savedImageUrls,
      markdownR2Key,
      markdownUrl,
      markdownContent,
    };
  }

  async getMarkdown(userId: string): Promise<{ url: string; key: string } | null> {
    const r2Key = `${userId}/brand-knowledge.md`;
    try {
      const meta = await this.storage?.headObject(r2Key);
      if (!meta) return null;
      const url = await this.storage?.generatePresignedDownloadUrl(r2Key, 3600) ?? '';
      return { url, key: r2Key };
    } catch {
      return null;
    }
  }

  // ── Scraping ───────────────────────────────────────────────────────────────

  private async scrapeWebsite(websiteUrl: string) {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ userAgent: USER_AGENT });

    const allText: string[] = [];
    const allImages: string[] = [];
    let logoUrl = '';
    let metaTags: Record<string, string> = {};

    const pagesToVisit = [websiteUrl];

    // Try to find about/services pages from nav links on homepage
    try {
      const homePage = await context.newPage();
      await homePage.goto(websiteUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await homePage.waitForTimeout(1500);

      const homeData = await homePage.evaluate(() => {
        const d = (globalThis as any).window.document;

        // Extract nav links for about/services/product pages
        const navLinks: string[] = Array.from(d.querySelectorAll('nav a[href], header a[href]'))
          .map((a: any) => a.href as string)
          .filter((h: string) => h.startsWith('http'))
          .filter((h: string) => /about|service|product|feature|solution|team|story|mission|who-we/i.test(h))
          .slice(0, 3);

        // Logo detection
        const logoEl: any = d.querySelector('img[alt*="logo" i], img[class*="logo" i], img[src*="logo" i], header img, .logo img, #logo img');
        const logo: string = logoEl?.src ?? '';

        // Meta tags
        const meta: Record<string, string> = {};
        (d.querySelectorAll('meta[name], meta[property]') as any[]).forEach((m: any) => {
          const k: string = m.getAttribute('name') ?? m.getAttribute('property') ?? '';
          const v: string = m.getAttribute('content') ?? '';
          if (k && v) meta[k] = v;
        });

        // Images
        const imgs: string[] = Array.from(d.querySelectorAll('main img[src], section img[src], article img[src]') as any[])
          .map((img: any) => img.src as string)
          .filter((s: string) => s.startsWith('http') && !s.includes('data:'))
          .filter((s: string, i: number, arr: string[]) => arr.indexOf(s) === i)
          .slice(0, 30);

        // Text
        const mainEl: any = d.querySelector('main, [role="main"], article, .content, #content, body');
        const text: string = mainEl?.innerText ?? d.body?.innerText ?? '';

        return { navLinks, logo, meta, imgs, text };
      });

      if (homeData.logo) logoUrl = homeData.logo;
      metaTags = homeData.meta;
      allText.push(homeData.text.slice(0, 8000));
      allImages.push(...homeData.imgs);
      pagesToVisit.push(...homeData.navLinks);

      await homePage.close();

      // Scrape up to 3 sub-pages
      for (const subUrl of homeData.navLinks.slice(0, 3)) {
        try {
          const subPage = await context.newPage();
          await subPage.goto(subUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await subPage.waitForTimeout(1000);
          const subText = await subPage.evaluate(() => {
            const d = (globalThis as any).window.document;
            const mainEl: any = d.querySelector('main, [role="main"], article, body');
            return (mainEl?.innerText ?? '') as string;
          });
          allText.push(subText.slice(0, 4000));
          await subPage.close();
        } catch {
          // non-fatal
        }
      }
    } finally {
      await browser.close();
    }

    return {
      textContent: allText.join('\n\n---\n\n'),
      imageUrls: [...new Set(allImages)],
      logoUrl,
      metaTags,
    };
  }

  // ── Image Download ─────────────────────────────────────────────────────────

  private async downloadImages(
    userId: string,
    imageUrls: string[],
    logoUrl: string,
    websiteUrl: string,
  ): Promise<{ logoUrl: string; savedImageUrls: string[] }> {
    if (!this.storage) return { logoUrl, savedImageUrls: imageUrls.slice(0, 10) };

    const savedUrls: string[] = [];
    const origin = new URL(websiteUrl).hostname;

    // Download logo first
    let savedLogoUrl = logoUrl;
    if (logoUrl) {
      try {
        const res = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const mime = res.headers.get('content-type') ?? 'image/png';
          const ext = mime.split('/')[1]?.split(';')[0] ?? 'png';
          const r2Key = `${userId}/brand/logo.${ext}`;
          const stored = await this.storage.putObject(r2Key, buf, mime, { source: 'brand-analysis', origin });
          savedLogoUrl = stored.publicUrl;
        }
      } catch (err) {
        this.logger.warn(`Logo download failed: ${err}`);
      }
    }

    // Download up to 10 brand images
    const toDownload = imageUrls.filter((u) => u !== logoUrl).slice(0, 10);
    for (let i = 0; i < toDownload.length; i++) {
      try {
        const res = await fetch(toDownload[i], { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        const mime = res.headers.get('content-type') ?? 'image/jpeg';
        if (!mime.startsWith('image/')) continue;
        const ext = mime.split('/')[1]?.split(';')[0] ?? 'jpg';
        const r2Key = `${userId}/brand/images/${i + 1}.${ext}`;
        const stored = await this.storage.putObject(r2Key, buf, mime, { source: 'brand-analysis', origin });
        savedUrls.push(stored.publicUrl);
      } catch {
        // non-fatal
      }
    }

    return { logoUrl: savedLogoUrl, savedImageUrls: savedUrls };
  }

  // ── LLM Enrichment ─────────────────────────────────────────────────────────

  private async enrichWithLlm(
    websiteUrl: string,
    textContent: string,
    metaTags: Record<string, string>,
  ): Promise<Omit<BrandAnalysisResult, 'logoUrl' | 'imageUrls' | 'markdownR2Key' | 'markdownUrl' | 'markdownContent'>> {
    if (!this.llm) {
      return this.fallbackProfile(websiteUrl, metaTags);
    }

    const metaStr = Object.entries(metaTags)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    const response = await this.llm.route({
      systemPrompt: 'You are an expert brand strategist. Extract brand intelligence from website content. Always respond with valid JSON only — no markdown, no explanation.',
      messages: [{
        role: 'user',
        content: `Analyze this website and extract a complete brand knowledge profile.

Website: ${websiteUrl}

Meta tags:
${metaStr.slice(0, 1000)}

Website content:
${textContent.slice(0, 14000)}

Return ONLY valid JSON with this exact structure:
{
  "brandName": "company name",
  "industry": "industry category (e.g. SaaS, E-commerce, Fashion, FinTech)",
  "targetAudience": "detailed description of ideal customer (age, role, pain points, goals)",
  "valueProposition": "the core promise in 1-2 sentences",
  "productDescription": "what they sell or do in 2-3 sentences",
  "tone": "professional|casual|witty|inspirational|educational|authoritative|friendly|bold",
  "voiceCharacteristics": ["3-5 adjectives describing brand voice"],
  "contentPillars": ["4-6 content themes (e.g. tutorials, case studies, behind-the-scenes)"],
  "preferredHashtags": ["10-15 relevant hashtags without #"],
  "prohibitedWords": ["5-10 words that don't fit this brand"],
  "brandColors": {
    "primary": "#hexcode (most dominant brand color)",
    "secondary": ["#hexcode", "#hexcode"],
    "accent": "#hexcode"
  },
  "competitors": ["3-5 likely competitor brand/company names"],
  "socialMediaStrategy": {
    "bestPlatforms": ["instagram", "linkedin", etc],
    "postingFrequency": "e.g. daily",
    "contentMix": { "educational": 40, "promotional": 20, "engagement": 40 }
  },
  "seoKeywords": ["10-15 primary SEO keywords"],
  "uniqueSellingPoints": ["3-5 key differentiators"],
  "callToAction": "primary CTA text they use (e.g. Start free trial)"
}`,
      }],
      routing: { forceModel: 'claude-sonnet-4-6' },
    });

    return this.parseProfile(response.content, websiteUrl, metaTags);
  }

  // ── Markdown Generation ────────────────────────────────────────────────────

  private async saveMarkdown(
    userId: string,
    websiteUrl: string,
    profile: Omit<BrandAnalysisResult, 'logoUrl' | 'imageUrls' | 'markdownR2Key' | 'markdownUrl' | 'markdownContent'>,
    logoUrl: string,
    imageUrls: string[],
  ): Promise<{ markdownContent: string; markdownR2Key: string; markdownUrl: string }> {
    const md = this.buildMarkdown(websiteUrl, profile, logoUrl, imageUrls);

    const r2Key = `${userId}/brand-knowledge.md`;
    let markdownUrl = '';

    if (this.storage) {
      try {
        const stored = await this.storage.putObject(
          r2Key,
          Buffer.from(md, 'utf8'),
          'text/markdown',
          { userId, source: 'brand-analysis', website: websiteUrl, generatedAt: new Date().toISOString() },
        );
        markdownUrl = stored.publicUrl;
      } catch (err) {
        this.logger.warn(`Failed to save markdown to R2: ${err}`);
      }
    }

    return { markdownContent: md, markdownR2Key: r2Key, markdownUrl };
  }

  private buildMarkdown(
    websiteUrl: string,
    profile: any,
    logoUrl: string,
    imageUrls: string[],
  ): string {
    const now = new Date().toISOString().split('T')[0];
    const lines: string[] = [];

    lines.push(`# Brand Knowledge Base — ${profile.brandName}`);
    lines.push(`> Generated by Loraloop AI · Analyzed: ${now} · Source: ${websiteUrl}`);
    lines.push('');

    if (logoUrl) {
      lines.push(`![${profile.brandName} Logo](${logoUrl})`);
      lines.push('');
    }

    lines.push('---');
    lines.push('');

    // Overview
    lines.push('## 🏢 Brand Overview');
    lines.push('');
    lines.push(`| Field | Value |`);
    lines.push(`|-------|-------|`);
    lines.push(`| **Brand Name** | ${profile.brandName} |`);
    lines.push(`| **Industry** | ${profile.industry} |`);
    lines.push(`| **Website** | [${websiteUrl}](${websiteUrl}) |`);
    lines.push(`| **Business Model** | ${profile.businessModel ?? 'N/A'} |`);
    lines.push('');

    // Value Proposition
    lines.push('## 🎯 Value Proposition');
    lines.push('');
    lines.push(`> ${profile.valueProposition}`);
    lines.push('');

    // Product Description
    lines.push('## 📦 Product / Service');
    lines.push('');
    lines.push(profile.productDescription);
    lines.push('');

    // Target Audience
    lines.push('## 👥 Target Audience');
    lines.push('');
    lines.push(profile.targetAudience);
    lines.push('');

    // Brand Voice
    lines.push('## 🎙️ Brand Voice & Tone');
    lines.push('');
    lines.push(`**Primary Tone:** ${profile.tone}`);
    lines.push('');
    lines.push('**Voice Characteristics:**');
    profile.voiceCharacteristics?.forEach((v: string) => lines.push(`- ${v}`));
    lines.push('');

    // Brand Colors
    if (profile.brandColors) {
      lines.push('## 🎨 Brand Colors');
      lines.push('');
      lines.push(`- **Primary:** \`${profile.brandColors.primary}\``);
      if (profile.brandColors.secondary?.length) {
        lines.push(`- **Secondary:** ${profile.brandColors.secondary.map((c: string) => `\`${c}\``).join(', ')}`);
      }
      if (profile.brandColors.accent) {
        lines.push(`- **Accent:** \`${profile.brandColors.accent}\``);
      }
      lines.push('');
    }

    // Content Strategy
    lines.push('## 📱 Content Strategy');
    lines.push('');
    lines.push('### Content Pillars');
    profile.contentPillars?.forEach((p: string) => lines.push(`- ${p}`));
    lines.push('');

    if (profile.socialMediaStrategy) {
      lines.push('### Social Media');
      lines.push(`- **Best Platforms:** ${profile.socialMediaStrategy.bestPlatforms?.join(', ')}`);
      lines.push(`- **Posting Frequency:** ${profile.socialMediaStrategy.postingFrequency}`);
      lines.push('');
    }

    if (profile.preferredHashtags?.length) {
      lines.push('### Hashtags');
      lines.push(profile.preferredHashtags.map((h: string) => `#${h.replace('#', '')}`).join(' '));
      lines.push('');
    }

    // SEO Keywords
    if (profile.seoKeywords?.length) {
      lines.push('## 🔍 SEO Keywords');
      lines.push('');
      lines.push(profile.seoKeywords.join(', '));
      lines.push('');
    }

    // Unique Selling Points
    if (profile.uniqueSellingPoints?.length) {
      lines.push('## ⭐ Unique Selling Points');
      lines.push('');
      profile.uniqueSellingPoints.forEach((u: string) => lines.push(`- ${u}`));
      lines.push('');
    }

    // Prohibited Words
    if (profile.prohibitedWords?.length) {
      lines.push('## 🚫 Prohibited Words');
      lines.push('');
      lines.push(profile.prohibitedWords.join(', '));
      lines.push('');
    }

    // Competitors
    if (profile.competitors?.length) {
      lines.push('## 🏆 Competitors');
      lines.push('');
      profile.competitors.forEach((c: string) => lines.push(`- ${c}`));
      lines.push('');
    }

    // Brand Images
    if (imageUrls.length > 0) {
      lines.push('## 🖼️ Brand Images');
      lines.push('');
      imageUrls.slice(0, 6).forEach((url, i) => {
        lines.push(`![Brand Image ${i + 1}](${url})`);
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push(`*Auto-generated by Loraloop AI on ${now}. Update manually as needed.*`);

    return lines.join('\n');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private parseProfile(
    text: string,
    websiteUrl: string,
    metaTags: Record<string, string>,
  ): Omit<BrandAnalysisResult, 'logoUrl' | 'imageUrls' | 'markdownR2Key' | 'markdownUrl' | 'markdownContent'> {
    try {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
      const parsed = JSON.parse(match?.[1] ?? text);
      return {
        brandName: parsed.brandName ?? new URL(websiteUrl).hostname,
        industry: parsed.industry ?? '',
        targetAudience: parsed.targetAudience ?? '',
        valueProposition: parsed.valueProposition ?? '',
        productDescription: parsed.productDescription ?? '',
        tone: parsed.tone ?? 'professional',
        voiceCharacteristics: parsed.voiceCharacteristics ?? [],
        contentPillars: parsed.contentPillars ?? [],
        preferredHashtags: parsed.preferredHashtags ?? [],
        prohibitedWords: parsed.prohibitedWords ?? [],
        brandColors: parsed.brandColors ?? { primary: '#000000', secondary: [], accent: '#ffffff' },
        competitors: parsed.competitors ?? [],
        ...(parsed.socialMediaStrategy ? { socialMediaStrategy: parsed.socialMediaStrategy } : {}),
        ...(parsed.seoKeywords ? { seoKeywords: parsed.seoKeywords } : {}),
        ...(parsed.uniqueSellingPoints ? { uniqueSellingPoints: parsed.uniqueSellingPoints } : {}),
        ...(parsed.callToAction ? { callToAction: parsed.callToAction } : {}),
      } as any;
    } catch {
      return this.fallbackProfile(websiteUrl, metaTags);
    }
  }

  private fallbackProfile(
    websiteUrl: string,
    metaTags: Record<string, string>,
  ): Omit<BrandAnalysisResult, 'logoUrl' | 'imageUrls' | 'markdownR2Key' | 'markdownUrl' | 'markdownContent'> {
    return {
      brandName: metaTags['og:site_name'] ?? new URL(websiteUrl).hostname,
      industry: '',
      targetAudience: metaTags['og:description'] ?? '',
      valueProposition: metaTags['description'] ?? metaTags['og:description'] ?? '',
      productDescription: metaTags['og:description'] ?? '',
      tone: 'professional',
      voiceCharacteristics: [],
      contentPillars: [],
      preferredHashtags: [],
      prohibitedWords: [],
      brandColors: { primary: '#000000', secondary: [], accent: '#ffffff' },
      competitors: [],
    };
  }

  // ── Core CRUD (unchanged) ──────────────────────────────────────────────────

  async get(userId: string) {
    return this.prisma.brandKnowledge.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async update(userId: string, dto: UpdateBrandDto) {
    const updated = await this.prisma.brandKnowledge.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });

    await this.eventBus.emit(KAFKA_TOPICS.BRAND_KNOWLEDGE_UPDATED, {
      eventType: 'brand.knowledge.updated',
      userId,
      payload: { brandId: userId, userId, changedFields: Object.keys(dto) },
    });

    if (this.vector) {
      const text = [
        dto.brandName,
        dto.brandDescription,
        dto.tone,
        (dto.preferredHashtags as string[] | undefined)?.join(' '),
      ].filter(Boolean).join('. ');
      if (text.trim()) {
        await this.vector
          .upsert(VECTOR_COLLECTIONS.BRAND_KNOWLEDGE, userId, text, {
            userId,
            updatedAt: new Date().toISOString(),
          })
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
    tone?: string;
    voiceCharacteristics?: string[];
    brandDescription?: string;
    valueProposition?: string;
    autoReplyEnabled?: boolean;
    sentimentThreshold?: number;
  }) {
    const data: Record<string, unknown> = {};
    if (dto.tone !== undefined) data.tone = dto.tone;
    if (dto.voiceCharacteristics !== undefined) data.voiceCharacteristics = dto.voiceCharacteristics;
    if (dto.brandDescription !== undefined) data.productDescription = dto.brandDescription;
    if (dto.valueProposition !== undefined) data.valueProposition = dto.valueProposition;
    if (dto.autoReplyEnabled !== undefined) data.autoReplyEnabled = dto.autoReplyEnabled;
    if (dto.sentimentThreshold !== undefined) data.sentimentThreshold = dto.sentimentThreshold;

    return this.prisma.brandKnowledge.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async getCompetitors(userId: string): Promise<Competitor[]> {
    const brand = await this.get(userId);
    return (brand.competitors as unknown as Competitor[]) ?? [];
  }

  async addCompetitor(userId: string, platform: string, handle: string): Promise<Competitor> {
    const brand = await this.get(userId);
    const existing = (brand.competitors as unknown as Competitor[]) ?? [];

    const dupe = existing.find(
      (c) => c.platform === platform && c.handle.toLowerCase() === handle.toLowerCase(),
    );
    if (dupe) return dupe;

    const entry: Competitor = {
      id: crypto.randomUUID(),
      platform,
      handle,
      addedAt: new Date().toISOString(),
    };

    await this.prisma.brandKnowledge.update({
      where: { userId },
      data: { competitors: [...existing, entry] as any },
    });

    return entry;
  }

  async removeCompetitor(userId: string, competitorId: string): Promise<void> {
    const brand = await this.get(userId);
    const existing = (brand.competitors as unknown as Competitor[]) ?? [];
    const filtered = existing.filter((c) => c.id !== competitorId);

    if (filtered.length === existing.length) throw new NotFoundException('Competitor not found');

    await this.prisma.brandKnowledge.update({
      where: { userId },
      data: { competitors: filtered as any },
    });
  }

  async addHashtags(userId: string, hashtags: string[]) {
    const brand = await this.get(userId);
    const existing = (brand.preferredHashtags as string[]) ?? [];
    const merged = [...new Set([...existing, ...hashtags])];
    return this.prisma.brandKnowledge.update({
      where: { userId },
      data: { preferredHashtags: merged },
    });
  }

  async removeHashtag(userId: string, hashtag: string) {
    const brand = await this.get(userId);
    const updated = ((brand.preferredHashtags as string[]) ?? []).filter((h) => h !== hashtag);
    return this.prisma.brandKnowledge.update({
      where: { userId },
      data: { preferredHashtags: updated },
    });
  }

  async addProhibitedWords(userId: string, words: string[]) {
    const brand = await this.get(userId);
    const existing = (brand.prohibitedWords as string[]) ?? [];
    const merged = [...new Set([...existing, ...words.map((w) => w.toLowerCase())])];
    return this.prisma.brandKnowledge.update({
      where: { userId },
      data: { prohibitedWords: merged },
    });
  }
}
