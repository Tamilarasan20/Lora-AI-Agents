import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LlmRouterService } from './llm-router.service';
import { MODEL_REGISTRY, RoutingStrategy, LlmProvider } from './llm-router.types';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('LLM Router')
@ApiBearerAuth()
@Controller('llm-router')
export class LlmRouterController {
  constructor(private readonly router: LlmRouterService) {}

  @Get('models')
  @Public()
  @ApiOperation({ summary: 'List all models in the registry with specs and costs' })
  getModels() {
    const available = this.router.getAvailableProviders();
    return Object.entries(MODEL_REGISTRY).map(([key, spec]) => ({
      key,
      ...spec,
      available: available.includes(spec.provider),
    }));
  }

  @Get('providers')
  @Public()
  @ApiOperation({ summary: 'List currently configured (API key set) providers' })
  getProviders() {
    return { providers: this.router.getAvailableProviders() };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Per-model usage metrics: calls, cost, tokens, latency, failures' })
  getMetrics() {
    return this.router.getMetrics();
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a test prompt through the router' })
  async test(
    @Body() body: {
      prompt: string;
      strategy?: RoutingStrategy;
      preferredProviders?: LlmProvider[];
      forceModel?: string;
      taskType?: string;
    },
  ) {
    const response = await this.router.route({
      systemPrompt: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: body.prompt }],
      taskType: body.taskType,
      routing: {
        strategy: body.strategy ?? 'balanced',
        preferredProviders: body.preferredProviders,
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
    };
  }
}
