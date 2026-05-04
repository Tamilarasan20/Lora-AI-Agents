import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { ProviderAdapterFactory } from '../adapters/provider-adapter.factory';

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  openai:     'gpt-4o-mini',
  anthropic:  'claude-haiku-4-5-20251001',
  gemini:     'gemini-2.0-flash',
  perplexity: 'sonar',
  xai:        'grok-3-mini',
  meta:       'meta-llama/llama-4-maverick-17b-128e-instruct',
};

export interface ProviderHealth {
  provider: string;
  healthy:  boolean;
  latencyMs?: number;
  checkedAt: Date;
  error?: string;
}

@Injectable()
export class ProviderHealthService {
  private readonly logger = new Logger(ProviderHealthService.name);
  private readonly cache = new Map<string, ProviderHealth>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly factory: ProviderAdapterFactory,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runHealthChecks(): Promise<void> {
    const providers = this.factory.getHealthyProviders();
    if (providers.length === 0) return;

    const results = await Promise.allSettled(
      providers.map((p) => this.checkProvider(p)),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        await this.persistHealthStatus(result.value);
      }
    }
  }

  async checkProvider(providerName: string): Promise<ProviderHealth> {
    const modelId = PROVIDER_DEFAULT_MODELS[providerName];
    if (!modelId) {
      return { provider: providerName, healthy: false, checkedAt: new Date(), error: 'Unknown provider' };
    }

    const adapter = this.factory.get(providerName, modelId);
    if (!adapter) {
      return { provider: providerName, healthy: false, checkedAt: new Date(), error: 'No adapter configured' };
    }

    const result = await adapter.healthCheck();
    const health: ProviderHealth = {
      provider: providerName,
      healthy:  result.healthy,
      latencyMs: result.latencyMs,
      checkedAt: new Date(),
      error:    result.error,
    };

    this.cache.set(providerName, health);
    return health;
  }

  isHealthy(providerName: string): boolean {
    const cached = this.cache.get(providerName);
    if (!cached) return true; // optimistic if not checked yet
    const ageMs = Date.now() - cached.checkedAt.getTime();
    if (ageMs > 10 * 60 * 1000) return true; // stale → optimistic
    return cached.healthy;
  }

  getAll(): ProviderHealth[] {
    return [...this.cache.values()];
  }

  private async persistHealthStatus(health: ProviderHealth): Promise<void> {
    try {
      await this.prisma.llmProviderRegistry.updateMany({
        where: { name: health.provider },
        data: {
          healthStatus:      health.healthy ? 'healthy' : 'degraded',
          lastHealthCheckAt: health.checkedAt,
          healthLatencyMs:   health.latencyMs ?? null,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to persist health for ${health.provider}: ${err.message}`);
    }
  }
}
