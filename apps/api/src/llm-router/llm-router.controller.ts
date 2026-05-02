import {
  Controller, Get, Post, Body, HttpCode, HttpStatus, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LlmRouterService } from './llm-router.service';
import {
  MODEL_REGISTRY, LlmProvider,
  ImageGenerationRequest, VideoGenerationRequest, AudioRequest,
  CreditContext,
} from './llm-router.types';
import { Public } from '../common/decorators/public.decorator';

// ─── Request DTOs ─────────────────────────────────────────────────────────────

class TextRouteDto {
  prompt!: string;
  systemPrompt?: string;
  strategy?: 'cost' | 'speed' | 'quality' | 'balanced';
  forceModel?: string;
  excludedProviders?: LlmProvider[];
  taskType?: string;
  creditContext?: CreditContext;
}

class ClassifyDto {
  prompt!: string;
  systemPrompt?: string;
}

@ApiTags('LLM Router')
@ApiBearerAuth()
@Controller('llm-router')
export class LlmRouterController {
  constructor(private readonly router: LlmRouterService) {}

  // ─── Discovery ───────────────────────────────────────────────────────────────

  @Get('models')
  @Public()
  @ApiOperation({ summary: 'All models in registry with specs, costs, and availability' })
  @ApiQuery({ name: 'modality', required: false, enum: ['text', 'image', 'video', 'audio'] })
  getModels(@Query('modality') modality?: string) {
    const available = new Set(this.router.getAvailableProviders());
    return Object.entries(MODEL_REGISTRY)
      .filter(([, s]) => !modality || s.modality === modality)
      .map(([key, spec]) => ({
        key,
        ...spec,
        available: available.has(spec.provider),
      }));
  }

  @Get('providers')
  @Public()
  @ApiOperation({ summary: 'List active providers (API keys configured)' })
  getProviders() {
    return {
      providers: this.router.getAvailableProviders(),
      total: this.router.getAvailableProviders().length,
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Per-model usage: calls, tokens, cost, latency, failures' })
  getMetrics() {
    return this.router.getMetrics();
  }

  // ─── Routing ─────────────────────────────────────────────────────────────────

  @Post('classify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Classify a prompt — returns modality, complexity, task type, requiresWebSearch, confidence',
  })
  classify(@Body() body: ClassifyDto) {
    return this.router.classify(body.prompt, body.systemPrompt);
  }

  @Post('route')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Route a text prompt through the intelligent router. Auto-classifies, applies guardrails, executes.',
  })
  async route(@Body() body: TextRouteDto) {
    const response = await this.router.route({
      systemPrompt: body.systemPrompt ?? 'You are a helpful assistant.',
      messages: [{ role: 'user', content: body.prompt }],
      taskType: body.taskType,
      creditContext: body.creditContext,
      routing: {
        strategy: body.strategy ?? 'balanced',
        excludedProviders: body.excludedProviders,
        forceModel: body.forceModel,
        enableFallback: true,
      },
    });

    return {
      output: response.content,
      model: response.model,
      provider: response.provider,
      latencyMs: response.latencyMs,
      costUsd: response.costUsd,
      tokens: response.usage,
      classification: response.classification,
      routingDecision: response.routingDecision,
      citations: response.citations,
    };
  }

  /** @deprecated use POST /route */
  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Deprecated] Alias for POST /route' })
  async test(@Body() body: TextRouteDto) {
    return this.route(body);
  }

  // ─── Image generation ────────────────────────────────────────────────────────

  @Post('generate/image')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate an image. Simple/bulk → Imagen 3 (Google). Quality/branding → DALL-E 3 (OpenAI).',
  })
  async generateImage(@Body() body: ImageGenerationRequest) {
    return this.router.generateImage(body);
  }

  // ─── Video generation ────────────────────────────────────────────────────────

  @Post('generate/video')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a video via Veo 3 (Google). Requires GEMINI_API_KEY.',
  })
  async generateVideo(@Body() body: VideoGenerationRequest) {
    return this.router.generateVideo(body);
  }

  // ─── Audio processing ────────────────────────────────────────────────────────

  @Post('generate/audio')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Transcribe audio (Whisper) or synthesize speech (OpenAI TTS).',
  })
  async processAudio(@Body() body: AudioRequest) {
    return this.router.processAudio(body);
  }
}
