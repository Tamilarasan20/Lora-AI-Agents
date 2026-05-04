import {
  Controller, Get, Post, Body, HttpCode, HttpStatus, Query, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LlmRouterService, ProductionRouteRequest } from './llm-router.service';
import {
  MODEL_REGISTRY, LlmProvider,
  ImageGenerationRequest, VideoGenerationRequest, AudioRequest,
  CreditContext,
} from './llm-router.types';
import { Public } from '../common/decorators/public.decorator';

class TextRouteDto {
  prompt!: string;
  systemPrompt?: string;
  strategy?: 'cost' | 'speed' | 'quality' | 'balanced';
  forceModel?: string;
  excludedProviders?: LlmProvider[];
  taskType?: string;
  creditContext?: CreditContext;
}

class ProductionRouteDto {
  userPrompt!:   string;
  systemPrompt?: string;
  agentName?:    string;
  workspaceId?:  string;
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
      .map(([key, spec]) => ({ key, ...spec, available: available.has(spec.provider) }));
  }

  @Get('providers')
  @Public()
  @ApiOperation({ summary: 'List active providers (API keys configured)' })
  getProviders() {
    return {
      providers: this.router.getAvailableProviders(),
      total:     this.router.getAvailableProviders().length,
    };
  }

  @Get('providers/health')
  @ApiOperation({ summary: 'Provider health status from last health check run' })
  async getProviderHealth() {
    return this.router.getProvidersHealth();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Per-model usage: calls, tokens, cost, latency, failures' })
  getMetrics() {
    return this.router.getMetrics();
  }

  // ─── Production routing ───────────────────────────────────────────────────────

  @Post('route/production')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Full production pipeline: advisor → governor → model-selector → credit-reservation → execution → ledger',
  })
  async routeProduction(@Body() body: ProductionRouteDto, @Req() req: any) {
    const user = req.user as any;
    const request: ProductionRouteRequest = {
      userId:              user?.id ?? 'anonymous',
      workspaceId:         body.workspaceId ?? user?.workspaceId ?? 'default',
      agentName:           body.agentName,
      userPrompt:          body.userPrompt,
      systemPrompt:        body.systemPrompt,
      planTier:            user?.plan ?? 'FREE',
      subscriptionStatus:  user?.subscriptionStatus ?? 'active',
      creditsRemaining:    this.getRemainingCredits(user),
    };
    return this.router.routeProduction(request);
  }

  // ─── Classic routing ──────────────────────────────────────────────────────────

  @Post('classify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Classify a prompt — returns modality, complexity, task type, requiresWebSearch' })
  classify(@Body() body: ClassifyDto) {
    return this.router.classify(body.prompt, body.systemPrompt);
  }

  @Post('route')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Route a text prompt through the legacy intelligent router' })
  async route(@Body() body: TextRouteDto) {
    const response = await this.router.route({
      systemPrompt: body.systemPrompt ?? 'You are a helpful assistant.',
      messages:     [{ role: 'user', content: body.prompt }],
      taskType:     body.taskType,
      creditContext: body.creditContext,
      routing: {
        strategy:          body.strategy ?? 'balanced',
        excludedProviders: body.excludedProviders,
        forceModel:        body.forceModel,
        enableFallback:    true,
      },
    });

    return {
      output:          response.content,
      model:           response.model,
      provider:        response.provider,
      latencyMs:       response.latencyMs,
      costUsd:         response.costUsd,
      tokens:          response.usage,
      classification:  response.classification,
      routingDecision: response.routingDecision,
      citations:       response.citations,
    };
  }

  /** @deprecated use POST /route */
  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Deprecated] Alias for POST /route' })
  async test(@Body() body: TextRouteDto) {
    return this.route(body);
  }

  // ─── Media generation ─────────────────────────────────────────────────────────

  @Post('generate/image')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate an image via DALL-E 3 (OpenAI) or Imagen 3 (Google)' })
  async generateImage(@Body() body: ImageGenerationRequest) {
    return this.router.generateImage(body);
  }

  @Post('generate/video')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a video via Veo 3 (Google)' })
  async generateVideo(@Body() body: VideoGenerationRequest) {
    return this.router.generateVideo(body);
  }

  @Post('generate/audio')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transcribe audio (Whisper) or synthesize speech (OpenAI TTS)' })
  async processAudio(@Body() body: AudioRequest) {
    return this.router.processAudio(body);
  }

  private getRemainingCredits(user: any): number {
    if (!user) return 0;
    const limits: Record<string, number> = {
      FREE: 500, SOLO: 5000, PRO: 25000, AGENCY: 75000, ENTERPRISE: 200000,
    };
    const limit = limits[user.plan?.toUpperCase() ?? 'FREE'] ?? 500;
    return Math.max(0, limit - (user.creditsUsedThisMonth ?? 0));
  }
}
