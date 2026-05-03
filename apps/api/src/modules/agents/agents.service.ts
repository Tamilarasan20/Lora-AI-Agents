import { Injectable, Logger, Optional } from '@nestjs/common';
import { LlmRouterService } from '../../llm-router/llm-router.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AgentName,
  SamOutput, ClaraOutput, SteveOutput, SarahOutput, LoraReviewOutput,
  PHASE_1_AGENT_CREDIT_COSTS,
} from './agent.types';
import { LORA_SYSTEM_PROMPT } from './prompts/lora.prompt';
import { SAM_SYSTEM_PROMPT } from './prompts/sam.prompt';
import { CLARA_SYSTEM_PROMPT } from './prompts/clara.prompt';
import { STEVE_SYSTEM_PROMPT } from './prompts/steve.prompt';
import { SARAH_SYSTEM_PROMPT } from './prompts/sarah.prompt';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly llm: LlmRouterService,
  ) {}

  private getSystemPrompt(agent: AgentName): string {
    const map: Record<AgentName, string> = {
      Lora: LORA_SYSTEM_PROMPT,
      Sam: SAM_SYSTEM_PROMPT,
      Clara: CLARA_SYSTEM_PROMPT,
      Steve: STEVE_SYSTEM_PROMPT,
      Sarah: SARAH_SYSTEM_PROMPT,
    };
    return map[agent];
  }

  private parseJson<T>(raw: string, fallback: T): T {
    try {
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/s);
      return JSON.parse(match?.[1] ?? raw) as T;
    } catch {
      return fallback;
    }
  }

  async runAgent<T>(
    agent: AgentName,
    userMessage: string,
    userId: string,
    businessId: string,
    action: string,
  ): Promise<T> {
    const credits = PHASE_1_AGENT_CREDIT_COSTS[action] ?? 1;
    await this.deductCredits(userId, agent, action, credits);

    if (!this.llm) {
      this.logger.warn(`LlmRouter unavailable — returning mock output for ${agent}`);
      return this.mockOutput(agent) as T;
    }

    try {
      const response = await this.llm.route({
        systemPrompt: this.getSystemPrompt(agent),
        messages: [{ role: 'user', content: userMessage }],
        maxTokens: 4096,
        routing: { strategy: 'balanced' },
      });
      return this.parseJson<T>(response.content, this.mockOutput(agent) as T);
    } catch (err) {
      this.logger.warn(`${agent} LLM call failed: ${err}`);
      return this.mockOutput(agent) as T;
    }
  }

  async runSam(userMessage: string, userId: string, businessId: string): Promise<SamOutput> {
    return this.runAgent<SamOutput>('Sam', userMessage, userId, businessId, 'samTrendResearch');
  }

  async runClara(userMessage: string, userId: string, businessId: string): Promise<ClaraOutput> {
    return this.runAgent<ClaraOutput>('Clara', userMessage, userId, businessId, 'claraContentGeneration');
  }

  async runSteve(userMessage: string, userId: string, businessId: string): Promise<SteveOutput> {
    return this.runAgent<SteveOutput>('Steve', userMessage, userId, businessId, 'steveVisualConcept');
  }

  async runSarah(userMessage: string, userId: string, businessId: string): Promise<SarahOutput> {
    return this.runAgent<SarahOutput>('Sarah', userMessage, userId, businessId, 'sarahSchedulePlan');
  }

  async runLoraReview(content: unknown, goal: string, userId: string, businessId: string): Promise<LoraReviewOutput> {
    const message = `Review this agent output and return your assessment JSON:
Goal: ${goal}
Output: ${JSON.stringify(content, null, 2)}`;
    return this.runAgent<LoraReviewOutput>('Lora', message, userId, businessId, 'loraReview');
  }

  private async deductCredits(userId: string, agentName: string, action: string, credits: number) {
    await this.prisma.agentCreditUsage.create({
      data: { userId, agentName, action, credits },
    }).catch(() => null);
  }

  private mockOutput(agent: AgentName): unknown {
    switch (agent) {
      case 'Sam': return {
        trendSummary: 'Short-form educational content is trending on Instagram and TikTok.',
        competitorInsights: ['Competitors are posting 5–7x per week', 'Heavy carousel usage on LinkedIn'],
        contentOpportunities: ['Behind-the-scenes content', 'Problem/solution posts', 'Testimonial carousels'],
        recommendedAngles: ['How-to content', 'Myth-busting posts', 'Social proof campaigns'],
        platformSuggestions: ['Instagram Reels', 'TikTok tutorials', 'LinkedIn carousels'],
        risks: ['Market saturation in generic posts'],
        nextActionsForLora: ['Create 10-post campaign using educational hooks', 'Build competitor comparison carousel'],
      } as SamOutput;
      case 'Clara': return {
        contentType: 'social_post',
        platform: 'Instagram',
        title: 'Product Launch Post',
        hook: "You've been asking — it's finally here.",
        body: 'Introducing the solution you needed. Simple. Effective. Built for you.',
        cta: 'Shop now → link in bio',
        hashtags: ['productlaunch', 'new', 'innovative'],
        brandVoiceNotes: 'Conversational, confident, benefit-driven',
        variants: ["Here's what you've been waiting for...", 'Big news: we just launched...'],
      } as ClaraOutput;
      case 'Steve': return {
        creativeType: 'carousel_images',
        platform: 'Instagram',
        visualConcept: 'Clean white background, bold product shot slide 1, benefit-per-slide layout',
        carouselSlides: [
          { slideNumber: 1, slideGoal: 'Hook attention', headline: 'Introducing [Product]', supportingText: 'Your solution is here.', imagePrompt: 'Hero product shot on white background, minimal text', generatedImageUrl: '', designNotes: 'Bold headline, product centered' },
          { slideNumber: 2, slideGoal: 'Identify pain', headline: 'The Problem', supportingText: 'Tired of struggling with X?', imagePrompt: 'Icon illustration of pain point, minimal style', generatedImageUrl: '', designNotes: 'Warm color accent' },
          { slideNumber: 3, slideGoal: 'Present solution', headline: 'The Solution', supportingText: 'We made it simple.', imagePrompt: 'Product in use, lifestyle photography', generatedImageUrl: '', designNotes: 'Clean lifestyle shot' },
          { slideNumber: 4, slideGoal: 'Drive action', headline: 'Get Yours Today', supportingText: 'Link in bio', imagePrompt: 'Bold CTA card with brand colors', generatedImageUrl: '', designNotes: 'High contrast CTA button' },
        ],
        imagePrompts: ['Clean minimal product photography, white background, soft shadows'],
        generatedAssets: [
          { assetType: 'carousel_slide', assetUrl: '', platform: 'Instagram', dimensions: '1080x1080', status: 'draft', promptUsed: 'Clean minimal product photography', brandStyleNotes: 'Primary brand color, white background' },
        ],
        layoutDirection: 'Left-aligned text, product on right, 1080x1080px',
        brandStyleNotes: 'Use primary brand color for headings, white background, clean sans-serif',
        recommendedFormat: '1080x1080 carousel, 4 slides',
        designChecklist: ['Logo in corner', 'Consistent fonts', 'Brand colors used', 'CTA on last slide'],
      } as SteveOutput;
      case 'Sarah': return {
        calendarItems: [{ title: 'Product launch post', platform: 'Instagram', contentType: 'carousel', assignedTo: 'Sarah', status: 'draft' }],
        platformAdaptations: [{ platform: 'Instagram', adaptedContent: 'You\'ve been asking — it\'s finally here.', hashtags: ['launch', 'new'], bestTime: 'Tuesday 10am' }],
        postingSchedule: [{ date: 'Monday', time: '10:00 AM', platform: 'Instagram', contentTitle: 'Product launch carousel' }],
        engagementReplies: [],
        publishingStatus: 'draft',
        nextActions: ['Submit to Lora for review', 'Await user approval', 'Schedule after approval'],
      } as SarahOutput;
      default: return {
        approved: true, brandFitScore: 85, qualityScore: 83, goalAlignmentScore: 88,
        notes: 'Good foundation. Ensure CTA is prominent.', requiredChanges: [],
        nextStep: 'Send to user for approval',
      } as LoraReviewOutput;
    }
  }
}
