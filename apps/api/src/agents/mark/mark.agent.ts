import { Injectable } from '@nestjs/common';
import { BaseAgent, AgentRunResult, ToolDefinition } from '../base-agent';
import { MARK_SYSTEM_PROMPT } from './mark.prompts';
import { buildMarkTools } from './mark.tools';

export interface TrendAnalysisRequest {
  brandId: string;
  platforms: string[];
  categories?: string[];
  region?: string;
}

export interface CompetitorAnalysisRequest {
  brandId: string;
  platform: string;
  competitorHandles: string[];
}

export interface PerformanceReportRequest {
  userId: string;
  brandId: string;
  period: 'week' | 'month' | 'quarter';
  platforms: string[];
}

@Injectable()
export class MarkAgent extends BaseAgent {
  protected readonly agentName = 'Mark';
  protected readonly systemPrompt = MARK_SYSTEM_PROMPT;
  protected readonly tools: ToolDefinition[] = buildMarkTools();

  async analyzeTrends(request: TrendAnalysisRequest): Promise<AgentRunResult> {
    const prompt =
      `Analyze current trends relevant to this brand and identify the top 5 content opportunities.\n\n` +
      `Platforms: ${request.platforms.join(', ')}\n` +
      `Categories: ${request.categories?.join(', ') ?? 'all'}\n` +
      `Region: ${request.region ?? 'global'}\n\n` +
      `For each opportunity: describe the trend, explain its relevance, estimate its lifespan, ` +
      `and recommend a specific content angle for the brand. ` +
      `Return as JSON array with: trend, relevanceScore, lifespanEstimate, contentAngle, urgency.`;

    return this.run(prompt, { request }, { temperature: 0.4 });
  }

  async analyzeCompetitors(request: CompetitorAnalysisRequest): Promise<AgentRunResult> {
    const prompt =
      `Analyze the social media strategy of these competitors on ${request.platform}: ` +
      `${request.competitorHandles.join(', ')}.\n\n` +
      `Identify: their content themes, posting frequency, engagement rates, formats used, ` +
      `and gaps the brand could exploit. ` +
      `Return JSON with: perCompetitor analysis and strategic opportunities array.`;

    return this.run(prompt, { request }, { temperature: 0.3 });
  }

  async generateInsights(
    userId: string,
    brandId: string,
    platforms: string[],
  ): Promise<AgentRunResult> {
    const prompt =
      `Generate top 10 actionable insights for this brand's social media strategy. ` +
      `Platforms: ${platforms.join(', ')}. ` +
      `Focus on: content format optimization, timing, audience growth, and competitive positioning. ` +
      `Each insight must be specific, quantified where possible, and include an action item. ` +
      `Return as JSON array with: insight, impact (high/medium/low), effort (high/medium/low), actionItem.`;

    return this.run(prompt, { userId, brandId, platforms }, { temperature: 0.5 });
  }

  async generateReport(request: PerformanceReportRequest): Promise<AgentRunResult> {
    const prompt =
      `Compile a ${request.period}ly performance intelligence report for the brand. ` +
      `Platforms: ${request.platforms.join(', ')}. ` +
      `Include: executive summary, key metrics vs previous period, top/bottom performing content, ` +
      `audience growth analysis, competitive position update, and top 3 recommendations for next ${request.period}. ` +
      `Format as structured markdown report.`;

    return this.run(prompt, { request }, { temperature: 0.3, maxTokens: 8192 });
  }

  async evaluateTrendRelevance(
    trendKeywords: string[],
    brandId: string,
    platform: string,
  ): Promise<AgentRunResult> {
    const prompt =
      `Evaluate whether this trend is worth the brand engaging with on ${platform}.\n\n` +
      `Trend keywords: ${trendKeywords.join(', ')}\n\n` +
      `Assess: brand fit, audience alignment, risk of backlash, potential reach uplift, and content angle. ` +
      `Return JSON with: shouldEngage (boolean), relevanceScore (0-1), reasoning, suggestedAngle, risks.`;

    return this.run(prompt, { trendKeywords, brandId, platform }, { temperature: 0.3 });
  }
}
