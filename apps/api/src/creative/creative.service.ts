import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmRouterService } from '../llm-router/llm-router.service';

type CreativeType = 'SOCIAL_MEDIA' | 'SEO' | 'PAID_ADS' | 'EMAIL' | 'CONTENT' | 'VIDEO' | 'COMPETITOR_RESPONSE';

interface GenerateCreativeDto {
  type: CreativeType;
  count?: number;
  platform?: string;
  tone?: string;
  additionalContext?: string;
}

@Injectable()
export class CreativeService {
  private readonly logger = new Logger(CreativeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmRouterService,
  ) {}

  async generate(userId: string, projectId: string, dto: GenerateCreativeDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: {
        knowledgeBase: true,
        seoData: true,
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (!project.knowledgeBase) throw new NotFoundException('Generate knowledge base first by running a crawl');

    const kb = project.knowledgeBase;
    const businessProfile = kb.businessProfile as any;
    const brandVoice = kb.brandVoice as any;
    const count = dto.count ?? 5;

    let prompt: string;
    let forceModel: string;

    switch (dto.type) {
      case 'PAID_ADS':
        prompt = this.buildAdsPrompt(businessProfile, brandVoice, dto.platform, count, dto.additionalContext);
        forceModel = 'grok-3';
        break;
      case 'VIDEO':
        prompt = this.buildVideoPrompt(businessProfile, brandVoice, count, dto.additionalContext);
        forceModel = 'claude-sonnet-4-6';
        break;
      case 'EMAIL':
        prompt = this.buildEmailPrompt(businessProfile, brandVoice, count, dto.additionalContext);
        forceModel = 'claude-sonnet-4-6';
        break;
      case 'SOCIAL_MEDIA':
        prompt = this.buildSocialPrompt(businessProfile, brandVoice, dto.platform, count, dto.additionalContext);
        forceModel = 'grok-3';
        break;
      case 'COMPETITOR_RESPONSE':
        prompt = this.buildCompetitorResponsePrompt(kb.competitorInsights as any[], businessProfile, count);
        forceModel = 'claude-sonnet-4-6';
        break;
      default:
        prompt = this.buildContentPrompt(businessProfile, brandVoice, dto.type, count, dto.additionalContext);
        forceModel = 'claude-sonnet-4-6';
    }

    const response = await this.llm.route({
      systemPrompt: 'You are a world-class creative copywriter. Always respond with valid JSON only.',
      messages: [{ role: 'user', content: prompt }],
      routing: { forceModel },
    });

    const content = this.parseJson(response.content, { creatives: [] });

    const strategy = await this.prisma.strategy.create({
      data: {
        projectId,
        userId,
        type: dto.type,
        title: `${dto.type.replace(/_/g, ' ')} — ${dto.platform ?? 'All Platforms'}`,
        content,
        metadata: { platform: dto.platform, tone: dto.tone, count, model: forceModel },
      },
    });

    return strategy;
  }

  async listStrategies(userId: string, projectId: string, type?: CreativeType) {
    return this.prisma.strategy.findMany({
      where: { projectId, userId, ...(type ? { type } : {}) },
      orderBy: { generatedAt: 'desc' },
    });
  }

  async getStrategy(userId: string, strategyId: string) {
    const s = await this.prisma.strategy.findFirst({ where: { id: strategyId, userId } });
    if (!s) throw new NotFoundException('Strategy not found');
    return s;
  }

  async deleteStrategy(userId: string, strategyId: string) {
    await this.getStrategy(userId, strategyId);
    await this.prisma.strategy.delete({ where: { id: strategyId } });
    return { deleted: true };
  }

  private buildAdsPrompt(bp: any, bv: any, platform = 'Meta/Instagram', count: number, ctx?: string): string {
    return `You are a world-class direct-response copywriter. Create ${count} high-converting ad creatives for this brand.

BRAND: ${bp?.companyName ?? 'Brand'}
PRODUCT/SERVICE: ${bp?.productLines?.join(', ') ?? 'Products'}
VALUE PROP: ${bp?.valueProposition ?? ''}
AUDIENCE: ${bp?.targetAudience ?? ''}
BRAND VOICE: ${bv?.tone ?? 'professional'}, ${bv?.voiceAttributes?.join(', ') ?? ''}
PLATFORM: ${platform}
${ctx ? `CONTEXT: ${ctx}` : ''}

Return ONLY valid JSON:
{
  "creatives": [
    {
      "hook": "attention-grabbing first line (15 words max)",
      "headline": "primary ad headline",
      "body": "ad copy (50-100 words)",
      "cta": "call to action text",
      "angle": "fear|desire|curiosity|social proof|urgency|value",
      "format": "single image|carousel|video|story",
      "targetAudience": "specific segment",
      "visualDescription": "description of ideal image/video for this ad"
    }
  ]
}`;
  }

  private buildSocialPrompt(bp: any, bv: any, platform = 'Instagram', count: number, ctx?: string): string {
    return `Create ${count} high-engagement social media posts for this brand.

BRAND: ${bp?.companyName ?? 'Brand'}
INDUSTRY: ${bp?.industry ?? ''}
VALUE PROP: ${bp?.valueProposition ?? ''}
AUDIENCE: ${bp?.targetAudience ?? ''}
VOICE: ${bv?.tone ?? 'casual'}, ${bv?.sampleCaptions?.[0] ?? ''}
PLATFORM: ${platform}
${ctx ? `CONTEXT: ${ctx}` : ''}

Return ONLY valid JSON:
{
  "creatives": [
    {
      "caption": "full post text with line breaks",
      "hook": "first line (must stop the scroll)",
      "hashtags": ["10-15 relevant hashtags"],
      "format": "single image|carousel|reel|story",
      "contentPillar": "educational|entertaining|inspirational|promotional|behind-scenes",
      "visualDescription": "what image/video to pair with this post",
      "estimatedEngagement": "high|medium|low",
      "bestPostTime": "e.g. Tuesday 6-8pm"
    }
  ]
}`;
  }

  private buildVideoPrompt(bp: any, bv: any, count: number, ctx?: string): string {
    return `Create ${count} video concepts and scripts for this brand.

BRAND: ${bp?.companyName ?? 'Brand'}
PRODUCT: ${bp?.productLines?.join(', ') ?? ''}
AUDIENCE: ${bp?.targetAudience ?? ''}
${ctx ? `CONTEXT: ${ctx}` : ''}

Return ONLY valid JSON:
{
  "creatives": [
    {
      "title": "video title",
      "format": "reel (15-30s)|TikTok (30-60s)|YouTube short (60s)|explainer (2-3min)",
      "hook": "opening 3 seconds (what happens first)",
      "storyboard": [
        { "second": "0-3", "visual": "what's on screen", "audio": "voiceover/music/SFX", "text": "on-screen text" }
      ],
      "cta": "end call to action",
      "estimatedReach": "organic potential"
    }
  ]
}`;
  }

  private buildEmailPrompt(bp: any, bv: any, count: number, ctx?: string): string {
    return `Write ${count} email marketing sequences for this brand.

BRAND: ${bp?.companyName ?? 'Brand'}
VOICE: ${bv?.tone ?? 'professional'}
VALUE PROP: ${bp?.valueProposition ?? ''}
${ctx ? `CONTEXT: ${ctx}` : ''}

Return ONLY valid JSON:
{
  "creatives": [
    {
      "type": "welcome|nurture|promotional|re-engagement|cart abandonment",
      "subject": "email subject line",
      "preheader": "preview text",
      "bodyText": "full email body",
      "cta": "button text + destination description",
      "sendTiming": "e.g. Day 1 of onboarding, 10am Tuesday"
    }
  ]
}`;
  }

  private buildCompetitorResponsePrompt(competitors: any[], bp: any, count: number): string {
    const compStr = competitors?.slice(0, 5).map((c: any) => `${c.name}: ${c.positioning}`).join('\n') ?? '';
    return `Create ${count} competitor-response marketing angles for this brand.

OUR BRAND: ${bp?.companyName ?? 'Brand'}
OUR DIFFERENTIATORS: ${bp?.keyDifferentiators?.join(', ') ?? ''}
COMPETITORS:
${compStr}

Return ONLY valid JSON:
{
  "creatives": [
    {
      "angle": "the positioning angle (e.g. we do X better than Y)",
      "headline": "ad headline",
      "messagingPillar": "price|quality|speed|support|features|trust",
      "targetedAt": "competitor name being challenged",
      "socialCaption": "social media post using this angle",
      "adCopy": "50-word ad copy"
    }
  ]
}`;
  }

  private buildContentPrompt(bp: any, bv: any, type: string, count: number, ctx?: string): string {
    return `Create ${count} ${type.toLowerCase().replace(/_/g, ' ')} content pieces.

BRAND: ${bp?.companyName ?? 'Brand'}
VOICE: ${bv?.tone ?? 'professional'}
${ctx ? `CONTEXT: ${ctx}` : ''}

Return ONLY valid JSON with a "creatives" array of content objects.`;
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
