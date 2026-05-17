import { Injectable } from '@nestjs/common';
import { BaseAgent, AgentRunResult, ToolDefinition } from '../base-agent';
import { LlmRouterService } from '../../llm-router/llm-router.service';
import { THEO_SYSTEM_PROMPT } from './theo.prompts';
import { buildTheoTools } from './theo.tools';
import { VideoGenerationService } from '../../media/video-generation/video-generation.service';
import { GeneratedVideoResult } from '../../media/video-generation/video-generation.types';

export type VideoPlatform = 'tiktok' | 'instagram' | 'youtube' | 'linkedin' | 'twitter';
export type VideoStyle = 'talking-head' | 'cinematic' | 'tutorial' | 'ugc' | 'animation' | 'product-demo';

export interface VideoPlanRequest {
  topic: string;
  brandName: string;
  brandVoice?: string;
  platform: VideoPlatform;
  durationSec?: number;
  style?: VideoStyle;
  goal?: string;
  hookExamples?: string[];
}

export interface HookRequest {
  topic: string;
  brandName: string;
  count?: number;
  style?: 'curiosity' | 'pain-point' | 'bold-claim';
}

export interface ScriptRewriteRequest {
  existingScript: string;
  brandName: string;
  platform: VideoPlatform;
  goal?: string;
}

@Injectable()
export class TheoAgent extends BaseAgent {
  protected readonly agentName = 'Theo';
  protected readonly systemPrompt = THEO_SYSTEM_PROMPT;
  protected readonly tools: ToolDefinition[];

  constructor(router: LlmRouterService, private readonly videoGen?: VideoGenerationService) {
    super();
    this.router = router;
    this.tools = buildTheoTools(this.videoGen);
  }

  /**
   * Produce a full short-form video plan: hook, shot list, voiceover, captions,
   * music mood, thumbnail, CTA. Returns platform-locked output.
   */
  async buildPlan(req: VideoPlanRequest): Promise<AgentRunResult> {
    const prompt = `Build a complete short-form video plan.

Topic: ${req.topic}
Brand: ${req.brandName}
${req.brandVoice ? `Brand voice: ${req.brandVoice}` : ''}
Platform: ${req.platform}
Style: ${req.style ?? 'cinematic'}
Target duration: ${req.durationSec ?? 30}s
${req.goal ? `Goal: ${req.goal}` : ''}
${req.hookExamples?.length ? `Hook references: ${req.hookExamples.join(' | ')}` : ''}

Return STRICT JSON:
{
  "title": "...",
  "hook": "First 1.5s — the scroll-stopper",
  "fullScript": "Complete script with [SHOT N] markers",
  "shots": [
    {
      "shotNumber": 1,
      "durationSec": 1.5,
      "visual": "Specific visual description",
      "voiceover": "VO line",
      "onScreenText": "Burned-in caption",
      "bRoll": ["..."],
      "cameraMovement": "push-in | pull-out | pan-left | whip-pan | handheld | static",
      "transition": "cut | whip-pan | match-cut | jump-cut | fade"
    }
  ],
  "totalDurationSec": ${req.durationSec ?? 30},
  "platform": "${req.platform}",
  "captions": [{ "time": "0:00", "text": "..." }],
  "musicMood": "Specific mood / BPM / genre",
  "soundEffects": ["..."],
  "thumbnailIdea": "...",
  "caption": "Platform description below the video",
  "hashtags": ["#tag1"],
  "callToAction": "Single clear CTA",
  "productionNotes": ["lighting, framing, edit pace notes"]
}`;

    return this.run(prompt, { request: req }, {
      taskType: 'theo-build-plan',
      temperature: 0.8,
      maxTokens: 6144,
    });
  }

  /**
   * Generate multiple hook variants for split-testing. Each hook is scored.
   */
  async generateHooks(req: HookRequest): Promise<AgentRunResult> {
    const prompt = `Generate ${req.count ?? 5} scroll-stopping hooks for a short-form video.

Topic: ${req.topic}
Brand: ${req.brandName}
${req.style ? `Pattern: ${req.style}` : ''}

Each hook must:
- Land within 1.5 seconds (max ~60 chars or 10 words)
- Open with a pattern interrupt, question, or bold claim
- Avoid promotional language

Return STRICT JSON: { "hooks": [{ "text": "...", "pattern": "curiosity | pain-point | bold-claim", "rationale": "why this lands" }] }`;

    return this.run(prompt, { request: req }, {
      taskType: 'theo-generate-hooks',
      temperature: 0.9,
      maxTokens: 1024,
    });
  }

  /**
   * Rewrite an existing script to be tighter and more platform-native.
   */
  async rewriteScript(req: ScriptRewriteRequest): Promise<AgentRunResult> {
    const prompt = `Rewrite this script to be tighter and more native to ${req.platform}.

Brand: ${req.brandName}
${req.goal ? `Goal: ${req.goal}` : ''}

ORIGINAL SCRIPT:
${req.existingScript.slice(0, 4000)}

Cut every word that doesn't earn its place. Tighten the hook. Add [SHOT N] markers. Return STRICT JSON:
{
  "rewrittenScript": "...",
  "wordCountBefore": 0,
  "wordCountAfter": 0,
  "keyChanges": ["..."]
}`;

    return this.run(prompt, { request: req }, {
      taskType: 'theo-rewrite-script',
      temperature: 0.5,
      maxTokens: 4096,
    });
  }

  /**
   * Generate a real video clip from a video plan.
   * Builds a rich scene prompt from the plan's hook, shots, and visual descriptions,
   * then calls the video generation service.
   */
  async generateVideo(
    userId: string,
    businessId: string,
    taskId: string,
    videoPlan: Record<string, unknown>,
    brandContext?: {
      brandColors?: string[];
      visualStyle?: string;
      tone?: string;
      targetAudience?: string;
    },
  ): Promise<GeneratedVideoResult> {
    if (!this.videoGen) {
      throw new Error('VideoGenerationService not available — inject it via the constructor');
    }

    // Build a rich scene prompt from the video plan's structural elements
    const parts: string[] = [];

    if (videoPlan.hook) parts.push(`Hook: ${videoPlan.hook}`);

    const shots = videoPlan.shots as Array<{
      visual?: string;
      voiceover?: string;
      cameraMovement?: string;
    }> | undefined;

    if (shots?.length) {
      const sceneDesc = shots
        .slice(0, 3) // Use first 3 shots for the prompt
        .map((s, i) => {
          const parts: string[] = [];
          if (s.visual) parts.push(s.visual);
          if (s.cameraMovement) parts.push(`camera: ${s.cameraMovement}`);
          if (s.voiceover) parts.push(`VO: "${s.voiceover}"`);
          return `Shot ${i + 1}: ${parts.join(', ')}`;
        })
        .join('. ');
      parts.push(sceneDesc);
    }

    if (videoPlan.musicMood) parts.push(`Mood: ${videoPlan.musicMood}`);

    const prompt = parts.length > 0
      ? parts.join('. ')
      : String(videoPlan.title ?? 'Brand video clip');

    const platform = videoPlan.platform as string | undefined;
    const aspectRatio = platform === 'linkedin'
      ? '1:1'
      : platform === 'twitter'
        ? '16:9'
        : '9:16';

    return this.videoGen.generateVideo({
      userId,
      businessId,
      taskId,
      prompt,
      aspectRatio,
      durationSec: Number(videoPlan.totalDurationSec ?? 10) <= 5 ? 5 : 10,
      brandContext,
    });
  }
}
