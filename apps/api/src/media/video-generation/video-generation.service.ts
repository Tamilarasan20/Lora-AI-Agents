import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../storage/storage.service';
import { GenerateVideoInput, GeneratedVideoResult, VideoProvider, VideoAspectRatio } from './video-generation.types';

@Injectable()
export class VideoGenerationService {
  private readonly logger = new Logger(VideoGenerationService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  async generateVideo(input: GenerateVideoInput): Promise<GeneratedVideoResult> {
    const provider = input.provider ?? this.routeProvider(input);
    const brandedPrompt = this.buildBrandedPrompt(input.prompt, input.brandContext);
    const aspectRatio = input.aspectRatio ?? '9:16';
    const durationSec = input.durationSec ?? 8;

    this.logger.log(`[VideoGen] provider=${provider} prompt="${brandedPrompt.slice(0, 80)}..."`);

    switch (provider) {
      case 'runway': return this.generateWithRunway(input, brandedPrompt, aspectRatio, durationSec);
      case 'luma':   return this.generateWithLuma(input, brandedPrompt, aspectRatio, durationSec);
      case 'pika':   return this.generateWithPika(input, brandedPrompt, aspectRatio, durationSec);
      case 'kling':  return this.generateWithKling(input, brandedPrompt, aspectRatio, durationSec);
      default:       return this.generateWithLuma(input, brandedPrompt, aspectRatio, durationSec);
    }
  }

  // ── RunwayML ───────────────────────────────────────────────────────────────

  private async generateWithRunway(
    input: GenerateVideoInput, prompt: string, aspectRatio: VideoAspectRatio, durationSec: number,
  ): Promise<GeneratedVideoResult> {
    const apiKey = this.config.get<string>('RUNWAY_API_KEY');
    if (!apiKey) throw new Error('RUNWAY_API_KEY not configured');

    // RunwayML Gen-3 Alpha Turbo — text-to-video or image-to-video
    const body: Record<string, unknown> = {
      promptText: prompt,
      model: 'gen3a_turbo',
      duration: durationSec <= 5 ? 5 : 10,
      ratio: this.runwayRatio(aspectRatio),
      watermark: false,
    };
    if (input.imageUrl) body.promptImage = input.imageUrl;

    const res = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Runway-Version': '2024-11-06' },
      body: JSON.stringify(body),
    });
    const task = await res.json() as any;
    if (task.error) throw new Error(`Runway error: ${task.error}`);

