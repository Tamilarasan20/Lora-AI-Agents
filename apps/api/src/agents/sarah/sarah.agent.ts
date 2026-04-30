import { Injectable } from '@nestjs/common';
import { BaseAgent, AgentRunResult, ToolDefinition } from '../base-agent';
import { PrismaService } from '../../prisma/prisma.service';
import { SARAH_SYSTEM_PROMPT } from './sarah.prompts';
import { buildSarahTools } from './sarah.tools';

export interface PublishDecision {
  contentId: string;
  userId: string;
  platform: string;
  timezone: string;
  preferredTime?: Date;
}

export interface EngagementItem {
  id: string;
  platform: string;
  type: 'comment' | 'mention' | 'dm' | 'reply';
  text: string;
  authorUsername: string;
  authorFollowerCount?: number;
  postContext: string;
  brandTone: string;
}

@Injectable()
export class SarahAgent extends BaseAgent {
  protected readonly agentName = 'Sarah';
  protected readonly systemPrompt = SARAH_SYSTEM_PROMPT;
  protected readonly tools: ToolDefinition[];

  constructor(private readonly prisma: PrismaService) {
    super();
    this.tools = buildSarahTools(this.prisma);
  }

  async decidePublishTime(decision: PublishDecision): Promise<AgentRunResult> {
    const prompt =
      `Determine the optimal publishing time for a ${decision.platform} post.\n\n` +
      `Brand timezone: ${decision.timezone}\n` +
      `User ID: ${decision.userId}\n` +
      (decision.preferredTime
        ? `The brand prefers ${decision.preferredTime.toISOString()} — validate this against the data and suggest an alternative if a significantly better slot exists.\n`
        : `No preferred time given — recommend the best slot in the next 7 days.\n`) +
      `\nUse the get_optimal_posting_time tool to fetch real audience data and scheduling insights, ` +
      `then use check_posting_cadence to confirm there is room to post. ` +
      `Return a JSON object with: scheduledFor (ISO8601), reasoning, confidenceScore (0-1), ` +
      `alternativeSlots (array of 2 ISO8601 strings), dataSource ("real_data" | "industry_baseline").`;

    return this.run(prompt, { decision }, { temperature: 0.3 });
  }

  async processEngagement(item: EngagementItem): Promise<AgentRunResult> {
    const prompt =
      `Process this ${item.type} on ${item.platform} and decide on the appropriate response action.\n\n` +
      `Author: @${item.authorUsername}${item.authorFollowerCount ? ` (${item.authorFollowerCount} followers)` : ''}\n` +
      `Message: "${item.text}"\n` +
      `Post context: ${item.postContext}\n` +
      `Brand tone: ${item.brandTone}\n\n` +
      `Analyze sentiment, determine if escalation is needed, and draft an appropriate reply. ` +
      `Return JSON with: sentiment, sentimentScore, shouldEscalate, escalationReason (if applicable), replyText, replyApproved (boolean).`;

    return this.run(prompt, { item }, { temperature: 0.5 });
  }

  async planContentCalendar(
    posts: { contentId: string; platform: string; priority: number }[],
    timezone: string,
    lookAheadDays: number,
  ): Promise<AgentRunResult> {
    const prompt =
      `Plan a ${lookAheadDays}-day content calendar for the following ${posts.length} posts. ` +
      `Brand timezone: ${timezone}. ` +
      `Distribute posts to avoid fatigue, maximize algorithm engagement, and respect platform cadence rules. ` +
      `Return a JSON array with: contentId, platform, scheduledFor (ISO8601), reasoning.`;

    return this.run(prompt, { posts, timezone, lookAheadDays }, { temperature: 0.4 });
  }
}
