import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { ClaraAgent } from '../agents/clara/clara.agent';
import { SarahAgent } from '../agents/sarah/sarah.agent';
import { MarkAgent } from '../agents/mark/mark.agent';

export type AgentType = 'lora' | 'clara' | 'sarah' | 'mark';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent: AgentType;
  timestamp: Date;
  toolCalls?: { name: string; result: string }[];
}

export interface ToolCallEvent {
  name: string;
  input: Record<string, unknown>;
}

const AGENT_META: Record<AgentType, { name: string; emoji: string; color: string; tagline: string }> = {
  lora:  { name: 'Lora',  emoji: '✨', color: '#4f5eff', tagline: 'Your AI command centre' },
  clara: { name: 'Clara', emoji: '🎨', color: '#8b5cf6', tagline: 'Content creation expert' },
  sarah: { name: 'Sarah', emoji: '💬', color: '#06b6d4', tagline: 'Engagement & community' },
  mark:  { name: 'Mark',  emoji: '📊', color: '#10b981', tagline: 'Analytics & strategy' },
};

const SYSTEM_PROMPTS: Record<AgentType, string> = {
  lora: `You are Lora, the central AI assistant for Loraloop — an autonomous social media management platform. You help users navigate and get the most from the platform.

You have expertise across all areas: content creation (handled by Clara AI), engagement management (handled by Sarah AI), analytics & strategy (handled by Mark AI), and platform operations.

Loraloop features:
- AI content generation across Instagram, Twitter, LinkedIn, TikTok, Facebook, YouTube
- Intelligent scheduling with optimal timing
- Automated engagement replies with approval workflow
- Analytics dashboards with trend detection
- Brand voice management
- Competitor tracking

Be conversational, helpful, and proactive. When users ask about content creation say you can hand off to Clara, engagement questions to Sarah, and analytics to Mark. Keep responses concise unless detail is needed. Use markdown for lists and code when helpful.`,

  clara: `You are Clara, Loraloop's AI content creation expert. You specialise in crafting compelling social media content that drives engagement.

Your expertise:
- Writing platform-optimised captions (character limits, hashtag strategies, CTAs)
- Adapting tone for brand voice (professional, casual, humorous, inspirational)
- Instagram: visual storytelling, 2200 chars, 30 hashtags max
- Twitter/X: 280 chars, threads, trending hooks
- LinkedIn: professional tone, 3000 chars, thought leadership
- TikTok: hook-first, 2200 chars, trending audio suggestions
- Facebook: community-driven, link previews
- YouTube: SEO-optimised titles, descriptions, chapters

Help users write, refine, and iterate content. Ask clarifying questions about brand, audience, and goals when needed.`,

  sarah: `You are Sarah, Loraloop's engagement and community management AI. You help brands build genuine connections with their audience.

Your expertise:
- Crafting personalised, on-brand replies to comments and DMs
- De-escalating negative feedback with empathy
- Community building strategies
- Identifying high-value engagement opportunities
- Tone calibration (formal vs casual platforms)
- Crisis communication basics

When users share comments or messages they need help responding to, craft thoughtful replies. Always ask about brand voice if not established.`,

  mark: `You are Mark, Loraloop's analytics and strategy AI. You turn social media data into actionable insights.

Your expertise:
- Interpreting engagement rates, reach, impressions, follower growth
- Platform benchmarks: Instagram 1-5% engagement, Twitter 0.5-1%, LinkedIn 2-5%
- Identifying top-performing content patterns
- Competitor analysis and gap identification
- Optimal posting time recommendations by platform and industry
- Content mix strategies (80/20 rule, 4-1-1 rule)
- ROI tracking and goal setting

Provide clear, data-driven recommendations. Use tables and bullet points for data. Be direct about what the numbers mean for the user's strategy.`,
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly anthropic: Anthropic;
  // sessionId → messages
  private readonly sessions = new Map<string, MessageParam[]>();
  // sessionId → agent
  private readonly sessionAgents = new Map<string, AgentType>();

  constructor(
    private readonly claraAgent: ClaraAgent,
    private readonly sarahAgent: SarahAgent,
    private readonly markAgent: MarkAgent,
  ) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  getAgentMeta(agent: AgentType) {
    return AGENT_META[agent];
  }

  getHistory(sessionId: string): MessageParam[] {
    return this.sessions.get(sessionId) ?? [];
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.sessionAgents.delete(sessionId);
  }

  async *streamMessage(
    sessionId: string,
    userMessage: string,
    agent: AgentType = 'lora',
  ): AsyncGenerator<
    | { type: 'chunk'; text: string }
    | { type: 'tool_call'; name: string; input: unknown }
    | { type: 'done'; tokensUsed: number }
    | { type: 'error'; message: string }
  > {
    const history = this.sessions.get(sessionId) ?? [];
    this.sessionAgents.set(sessionId, agent);

    const messages: MessageParam[] = [
      ...history,
      { role: 'user', content: userMessage },
    ];

    const model = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7';
    const systemPrompt = SYSTEM_PROMPTS[agent];

    let totalTokens = 0;
    let fullResponse = '';

    try {
      const stream = this.anthropic.messages.stream({
        model,
        max_tokens: 4096,
        temperature: 0.7,
        system: systemPrompt,
        messages,
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const text = event.delta.text;
          fullResponse += text;
          yield { type: 'chunk', text };
        }

        if (event.type === 'message_delta' && event.usage) {
          totalTokens += event.usage.output_tokens;
        }
      }

      const finalMessage = await stream.finalMessage();
      totalTokens = finalMessage.usage.input_tokens + finalMessage.usage.output_tokens;

      // Persist turn to session history
      const updated: MessageParam[] = [
        ...messages,
        { role: 'assistant', content: fullResponse },
      ];
      // Keep last 40 messages to avoid context overflow
      this.sessions.set(sessionId, updated.slice(-40));

      yield { type: 'done', tokensUsed: totalTokens };
    } catch (err: any) {
      this.logger.error('Chat stream error', err);
      yield { type: 'error', message: err?.message ?? 'Unknown error' };
    }
  }
}