    // Poll for completion
    const videoUrl = await this.pollRunway(apiKey, task.id);
    return this.storeAndReturn(input, videoUrl, 'runway', 'gen3a_turbo', aspectRatio, durationSec, prompt);
  }

  private async pollRunway(apiKey: string, taskId: string, maxAttempts = 60): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'X-Runway-Version': '2024-11-06' },
      });
      const data = await res.json() as any;
      if (data.status === 'SUCCEEDED') return data.output?.[0] as string;
      if (data.status === 'FAILED') throw new Error(`Runway task failed: ${data.failure ?? 'unknown'}`);
    }
    throw new Error('Runway task timed out');
  }

  // ── Luma Dream Machine ─────────────────────────────────────────────────────

  private async generateWithLuma(
    input: GenerateVideoInput, prompt: string, aspectRatio: VideoAspectRatio, durationSec: number,
  ): Promise<GeneratedVideoResult> {
    const apiKey = this.config.get<string>('LUMA_API_KEY');
    if (!apiKey) throw new Error('LUMA_API_KEY not configured');

    const body: Record<string, unknown> = {
      prompt,
      aspect_ratio: aspectRatio,
      loop: false,
    };
    if (input.imageUrl) {
      body.keyframes = { frame0: { type: 'image', url: input.imageUrl } };
    }

    const res = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const gen = await res.json() as any;
    if (gen.detail) throw new Error(`Luma error: ${gen.detail}`);

    const videoUrl = await this.pollLuma(apiKey, gen.id);
    return this.storeAndReturn(input, videoUrl, 'luma', 'dream-machine', aspectRatio, durationSec, prompt);
  }

  private async pollLuma(apiKey: string, genId: string, maxAttempts = 60): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const res = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${genId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const data = await res.json() as any;
      if (data.state === 'completed') return data.assets?.video as string;
      if (data.state === 'failed') throw new Error(`Luma generation failed: ${data.failure_reason ?? 'unknown'}`);
    }
    throw new Error('Luma generation timed out');
  }

  // ── Pika ──────────────────────────────────────────────────────────────────

  private async generateWithPika(
    input: GenerateVideoInput, prompt: string, aspectRatio: VideoAspectRatio, durationSec: number,
  ): Promise<GeneratedVideoResult> {
    const apiKey = this.config.get<string>('PIKA_API_KEY');
    if (!apiKey) throw new Error('PIKA_API_KEY not configured');

    const res = await fetch('https://api.pika.art/v1/generate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promptText: prompt,
        aspectRatio,
        duration: Math.min(durationSec, 10),
        ...(input.imageUrl ? { image: input.imageUrl } : {}),
      }),
    });
    const data = await res.json() as any;
    if (data.error) throw new Error(`Pika error: ${data.error}`);

    const videoUrl = await this.pollPika(apiKey, data.taskId ?? data.id);
    return this.storeAndReturn(input, videoUrl, 'pika', 'pika-2.0', aspectRatio, durationSec, prompt);
  }

  private async pollPika(apiKey: string, taskId: string, maxAttempts = 60): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const res = await fetch(`https://api.pika.art/v1/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const data = await res.json() as any;
      if (data.status === 'completed') return data.video?.url ?? data.output as string;
      if (data.status === 'failed') throw new Error(`Pika task failed`);
    }
    throw new Error('Pika task timed out');
  }

  // ── Kling ─────────────────────────────────────────────────────────────────

  private async generateWithKling(
    input: GenerateVideoInput, prompt: string, aspectRatio: VideoAspectRatio, durationSec: number,
  ): Promise<GeneratedVideoResult> {
    const apiKey = this.config.get<string>('KLING_API_KEY');
    if (!apiKey) throw new Error('KLING_API_KEY not configured');

    const res = await fetch('https://api.klingai.com/v1/videos/text2video', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'kling-v1',
        prompt,
        aspect_ratio: aspectRatio,
        duration: durationSec <= 5 ? '5' : '10',
        mode: 'std',
        ...(input.imageUrl ? { image_url: input.imageUrl } : {}),
      }),
    });
    const data = await res.json() as any;
    if (data.code !== 0) throw new Error(`Kling error: ${data.message}`);

    const videoUrl = await this.pollKling(apiKey, data.data?.task_id);
    return this.storeAndReturn(input, videoUrl, 'kling', 'kling-v1', aspectRatio, durationSec, prompt);
  }

  private async pollKling(apiKey: string, taskId: string, maxAttempts = 60): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const res = await fetch(`https://api.klingai.com/v1/videos/text2video/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const data = await res.json() as any;
      if (data.data?.task_status === 'succeed') return data.data?.task_result?.videos?.[0]?.url as string;
      if (data.data?.task_status === 'failed') throw new Error(`Kling task failed`);
    }
    throw new Error('Kling task timed out');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private routeProvider(input: GenerateVideoInput): VideoProvider {
    // Route based on available API keys
    if (this.config.get('LUMA_API_KEY')) return 'luma';
    if (this.config.get('RUNWAY_API_KEY')) return 'runway';
    if (this.config.get('PIKA_API_KEY')) return 'pika';
    if (this.config.get('KLING_API_KEY')) return 'kling';
    throw new Error('No video generation API key configured (LUMA_API_KEY, RUNWAY_API_KEY, PIKA_API_KEY, or KLING_API_KEY)');
  }

  private buildBrandedPrompt(prompt: string, ctx?: GenerateVideoInput['brandContext']): string {
    if (!ctx) return prompt;
    const parts = [prompt];
    if (ctx.visualStyle) parts.push(`Visual style: ${ctx.visualStyle}`);
    if (ctx.brandColors?.length) parts.push(`Brand colors: ${ctx.brandColors.join(', ')}`);
    if (ctx.tone) parts.push(`Mood/tone: ${ctx.tone}`);
    if (ctx.targetAudience) parts.push(`For audience: ${ctx.targetAudience}`);
    return parts.join('. ');
  }

  private runwayRatio(ratio: VideoAspectRatio): string {
    const map: Record<VideoAspectRatio, string> = { '9:16': '720:1280', '16:9': '1280:720', '1:1': '960:960' };
    return map[ratio];
  }

  private async storeAndReturn(
    input: GenerateVideoInput,
    videoUrl: string,
    provider: VideoProvider,
    model: string,
    aspectRatio: VideoAspectRatio,
    durationSec: number,
    promptUsed: string,
  ): Promise<GeneratedVideoResult> {
    // Download and re-upload to our storage
    const res = await fetch(videoUrl);
    const buffer = Buffer.from(await res.arrayBuffer());
    const mimeType = 'video/mp4';
    const key = `videos/${input.userId}/${input.taskId}/${provider}-${Date.now()}.mp4`;

    const stored = await this.storage.putObject(key, buffer, mimeType);

    this.logger.log(`[VideoGen] Stored video: ${key}`);
    return { provider, model, assetUrl: stored.publicUrl, storageKey: key, mimeType, durationSec, aspectRatio, promptUsed };
  }
}
