import { Injectable } from '@nestjs/common';
import { BaseAgent, AgentRunResult, ToolDefinition } from '../base-agent';
import { CLARA_SYSTEM_PROMPT } from './clara.prompts';
import { buildClaraTools } from './clara.tools';

export interface ContentBrief {
  topic: string;
  goal: 'awareness' | 'engagement' | 'conversion' | 'retention';
  targetPlatforms: string[];
  tone: string;
  brandName: string;
  brandVoice?: string;
  prohibitedWords?: string[];
  preferredHashtags?: string[];
  additionalContext?: string;
}

export interface GeneratedContent {
  platform: string;
  caption: string;
  hashtags: string[];
  imagePrompt?: string;
  tokensUsed: number;
}

@Injectable()
export class ClaraAgent extends BaseAgent {
  protected readonly agentName = 'Clara';
  protected readonly systemPrompt = CLARA_SYSTEM_PROMPT;
  protected readonly tools: ToolDefinition[] = buildClaraTools();

  async generateContent(brief: ContentBrief): Promise<AgentRunResult> {
    const prompt = this.buildBriefPrompt(brief);
    return this.run(prompt, { brief }, { temperature: 0.8, maxTokens: 8192 });
  }

  async adaptForPlatform(
    masterCaption: string,
    platform: string,
    brand: { tone: string; prohibitedWords?: string[]; preferredHashtags?: string[] },
  ): Promise<AgentRunResult> {
    const prompt =
      `Adapt the following caption for ${platform}. ` +
      `Respect the platform's character limits, style conventions, and the brand tone (${brand.tone}). ` +
      `Return the adapted caption and a hashtag list.\n\nMaster caption:\n${masterCaption}`;

    return this.run(prompt, { platform, brand }, { temperature: 0.7 });
  }

  async refineDraft(draft: string, feedback: string, platform: string): Promise<AgentRunResult> {
    const prompt =
      `Refine the following ${platform} post draft based on this feedback: "${feedback}"\n\nDraft:\n${draft}`;
    return this.run(prompt, {}, { temperature: 0.6 });
  }

  private buildBriefPrompt(brief: ContentBrief): string {
    const platforms = brief.targetPlatforms.join(', ');
    return (
      `Create social media content for the following brief.\n\n` +
      `**Brand**: ${brief.brandName}\n` +
      `**Topic**: ${brief.topic}\n` +
      `**Goal**: ${brief.goal}\n` +
      `**Tone**: ${brief.tone}\n` +
      `**Target platforms**: ${platforms}\n` +
      (brief.brandVoice ? `**Brand voice**: ${brief.brandVoice}\n` : '') +
      (brief.preferredHashtags?.length
        ? `**Preferred hashtags**: ${brief.preferredHashtags.join(', ')}\n`
        : '') +
      (brief.prohibitedWords?.length
        ? `**Prohibited words**: ${brief.prohibitedWords.join(', ')}\n`
        : '') +
      (brief.additionalContext ? `**Additional context**: ${brief.additionalContext}\n` : '') +
      `\nFor each platform, provide: caption, hashtags, and an image generation prompt.` +
      ` Return the result as a JSON array of objects with keys: platform, caption, hashtags, imagePrompt.`
    );
  }
}
