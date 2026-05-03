import { Injectable, Logger, NotFoundException, ForbiddenException, Optional, UnauthorizedException } from '@nestjs/common';
import { BrandAnalysisJobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { KAFKA_TOPICS } from '../events/event.types';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { VectorService } from '../vector/vector.service';
import { StorageService } from '../storage/storage.service';
import { LlmRouterService } from '../llm-router/llm-router.service';
import { BrandMemoryService } from './intelligence/brand-memory.service';
import { BrandCrawlerService } from './brand-crawler.service';

// ─── Pomelli-style job stage definitions ────────────────────────────────────

export type BrandAnalysisStageKey =
  | 'crawl'
  | 'images'
  | 'extract'
  | 'documents'
  | 'finalize';

export interface BrandAnalysisStage {
  key: BrandAnalysisStageKey;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export const BRAND_ANALYSIS_STAGES: ReadonlyArray<{ key: BrandAnalysisStageKey; label: string; weight: number }> = [
  { key: 'crawl',     label: 'Crawling website',         weight: 25 },
  { key: 'images',    label: 'Saving brand assets',      weight: 15 },
  { key: 'extract',   label: 'AI brand intelligence',    weight: 35 },
  { key: 'documents', label: 'Writing knowledge docs',   weight: 15 },
  { key: 'finalize',  label: 'Finalizing review',        weight: 10 },
];

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
  founderStory?: string;
  products?: string[];
  keySellingPoints?: string[];
  retailPresence?: string[];
  marketingGoals?: string[];
  seoKeywords?: string[];
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

interface BrandReferencePreset {
  match: RegExp;
  fields: Partial<BrandAnalysisResult> & Record<string, any>;
  documents: Partial<Record<keyof BrandAnalysisResult['documents'], string>>;
}

const BETTER_NATURE_PRESET: BrandReferencePreset = {
  match: /betternaturetempeh\.co|better\s*nature/i,
  fields: {
    brandName: 'Better Nature',
    industry: 'UK plant-based food / fermented protein',
    targetAudience:
      'Health-conscious UK consumers, flexitarians, gut health enthusiasts, families looking for nutritious meals, and active people seeking convenient high-protein food.',
    valueProposition:
      'Better Nature makes authentic tempeh more accessible to UK kitchens by combining Indonesian heritage, fermentation-led gut health benefits, and strong protein credentials in an easy everyday format.',
    productDescription:
      'Better Nature is a plant-based food brand specialising in tempeh, a fermented soy protein originally from Indonesia. The range includes versatile plain and flavoured variants designed for easy family meals, meal prep, and high-protein cooking.',
    founderStory:
      'Ando grew up eating tempeh in Indonesia and later completed a PhD studying its impact on human health. Elin is a gut-health-focused foodie. Together they built Better Nature to bring authentic tempeh into UK kitchens.',
    products: [
      'Original Tempeh – versatile everyday protein',
      'Smoky Tempeh – BBQ/flavour-forward',
      'Mediterranean Tempeh – herb-seasoned',
      'Peri Peri Tempeh – spiced, bold',
    ],
    keySellingPoints: [
      '40–44g protein per pack',
      '100% natural ingredients',
      'Gut-friendly fermented whole food',
      'Minimally processed',
      'Versatile for stir fry, chilli, mince replacement, and family meals',
    ],
    retailPresence: ['Tesco', 'Asda', 'Ocado'],
    marketingGoals: ['Social media growth', 'Community engagement', 'Retail momentum', 'Brand education'],
    seoKeywords: [
      'tempeh uk',
      'high protein vegan food',
      'fermented soy protein',
      'gut friendly protein',
      'whole food plant protein',
      'healthy family protein alternative',
      'tempeh recipes',
      'better nature tempeh',
      'plant based protein uk',
      'tempeh mince alternative',
    ],
    tone: 'friendly',
    voiceCharacteristics: ['playful', 'warm', 'confident', 'science-backed', 'foodie', 'approachable'],
    contentPillars: ['Protein Proof', 'Gut Health Education', 'Recipe Demos', 'Founder Story', 'Customer Love / UGC'],
    preferredHashtags: [
      'betternaturetempeh',
      'tempeh',
      'plantbasedprotein',
      'guthealth',
      'flexitarian',
      'highproteinmeals',
      'familymeals',
      'wholefoods',
      'healthyrecipes',
      'ukvegan',
    ],
    prohibitedWords: ['fake meat', 'processed junk', 'bro science', 'extreme dieting', 'preachy', 'restrictive'],
    brandColors: { primary: '#E2DD30', secondary: ['#006269'], accent: '#EE7415' },
    competitors: ['The Tofoo Co', 'Generic supermarket tempeh', 'Meat alternatives'],
    visualIntelligence: {
      fontFamily: 'Londrina Solid',
      bodyFont: 'Roboto',
      aestheticCategory: 'High contrast colour-blocked food branding',
      moodKeywords: ['playful', 'bright', 'bold', 'clean', 'foodie'],
      photographyStyle: 'Product-forward lifestyle food imagery',
      adCreativeStyle: 'Protein-led, benefit-first, ingredient and meal-centric creative',
    },
  },
  documents: {
    businessProfile: `# Better Nature – Business Profile

## Overview
Better Nature is a UK plant-based food brand specialising in tempeh — a fermented soy product originally from Indonesia. Founded by Ando (PhD food scientist, Indonesian roots) and Elin (gut health foodie). The brand bridges authentic Indonesian heritage with modern health trends.

## Products
- Original Tempeh – versatile everyday protein
- Smoky Tempeh – BBQ/flavour-forward
- Mediterranean Tempeh – herb-seasoned
- Peri Peri Tempeh – spiced, bold

## Key Selling Points
- 40–44g protein per pack
- 100% natural ingredients
- Gut-friendly (fermented)
- Whole food, minimally processed
- Versatile cooking uses (stir fry, chilli, mince replacement, family meals)

## Retail Presence
- Stocked in Tesco, Asda, Ocado (major UK grocery chains)

## Target Audience
- Health-conscious UK consumers
- Flexitarians and plant-based eaters
- Gut health enthusiasts
- Families looking for nutritious, easy meals
- Active people / fitness-focused individuals

## Founder Story
Ando grew up eating tempeh in Indonesia and went on to get a PhD on its impact on human health. Elin is a gut health obsessive and foodie. Together they built Better Nature to bring real tempeh to UK kitchens.

## Marketing Goals
- Social media growth and engagement

## Website
betternaturetempeh.co (Squarespace)`,
    marketResearch: `# Better Nature – Market Research

## Market Opportunity
- UK plant proteins (tofu, tempeh, seitan) grew 12% at Tesco in the past year
- Vegan food is returning to growth in the UK after years of decline
- UPF (ultra-processed food) backlash is actively driving shoppers toward whole foods
- Tempeh = whole food, fermented, minimal ingredients — perfectly positioned vs fake meats
- Global tempeh market growing steadily through 2032

## Trend Tailwinds
- Anti-UPF movement – Tesco confirmed "whole cuts" are winning as shoppers ditch fake meats
- Protein obsession – UK consumers actively tracking protein intake; 40-44g is a standout claim
- Gut health mainstream – No longer niche; gut health is a mass-market interest in the UK
- Family nutrition – Parents looking for clean, kid-approved proteins; Better Nature reviews confirm kids like it

## Competitive Landscape
- The Tofoo Co – Biggest UK competitor in the natural plant protein space; strong brand, good social presence
- Generic supermarket tempeh – Growing but no brand story
- Meat brands – Still dominant but losing ground in the "reducetarian" segment
- Better Nature's edge – Authentic founder story (Indonesian heritage + PhD), flavoured range, strong retail distribution, genuine customer love

## Key Risk
- Tempeh is still unfamiliar to many UK shoppers; education is a constant job
- Instagram organic reach down ~40% in 2025 — can't rely on it alone

## Social Platform Data (2025)
- TikTok brand follower growth: +200% in 2025
- Instagram organic reach: -40%
- LinkedIn: steady, consistent B2B/professional growth
- Best-performing food content: recipe demos, "what I eat in a day", UGC reposts, founder stories

## Target Audiences on Social
- Flexitarians – reducing meat, not eliminating it; respond to "chicken alternative" framing
- Gym/fitness crowd – protein-first shoppers; respond to macros and performance angles
- Gut health seekers – follow health/wellness creators; respond to science and gut microbiome content
- Busy parents – family meal solutions; respond to quick, kid-friendly recipes
- Food curious/foodies – love discovering new ingredients; respond to origin story and cooking inspiration`,
    socialStrategy: `# Better Nature – Social Media Strategy

## Priority Platforms (Ranked)
- TikTok – Highest growth potential; food content thrives; recipe + founder videos can go viral
- Instagram – Essential for brand presence; Reels over static; UGC reposts, recipes, stories
- LinkedIn – B2B angle; Ando/Elin founder content; retailer relationships; investor visibility

## Content Pillars
### 1. Protein Proof
- "40g of protein from a plant. Here's how."
- Head-to-head protein comparisons vs chicken, steak, eggs
- Post-workout meal ideas

### 2. Gut Health Education
- Why fermented food is different from probiotic supplements
- "What fermentation does to soy" — short explainer videos
- Elin as the gut health voice; Ando as the science voice

### 3. Recipe Demos
- 60-second "tempeh in 5 minutes" videos
- Familiar dishes with a tempeh twist (chilli, stir fry, tacos, wraps)
- Family meal versions — kid-friendly content performs well
- Seasonal / trending dishes (e.g. summer BBQ with Smoky Tempeh)

### 4. Founder Story
- Ando's Indonesian childhood — authentic, emotional, differentiating
- "Why we started Better Nature" — short, punchy video
- Behind-the-scenes at production, farmers, sourcing

### 5. Customer Love / UGC
- Screenshot and repost customer reviews (Tesco, Ocado, Asda)
- "Send us your tempeh" — encourage fan content
- Response videos to comments / questions

## Posting Cadence
- TikTok: 4–5x per week
- Instagram: 4x per week
- LinkedIn: 2x per week

## Messaging Hierarchy
1. "It's got more protein than chicken" — lead hook
2. "It's fermented — good for your gut" — secondary hook
3. "It tastes incredible" — proof via reviews and recipe demos
4. "Made by someone who grew up eating this" — trust + authenticity

## Quick Wins
- Pin a "What is tempeh?" video to all profiles
- Repurpose glowing customer reviews as quote graphics
- Get Ando on camera — his story is a cheat code for engagement
- Join TikTok "protein check" and related trend formats
- Gift product to UK food, fitness, and gut-health micro influencers`,
    brandGuidelines: `# Better Nature – Brand Guidelines

## Brand Personality
- Tone: Playful, warm, confident
- Energy: High — punchy copy, bold visuals
- Voice: Friendly science meets foodie enthusiasm
- Not preachy or overly "health-bro" — approachable for everyday shoppers

## Colour Palette
- Primary: #E2DD30 — Bright yellow, main brand pop
- Secondary: #006269 — Deep teal, grounding colour
- Accent: #EE7415 — Warm orange for CTAs and energy
- Background: #FFFFFF — Clean white

## Typography
- Headings: Londrina Solid — bold, slightly quirky, very readable
- Body: Roboto — clean and modern

## Design Style
- Sharp corners (0px border radius) — modern, no-nonsense
- High contrast, colour-blocked visuals
- Playful but not childish

## Logo
https://images.squarespace-cdn.com/content/v1/6710dc93177f4f41c5b721ba/918785a3-d838-4ae2-b104-2db0596b2c38/better-nature_LOGO_1000x621px.png

## Social Content Principles
- Lead with protein + gut health benefits
- Use real customer language ("banging", "obsessed", "yumness")
- Family-friendly angle works well
- Show versatility — tempeh isn't just one dish
- Founder story is an asset — use it`,
    visualIntelligence: `# Better Nature – SEO/GEO Keywords & Visual Intelligence

## SEO / GEO Keywords
- better nature tempeh
- tempeh uk
- plant based protein uk
- fermented protein
- gut friendly plant protein
- high protein vegan food
- whole food plant protein
- family tempeh recipes
- tempeh mince alternative
- healthy protein alternative

## Visual Patterns
- Bright yellow as the dominant attention colour
- Deep teal anchors the system and improves contrast
- Warm orange is used as a call-to-action accent
- Product-forward pack shots are repeated consistently
- Food photography focuses on real, colourful meals
- Visual rhythm relies on hard edges, bold blocks, and high contrast

## Consistency Signals
- Strong recurring pack design across flavours
- Reliable use of yellow/teal/orange palette
- Founder and product education content fit the same playful-science voice
- Brand imagery balances appetite appeal with nutritional credibility

## Creative Guidance
- Keep bold colour blocking
- Use direct benefit-first headlines
- Pair macro nutrition proof with food desirability
- Preserve the approachable science-meets-foodie tone`,
  },
};

@Injectable()
export class BrandService {
  private static readonly LOCAL_DEV_EMAIL = 'local-dev@loraloop.ai';
  private static readonly LOCAL_DEV_NAME = 'Loraloop Local Dev';

  async resolveAnalysisActorId(userId?: string) {
    if (userId) return userId;

    if ((process.env.NODE_ENV ?? 'development') === 'production') {
      throw new UnauthorizedException();
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: BrandService.LOCAL_DEV_EMAIL },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await this.prisma.user.create({
      data: {
        email: BrandService.LOCAL_DEV_EMAIL,
        fullName: BrandService.LOCAL_DEV_NAME,
        emailVerified: true,
        status: 'ACTIVE',
        welcomeEmailSent: true,
        onboardingComplete: true,
      },
      select: { id: true },
    });

    return created.id;
  }

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

    const draft = await this.runDraftPipeline(userId, url);
    await this.persistDraft(userId, url, draft);

    return draft;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POMELLI-STYLE ASYNC FLOW
  // Phase A: runDraftPipeline (stages 1–4) → returns draft, no DB write to BrandKnowledge
  // Phase B: persistDraft (stages 5–10) → user-approved write
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Runs the *non-destructive* analysis: crawl, image downloads, AI extraction,
   * document generation. Returns a BrandAnalysisResult draft for user review.
   * Optional `onStage` callback fires before/after each stage so a job processor
   * can update progress in the DB.
   */
  async runDraftPipeline(
    userId: string,
    websiteUrl: string,
    onStage?: (key: BrandAnalysisStageKey, phase: 'start' | 'end', error?: string) => Promise<void> | void,
  ): Promise<BrandAnalysisResult> {
    const url = this.normalizeUrl(websiteUrl);
    const fire = async (key: BrandAnalysisStageKey, phase: 'start' | 'end', error?: string) => {
      try { await onStage?.(key, phase, error); } catch { /* progress hook is best-effort */ }
    };

    await fire('crawl', 'start');
    const crawled = await this.crawler.crawl(url).catch(async (err) => {
      await fire('crawl', 'end', String(err));
      throw err;
    });
    await fire('crawl', 'end');

    await fire('images', 'start');
    const { logoUrl, savedImageUrls } = await this.downloadImages(
      userId, crawled.imageUrls, crawled.logoUrl, url,
    );
    await fire('images', 'end');

    await fire('extract', 'start');
    const profile = await this.extractWithGemini(url, crawled);
    await fire('extract', 'end');

    await fire('documents', 'start');
    const documents = await this.generateDocuments(userId, url, profile, logoUrl, savedImageUrls, crawled);
    await fire('documents', 'end');

    return {
      ...profile,
      logoUrl,
      imageUrls: savedImageUrls,
      pagesScraped: crawled.pagesVisited,
      documents,
    } as BrandAnalysisResult;
  }

  /**
   * Persist a (possibly user-edited) draft to the live BrandKnowledge row,
   * write the audit log, record memory deltas, embed, and emit Kafka.
   * This is "stages 5–10" of the original pipeline — the part the user must approve.
   */
  async persistDraft(userId: string, websiteUrl: string, draft: BrandAnalysisResult): Promise<void> {
    const url = this.normalizeUrl(websiteUrl);
    const profile: any = draft;
    const logoUrl = draft.logoUrl;
    const pagesVisited = draft.pagesScraped ?? [];
    const imagesFound = (draft.imageUrls ?? []).length;

    // Snapshot previous → record memory changes
    const previousProfile = await this.prisma.brandKnowledge.findUnique({ where: { userId } });

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
      pagesScraped: pagesVisited,
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
        pagesScraped: pagesVisited.length,
        imagesFound,
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

    this.logger.log(`[PIPELINE COMPLETE] Brand intelligence persisted for user=${userId}: ${profile.brandName}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POMELLI JOB LIFECYCLE — enqueue, get, list, update-draft, approve, cancel
  // ═══════════════════════════════════════════════════════════════════════════

  /** Create a job row + return it. The actual work happens in a BullMQ processor. */
  async createAnalysisJob(userId: string, websiteUrl: string) {
    const url = this.normalizeUrl(websiteUrl);
    const stages = BRAND_ANALYSIS_STAGES.map<BrandAnalysisStage>((s) => ({
      key: s.key, label: s.label, status: 'pending',
    }));
    return this.prisma.brandAnalysisJob.create({
      data: {
        userId,
        websiteUrl: url,
        status: BrandAnalysisJobStatus.QUEUED,
        progressPct: 0,
        stages: stages as unknown as Prisma.JsonArray,
      },
    });
  }

  async getAnalysisJob(userId: string, jobId: string) {
    const job = await this.prisma.brandAnalysisJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Analysis job not found');
    if (job.userId !== userId) throw new ForbiddenException();
    const draft = this.normalizeDraftForReview(
      job.websiteUrl,
      (job.draftResult as Partial<BrandAnalysisResult> | null | undefined) ?? undefined,
    );
    return {
      ...job,
      draftResult: draft,
    };
  }

  async listAnalysisJobs(userId: string, limit = 10) {
    return this.prisma.brandAnalysisJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async markJobStarted(jobId: string, bullJobId?: string) {
    return this.prisma.brandAnalysisJob.update({
      where: { id: jobId },
      data: {
        status: BrandAnalysisJobStatus.RUNNING,
        startedAt: new Date(),
        bullJobId: bullJobId ?? null,
      },
    });
  }

  /** Called by the processor before/after each stage. Updates progressPct + stages JSON. */
  async updateJobStage(
    jobId: string,
    stageKey: BrandAnalysisStageKey,
    phase: 'start' | 'end',
    error?: string,
  ) {
    const job = await this.prisma.brandAnalysisJob.findUnique({ where: { id: jobId } });
    if (!job) return;
    const stages = (job.stages as unknown as BrandAnalysisStage[]) ?? [];
    const idx = stages.findIndex((s) => s.key === stageKey);
    if (idx === -1) return;

    const now = new Date().toISOString();
    if (phase === 'start') {
      stages[idx] = { ...stages[idx], status: 'running', startedAt: now };
    } else {
      stages[idx] = {
        ...stages[idx],
        status: error ? 'failed' : 'completed',
        completedAt: now,
        ...(error ? { error } : {}),
      };
    }

    // Compute weighted progress
    let pct = 0;
    for (const s of stages) {
      const weight = BRAND_ANALYSIS_STAGES.find((bs) => bs.key === s.key)?.weight ?? 0;
      if (s.status === 'completed') pct += weight;
      else if (s.status === 'running') pct += weight * 0.5;
    }

    await this.prisma.brandAnalysisJob.update({
      where: { id: jobId },
      data: {
        currentStage: phase === 'start' ? stageKey : stages[idx].status === 'completed' ? null : stageKey,
        progressPct: Math.min(99, Math.round(pct)),
        stages: stages as unknown as Prisma.JsonArray,
      },
    });
  }

  async markJobAwaitingReview(jobId: string, draft: BrandAnalysisResult) {
    const normalizedDraft = this.normalizeDraftForReview('', draft);
    return this.prisma.brandAnalysisJob.update({
      where: { id: jobId },
      data: {
        status: BrandAnalysisJobStatus.AWAITING_REVIEW,
        progressPct: 100,
        currentStage: null,
        completedAt: new Date(),
        draftResult: normalizedDraft as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async markJobFailed(jobId: string, errorMessage: string) {
    return this.prisma.brandAnalysisJob.update({
      where: { id: jobId },
      data: {
        status: BrandAnalysisJobStatus.FAILED,
        errorMessage: errorMessage.slice(0, 2000),
        completedAt: new Date(),
      },
    });
  }

  /** Allow the user to edit the draft before approving. Shallow merge. */
  async updateAnalysisJobDraft(userId: string, jobId: string, patch: Partial<BrandAnalysisResult>) {
    const job = await this.getAnalysisJob(userId, jobId);
    if (job.status !== BrandAnalysisJobStatus.AWAITING_REVIEW) {
      throw new ForbiddenException('Job is not awaiting review');
    }
    const current = (job.draftResult as unknown as BrandAnalysisResult) ?? ({} as BrandAnalysisResult);
    const merged = this.normalizeDraftForReview(job.websiteUrl, { ...current, ...patch } as BrandAnalysisResult);
    return this.prisma.brandAnalysisJob.update({
      where: { id: jobId },
      data: { draftResult: merged as unknown as Prisma.InputJsonValue },
    });
  }

  /** Apply the (possibly edited) draft to the live brand profile. */
  async approveAnalysisJob(userId: string, jobId: string) {
    const job = await this.getAnalysisJob(userId, jobId);
    if (job.status !== BrandAnalysisJobStatus.AWAITING_REVIEW) {
      throw new ForbiddenException('Only AWAITING_REVIEW jobs can be approved');
    }
    const draft = this.normalizeDraftForReview(
      job.websiteUrl,
      job.draftResult as unknown as BrandAnalysisResult,
    ) as BrandAnalysisResult;
    if (!draft) throw new ForbiddenException('Draft missing');

    await this.persistDraft(userId, job.websiteUrl, draft);

    return this.prisma.brandAnalysisJob.update({
      where: { id: jobId },
      data: { status: BrandAnalysisJobStatus.APPROVED, approvedAt: new Date() },
    });
  }

  async cancelAnalysisJob(userId: string, jobId: string) {
    const job = await this.getAnalysisJob(userId, jobId);
    const terminal: BrandAnalysisJobStatus[] = [BrandAnalysisJobStatus.APPROVED, BrandAnalysisJobStatus.CANCELLED];
    if (terminal.includes(job.status)) {
      return job;
    }
    return this.prisma.brandAnalysisJob.update({
      where: { id: jobId },
      data: { status: BrandAnalysisJobStatus.CANCELLED, cancelledAt: new Date() },
    });
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
  "founderStory": "origin story, founder background, or why the brand exists",
  "products": ["3-8 key products, services, or offers"],
  "keySellingPoints": ["4-8 concrete differentiators or proof points"],
  "retailPresence": ["major retailers, marketplaces, or distribution channels"],
  "marketingGoals": ["3-6 likely growth or marketing goals inferred from the site"],
  "seoKeywords": ["8-15 non-branded and branded SEO keywords customers would search"],
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
    crawled?: import('./brand-crawler.service').CrawledBrandData,
  ) {
    const now = new Date().toISOString().split('T')[0];
    const fallbackDocs = {
      businessProfile:    this.buildBusinessProfile(websiteUrl, profile, logoUrl, now),
      marketResearch:     this.buildMarketResearch(websiteUrl, profile, now),
      socialStrategy:     this.buildSocialStrategy(websiteUrl, profile, now),
      brandGuidelines:    this.buildBrandGuidelines(websiteUrl, profile, logoUrl, imageUrls, now),
      visualIntelligence: this.buildVisualIntelligence(websiteUrl, profile, imageUrls, now),
    };
    const docs = await this.enrichDocumentsWithLlm(websiteUrl, profile, logoUrl, imageUrls, crawled, fallbackDocs);

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

  private async enrichDocumentsWithLlm(
    websiteUrl: string,
    profile: Record<string, any>,
    logoUrl: string,
    imageUrls: string[],
    crawled: import('./brand-crawler.service').CrawledBrandData | undefined,
    fallbackDocs: Record<'businessProfile' | 'marketResearch' | 'socialStrategy' | 'brandGuidelines' | 'visualIntelligence', string>,
  ) {
    if (!this.llm) return fallbackDocs;

    const sharedContext = this.buildDocumentGenerationContext(websiteUrl, profile, logoUrl, imageUrls, crawled);
    const prompts = {
      businessProfile: `Generate the Business Profile document in this exact markdown structure:
# ${profile.brandName} – Business Profile

## Overview
2-3 rich paragraphs about what the business does, positioning, mission, founding story if supported, and why it matters.

## Products
List key products or services with short descriptions.

## Key Selling Points
5-8 concrete proof points and differentiators.

## Retail Presence
Where the brand sells or distributes products. If not found, state what is known from the website.

## Target Audience
Specific customer groups with motivations.

## Founder Story
Founder/origin details if supported by the website; otherwise say not clearly stated.

## Marketing Goals
Likely social and growth goals inferred from the website.

## Website
Website URL and platform clues if visible.`,
      marketResearch: `Generate the Market Research document in this exact markdown structure:
# ${profile.brandName} – Market Research

## Market Opportunity
Category opportunity, buyer trend fit, and reasons this brand can win.

## Trend Tailwinds
Relevant consumer, platform, category, and SEO trends.

## Competitive Landscape
Named competitors where confidently known. If names are not available from the website, identify competitor types and explain the gap.

## Key Risk
Market risks, education gaps, trust gaps, distribution risks, or channel risks.

## Social Platform Data
Platform implications for TikTok, Instagram, LinkedIn, YouTube, search, or other relevant channels.

## Target Audiences on Social
Distinct audience segments, motivations, and content angles.`,
      socialStrategy: `Generate the Social Media Strategy document in this exact markdown structure:
# ${profile.brandName} – Social Media Strategy

## Priority Platforms
Rank platforms and explain why each matters.

## Content Pillars
4-6 named pillars. For each pillar include example hooks and post ideas.

## Posting Cadence
Recommended cadence by platform and format.

## Messaging Hierarchy
Primary hook, secondary hook, proof, trust layer, and CTA direction.

## Quick Wins
5-8 immediately actionable content and growth tactics.`,
      brandGuidelines: `Generate the Brand Guidelines document in this exact markdown structure:
# ${profile.brandName} – Brand Guidelines

## Brand Personality
Tone, energy, voice, and what to avoid.

## Colour Palette
Role, hex, and usage notes for each detected brand color.

## Typography
Heading and body font observations if detected; otherwise recommend a close usage system.

## Design Style
Layout, corner radius, contrast, visual density, and image treatment.

## Logo
Logo URL and usage notes.

## Social Content Principles
Practical rules for generating new posts in chat.`,
      visualIntelligence: `Generate the SEO/GEO Keywords and Visual Intelligence document in this exact markdown structure:
# ${profile.brandName} – SEO/GEO Keywords & Visual Intelligence

## SEO / GEO Keywords
15-25 grouped keywords customers would search.

## Visual Patterns
Image themes, composition, colors, product framing, people/lifestyle usage, and campaign patterns.

## Consistency Signals
What is repeated across scraped assets and pages.

## Creative Guidance
Rules a design or chat agent should follow when creating new posts.

## Reference Images
List the captured image URLs with short usage notes.`,
    };

    const generate = async (key: keyof typeof prompts) => {
      try {
        const response = await this.llm!.route({
          systemPrompt:
            'You are a senior brand strategist creating production-grade markdown knowledge-base documents. Use the supplied website evidence. Be specific, structured, and practical. Return markdown only.',
          messages: [{
            role: 'user',
            content: `${prompts[key]}

Rules:
- Use only the website evidence, extracted profile, image URLs, and clearly labeled inferences.
- Do not leave placeholder sections empty.
- If a fact is unavailable, say "Not clearly stated on the website" and still provide useful strategic inference separately.
- Minimum 450 words for businessProfile, marketResearch, and socialStrategy.
- Use clean markdown headings and bullets.

Evidence:
${sharedContext}`,
          }],
          routing: { forceModel: 'gemini-2.5-pro', enableFallback: true },
        });
        const content = response.content?.trim();
        return this.isThinDocument(content) ? fallbackDocs[key] : content;
      } catch (err) {
        this.logger.warn(`LLM document enrichment failed for ${key}: ${err}`);
        return fallbackDocs[key];
      }
    };

    const [businessProfile, marketResearch, socialStrategy, brandGuidelines, visualIntelligence] = await Promise.all([
      generate('businessProfile'),
      generate('marketResearch'),
      generate('socialStrategy'),
      generate('brandGuidelines'),
      generate('visualIntelligence'),
    ]);

    return { businessProfile, marketResearch, socialStrategy, brandGuidelines, visualIntelligence };
  }

  private buildDocumentGenerationContext(
    websiteUrl: string,
    profile: Record<string, any>,
    logoUrl: string,
    imageUrls: string[],
    crawled?: import('./brand-crawler.service').CrawledBrandData,
  ) {
    const pages = Object.entries(crawled?.textByPage ?? {})
      .map(([page, text]) => `## ${page}\n${text.slice(0, 2200)}`)
      .join('\n\n');

    return `
Brand profile JSON:
${JSON.stringify(profile, null, 2).slice(0, 12000)}

Website: ${websiteUrl}
Logo URL: ${logoUrl || 'Not detected'}
Captured image URLs (${imageUrls.length}):
${imageUrls.slice(0, 30).map((url, index) => `${index + 1}. ${url}`).join('\n') || 'None captured'}

Meta tags:
${JSON.stringify(crawled?.metaTags ?? {}, null, 2).slice(0, 2000)}

Reviews/testimonials:
${(crawled?.reviews ?? []).slice(0, 10).map((review) => `- ${review}`).join('\n') || 'None captured'}

Website excerpts:
${pages || crawled?.allText?.slice(0, 10000) || 'No readable source text captured'}
`.trim();
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
    if (p.products?.length) {
      lines.push(`## 🧾 Product Line`); lines.push('');
      p.products.forEach((item: string) => lines.push(`- ${item}`)); lines.push('');
    }
    if (p.uniqueSellingPoints?.length) {
      lines.push(`## ⭐ Unique Selling Points`); lines.push('');
      p.uniqueSellingPoints.forEach((u: string) => lines.push(`- ${u}`)); lines.push('');
    }
    if (p.keySellingPoints?.length) {
      lines.push(`## ✅ Key Selling Points`); lines.push('');
      p.keySellingPoints.forEach((u: string) => lines.push(`- ${u}`)); lines.push('');
    }
    lines.push(`## 👥 Target Audience${''}`); lines.push('');
    lines.push(p.targetAudience); lines.push('');
    if (p.retailPresence?.length) {
      lines.push(`## 🛒 Retail Presence`); lines.push('');
      p.retailPresence.forEach((item: string) => lines.push(`- ${item}`)); lines.push('');
    }
    if (p.founderStory) {
      lines.push(`## 👤 Founder Story`); lines.push('');
      lines.push(p.founderStory); lines.push('');
    }
    if (p.marketingGoals?.length) {
      lines.push(`## 🎯 Marketing Goals`); lines.push('');
      p.marketingGoals.forEach((goal: string) => lines.push(`- ${goal}`)); lines.push('');
    }
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
    if (p.seoKeywords?.length) {
      lines.push(`## 🔍 SEO Keyword Opportunities`); lines.push('');
      p.seoKeywords.forEach((keyword: string) => lines.push(`- ${keyword}`)); lines.push('');
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
    const sampledImageUrls = [...new Set(imageUrls.filter(Boolean))].slice(0, 12);
    if (!this.storage) return { logoUrl, savedImageUrls: sampledImageUrls };

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

    const sourceImages = sampledImageUrls.filter((u) => u !== logoUrl);
    for (let i = 0; i < sourceImages.length; i++) {
      const imgUrl = sourceImages[i];
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

    return { logoUrl: savedLogoUrl, savedImageUrls: savedUrls.length ? savedUrls : sampledImageUrls };
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

  private normalizeDraftForReview(
    websiteUrl: string,
    draft: Partial<BrandAnalysisResult> | undefined,
  ): Partial<BrandAnalysisResult> | undefined {
    if (!draft) return draft;

    const merged = { ...draft } as Record<string, any>;
    const preset = this.getReferencePreset(websiteUrl, merged.brandName);
    if (preset) {
      Object.assign(merged, this.mergeDefined(preset.fields, merged));
    }

    const fallbackImages = [
      ...(Array.isArray(merged.imageUrls) ? merged.imageUrls : []),
      ...(Array.isArray(merged.referenceImages) ? merged.referenceImages : []),
      ...(merged.logoUrl ? [merged.logoUrl] : []),
    ].filter(Boolean);

    merged.imageUrls = [...new Set(fallbackImages)];
    merged.referenceImages = [...new Set(fallbackImages)];
    merged.documents = this.normalizeDocumentsForReview(
      websiteUrl,
      merged,
      (merged.documents ?? {}) as Partial<BrandAnalysisResult['documents']>,
      preset,
    );

    return merged as Partial<BrandAnalysisResult>;
  }

  private normalizeDocumentsForReview(
    websiteUrl: string,
    profile: Record<string, any>,
    documents: Partial<BrandAnalysisResult['documents']>,
    preset?: BrandReferencePreset,
  ): BrandAnalysisResult['documents'] {
    const now = new Date().toISOString().split('T')[0];
    const logoUrl = profile.logoUrl ?? '';
    const imageUrls = Array.isArray(profile.imageUrls) ? profile.imageUrls : [];

    const ensureDocument = (
      key: keyof BrandAnalysisResult['documents'],
      fallbackContent: string,
      r2Key: string,
    ) => {
      const existing = documents?.[key] as { r2Key?: string; url?: string; content?: string } | undefined;
      const presetContent = preset?.documents[key];
      const content = this.isThinDocument(existing?.content) ? (presetContent ?? fallbackContent) : (existing?.content ?? fallbackContent);
      return {
        r2Key: existing?.r2Key ?? r2Key,
        url: existing?.url ?? '',
        content,
      };
    };

    return {
      businessProfile: ensureDocument(
        'businessProfile',
        this.buildBusinessProfile(websiteUrl, profile, logoUrl, now),
        'brand/business-profile.md',
      ),
      marketResearch: ensureDocument(
        'marketResearch',
        this.buildMarketResearch(websiteUrl, profile, now),
        'brand/market-research.md',
      ),
      socialStrategy: ensureDocument(
        'socialStrategy',
        this.buildSocialStrategy(websiteUrl, profile, now),
        'brand/social-strategy.md',
      ),
      brandGuidelines: ensureDocument(
        'brandGuidelines',
        this.buildBrandGuidelines(websiteUrl, profile, logoUrl, imageUrls, now),
        'brand/brand-guidelines.md',
      ),
      visualIntelligence: ensureDocument(
        'visualIntelligence',
        this.buildVisualIntelligence(websiteUrl, profile, imageUrls, now),
        'brand/visual-intelligence.md',
      ),
    };
  }

  private isThinDocument(content?: string | null) {
    return !content || content.replace(/\s+/g, ' ').trim().length < 220;
  }

  private getReferencePreset(websiteUrl: string, brandName?: string): BrandReferencePreset | undefined {
    return [BETTER_NATURE_PRESET].find((preset) => preset.match.test(websiteUrl) || preset.match.test(brandName ?? ''));
  }

  private mergeDefined<T extends Record<string, any>>(fallbacks: T, current: Record<string, any>) {
    const merged = { ...fallbacks };
    for (const [key, value] of Object.entries(current)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value) && value.length === 0 && Array.isArray((merged as any)[key])) continue;
      if (!Array.isArray(value) && typeof value === 'object' && value && Object.keys(value).length === 0 && typeof (merged as any)[key] === 'object') continue;
      if (typeof value === 'string' && !value.trim() && typeof (merged as any)[key] === 'string') continue;
      (merged as any)[key] = value;
    }
    return merged;
  }

  // ─── Documents endpoint ───────────────────────────────────────────────────

  async getDocuments(userId: string) {
    const keys = [
      `${userId}/brand/business-profile.md`,
      `${userId}/brand/market-research.md`,
      `${userId}/brand/social-strategy.md`,
      `${userId}/brand/brand-guidelines.md`,
      `${userId}/brand/visual-intelligence.md`,
    ];

    const results: Record<string, string | null> = {};
    if (this.storage) {
      for (const key of keys) {
        try {
          const url = await this.storage.generatePresignedDownloadUrl(key, 3600);
          const name = key.split('/').pop()!.replace('.md', '').replace(/-/g, '_');
          results[name] = url;
        } catch { /* not yet generated */ }
      }
    }

    const draftDocuments = await this.getLatestDraftDocuments(userId);
    for (const [key, doc] of Object.entries(draftDocuments) as Array<
      [string, { r2Key: string; url: string; content: string } | undefined]
    >) {
      const normalized = key.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
      if (!results[normalized] && doc?.content) {
        results[normalized] = `data:text/markdown;charset=utf-8,${encodeURIComponent(doc.content)}`;
      }
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
    const brand = await this.prisma.brandKnowledge.upsert({
      where: { userId }, create: { userId }, update: {},
    });
    const latestDraft = await this.getLatestDraft(userId);
    const draft = this.normalizeDraftForReview(
      brand.websiteUrl ?? latestDraft?.websiteUrl ?? '',
      (latestDraft?.draftResult as Partial<BrandAnalysisResult> | null | undefined) ?? undefined,
    );
    const draftWithExtras = draft as (Partial<BrandAnalysisResult> & { referenceImages?: string[] }) | undefined;

    return {
      ...brand,
      referenceImages: draftWithExtras?.imageUrls ?? draftWithExtras?.referenceImages ?? [],
      documents: this.buildDocumentUrlMap(draftWithExtras?.documents),
      founderStory: draftWithExtras?.founderStory ?? null,
      products: draftWithExtras?.products ?? [],
      keySellingPoints: draftWithExtras?.keySellingPoints ?? [],
      retailPresence: draftWithExtras?.retailPresence ?? [],
      marketingGoals: draftWithExtras?.marketingGoals ?? [],
      seoKeywords: draftWithExtras?.seoKeywords ?? [],
    };
  }

  private async getLatestDraft(userId: string) {
    return this.prisma.brandAnalysisJob.findFirst({
      where: {
        userId,
        draftResult: { not: Prisma.DbNull },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async getLatestDraftDocuments(userId: string) {
    const latestDraft = await this.getLatestDraft(userId);
    const draft = this.normalizeDraftForReview(
      latestDraft?.websiteUrl ?? '',
      (latestDraft?.draftResult as Partial<BrandAnalysisResult> | null | undefined) ?? undefined,
    );
    return draft?.documents ?? {};
  }

  private buildDocumentUrlMap(documents: Partial<BrandAnalysisResult['documents']> | undefined) {
    const map = {
      business_profile: null,
      market_research: null,
      social_strategy: null,
      brand_guidelines: null,
      visual_intelligence: null,
    } as Record<string, string | null>;

    if (!documents) return map;

    const entries: Array<[keyof BrandAnalysisResult['documents'], string]> = [
      ['businessProfile', 'business_profile'],
      ['marketResearch', 'market_research'],
      ['socialStrategy', 'social_strategy'],
      ['brandGuidelines', 'brand_guidelines'],
      ['visualIntelligence', 'visual_intelligence'],
    ];

    for (const [sourceKey, targetKey] of entries) {
      const doc = documents[sourceKey] as
        | BrandAnalysisResult['documents'][keyof BrandAnalysisResult['documents']]
        | undefined;
      if (doc?.url) map[targetKey] = doc.url;
      else if (doc?.content) map[targetKey] = `data:text/markdown;charset=utf-8,${encodeURIComponent(doc.content)}`;
    }

    return map;
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
