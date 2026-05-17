import { ToolDefinition } from '../base-agent';
import { VideoGenerationService } from '../../media/video-generation/video-generation.service';

const PLATFORM_SPECS: Record<string, { aspectRatio: string; minSec: number; maxSec: number; dimensions: string }> = {
  tiktok:    { aspectRatio: '9:16', minSec: 15, maxSec: 60,  dimensions: '1080x1920' },
  instagram: { aspectRatio: '9:16', minSec: 15, maxSec: 90,  dimensions: '1080x1920' },
  youtube:   { aspectRatio: '9:16', minSec: 30, maxSec: 60,  dimensions: '1080x1920' },
  linkedin:  { aspectRatio: '1:1',  minSec: 30, maxSec: 90,  dimensions: '1080x1080' },
  twitter:   { aspectRatio: '16:9', minSec: 15, maxSec: 45,  dimensions: '1920x1080' },
};

/**
 * Theo's tools — platform spec lookup, shot timing validator, hook scorer,
 * and real video generation via RunwayML, Luma, Pika, and Kling.
 */
export function buildTheoTools(videoGen?: VideoGenerationService): ToolDefinition[] {
  return [
    {
      name: 'get_platform_specs',
      description:
        'Return aspect ratio, ideal length range, and pixel dimensions for a target video platform.',
      inputSchema: {
        properties: {
          platform: { type: 'string', enum: Object.keys(PLATFORM_SPECS) },
        },
        required: ['platform'],
      },
      handler: async (input) => {
        const spec = PLATFORM_SPECS[String(input.platform)];
        if (!spec) return { error: `Unknown platform: ${input.platform}` };
        return { platform: input.platform, ...spec };
      },
    },
    {
      name: 'validate_shot_timing',
      description:
        'Check that the total duration of a shot list matches a target duration within ±10%. Returns the diff and per-shot timing.',
      inputSchema: {
        properties: {
          targetDurationSec: { type: 'number' },
          shots: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                shotNumber: { type: 'number' },
                durationSec: { type: 'number' },
              },
            },
          },
        },
        required: ['targetDurationSec', 'shots'],
      },
      handler: async (input) => {
        const shots = (input.shots as Array<{ shotNumber: number; durationSec: number }>) ?? [];
        const total = shots.reduce((s, x) => s + (x.durationSec ?? 0), 0);
        const target = input.targetDurationSec as number;
        const drift = Math.abs(total - target) / target;
        return {
          totalDurationSec: total,
          targetDurationSec: target,
          driftPercent: Number((drift * 100).toFixed(1)),
          withinTolerance: drift <= 0.1,
          shotBreakdown: shots,
        };
      },
    },
    {
      name: 'score_hook',
      description:
        'Score a video hook (the first 1.5s line) on scroll-stop potential. Returns 0-100 + reasoning.',
      inputSchema: {
        properties: {
          hook: { type: 'string' },
        },
        required: ['hook'],
      },
      handler: async (input) => {
        const hook = String(input.hook).trim();
        const lower = hook.toLowerCase();
        let score = 40; // baseline
        const wins: string[] = [];
        const losses: string[] = [];

        if (hook.length <= 60) { score += 10; wins.push('concise (<=60 chars)'); }
        else losses.push('too long — cut to under 60 chars');

        if (/^(wait|stop|listen|here's|the truth|you'?re)/i.test(hook)) { score += 15; wins.push('pattern-interrupt opener'); }
        if (/\?/.test(hook)) { score += 10; wins.push('question hooks curiosity'); }
        if (/[A-Z]{3,}/.test(hook) && !lower.includes('http')) { score -= 5; losses.push('all-caps reads as spam'); }
        if (/buy|sale|discount|free/i.test(hook)) { score -= 10; losses.push('promotional language — audiences scroll past'); }
        if (hook.split(/\s+/).length < 3) { score -= 10; losses.push('too short — needs at least a complete thought'); }
        if (/most (people|founders|brands|companies)/i.test(hook)) { score += 10; wins.push('bold-claim opener'); }
        if (hook.endsWith('.')) { score -= 3; losses.push('ending with period closes the loop — try ellipsis or no punctuation'); }

        return {
          hook,
          score: Math.max(0, Math.min(100, score)),
          strengths: wins,
          improvements: losses,
        };
      },
    },

    {
      name: 'generate_video',
      description:
        'Generate an actual video using AI video LLM models (RunwayML, Luma Dream Machine, Pika, Kling). Pass a detailed prompt and brand context to ensure brand voice alignment. Returns asset URL.',
      inputSchema: {
        properties: {
          userId:       { type: 'string' },
          businessId:   { type: 'string' },
          taskId:       { type: 'string' },
          prompt:       { type: 'string', description: 'Detailed scene description with style, mood, action, lighting' },
          imageUrl:     { type: 'string', description: 'Optional: start video from this image (image-to-video)' },
          aspectRatio:  { type: 'string', enum: ['9:16', '16:9', '1:1'] },
          durationSec:  { type: 'number', description: '5 or 10 seconds' },
          provider:     { type: 'string', enum: ['runway', 'luma', 'pika', 'kling'], description: 'Omit to auto-route.' },
          brandContext: {
            type: 'object',
            properties: {
              brandColors:    { type: 'array', items: { type: 'string' } },
              visualStyle:    { type: 'string' },
              tone:           { type: 'string' },
              targetAudience: { type: 'string' },
            },
          },
        },
        required: ['userId', 'businessId', 'taskId', 'prompt'],
      },
      handler: async (input) => {
        if (!videoGen) return { error: 'VideoGenerationService not available' };
        const result = await videoGen.generateVideo({
          userId:      input.userId as string,
          businessId:  input.businessId as string,
          taskId:      input.taskId as string,
          prompt:      input.prompt as string,
          imageUrl:    input.imageUrl as string | undefined,
          aspectRatio: input.aspectRatio as any,
          durationSec: input.durationSec as number | undefined,
          provider:    input.provider as any,
          brandContext: input.brandContext as any,
        });
        return result;
      },
    },
  ];
}
