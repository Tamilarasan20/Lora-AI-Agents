import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LlmProvider,
  LlmRequest,
  LlmResponse,
  ModelSpec,
  RoutingConfig,
  RoutingStrategy,
  TaskComplexity,
  TASK_COMPLEXITY_MAP,
  MODEL_REGISTRY,
} from './llm-router.types';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { GoogleProvider } from './providers/google.provider';
import { XAiProvider } from './providers/xai.provider';
import { MetaProvider } from './providers/meta.provider';

interface ProviderCallable {
  call(request: LlmRequest, spec: ModelSpec): Promise<LlmResponse>;
}

export interface RouteMetrics {
  totalCalls: number;
  totalCostUsd: number;
  totalTokens: number;
  avgLatencyMs: number;
  failureCount: number;
}

@Injectable()
export class LlmRouterService {
  private readonly logger = new Logger(LlmRouterService.name);

  private readonly providers = new Map<LlmProvider, ProviderCallable>();
  private readonly metrics = new Map<string, RouteMetrics>();

  // Round-robin state
  private rrIndex = 0;

  constructor(private readonly config: ConfigService) {
    this.initProviders();
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  async route(request: LlmRequest): Promise<LlmResponse> {
    const routing = request.routing ?? { strategy: 'balanced', enableFallback: true };

    // Forced model — skip routing logic
    if (routing.forceModel) {
      const spec = MODEL_REGISTRY[routing.forceModel];
      if (!spec) throw new Error(`Unknown model key: ${routing.forceModel}`);
      return this.callWithFallback(request, [spec], routing.enableFallback ?? true);
    }

    const candidates = this.selectCandidates(request, routing);

    if (candidates.length === 0) {
      throw new Error(
        `No available model for strategy=${routing.strategy} task=${request.taskType ?? 'unknown'}`,
      );
    }

    return this.callWithFallback(request, candidates, routing.enableFallback ?? true);
  }

  /** Convenience: route using the default balanced strategy */
  async call(request: LlmRequest): Promise<LlmResponse> {
    return this.route(request);
  }

  getMetrics(): Record<string, RouteMetrics> {
    return Object.fromEntries(this.metrics);
  }

  getAvailableProviders(): LlmProvider[] {
    return [...this.providers.keys()];
  }

  // ─── Model selection ─────────────────────────────────────────────────────────

  private selectCandidates(request: LlmRequest, routing: RoutingConfig): ModelSpec[] {
    const complexity = this.inferComplexity(request.taskType);
    const available = this.availableModels(routing);

    switch (routing.strategy) {
      case 'cost':     return this.byCost(available, complexity);
      case 'performance': return this.byPerformance(available, complexity);
      case 'latency':  return this.byLatency(available, complexity);
      case 'balanced': return this.byBalanced(available, complexity);
      case 'round_robin': return this.byRoundRobin(available, complexity);
      case 'fallback': return this.byFallbackChain(available, complexity);
      default:         return this.byBalanced(available, complexity);
    }
  }

  private byCost(models: ModelSpec[], complexity: TaskComplexity): ModelSpec[] {
    return models
      .filter((m) => m.suitedFor.includes(complexity) && this.providers.has(m.provider))
      .sort((a, b) => (a.inputCostPer1M + a.outputCostPer1M) - (b.inputCostPer1M + b.outputCostPer1M));
  }

  private byPerformance(models: ModelSpec[], complexity: TaskComplexity): ModelSpec[] {
    // Rank: complex-suited > medium > simple; then by cost descending (more expensive = higher quality heuristic)
    const tierOrder: TaskComplexity[] = ['complex', 'medium', 'simple'];
    return models
      .filter((m) => m.suitedFor.includes(complexity) && this.providers.has(m.provider))
      .sort((a, b) => {
        const aMax = Math.max(...a.suitedFor.map((t) => tierOrder.indexOf(t)));
        const bMax = Math.max(...b.suitedFor.map((t) => tierOrder.indexOf(t)));
        if (aMax !== bMax) return aMax - bMax;
        return (b.inputCostPer1M + b.outputCostPer1M) - (a.inputCostPer1M + a.outputCostPer1M);
      });
  }

  private byLatency(models: ModelSpec[], complexity: TaskComplexity): ModelSpec[] {
    const latencyOrder = { fast: 0, medium: 1, slow: 2 };
    return models
      .filter((m) => m.suitedFor.includes(complexity) && this.providers.has(m.provider))
      .sort((a, b) => latencyOrder[a.latency] - latencyOrder[b.latency]);
  }

  private byBalanced(models: ModelSpec[], complexity: TaskComplexity): ModelSpec[] {
    // Balanced score = quality_tier * 2 - log(cost) so cheap fast models win on simple tasks
    // and capable models win on complex tasks
    const complexityWeight = { simple: 1, medium: 2, complex: 3 };

    return models
      .filter((m) => m.suitedFor.includes(complexity) && this.providers.has(m.provider))
      .sort((a, b) => {
        const aScore = this.balancedScore(a, complexity, complexityWeight);
        const bScore = this.balancedScore(b, complexity, complexityWeight);
        return bScore - aScore;
      });
  }

  private balancedScore(
    m: ModelSpec,
    complexity: TaskComplexity,
    weights: Record<TaskComplexity, number>,
  ): number {
    const maxTier = Math.max(...m.suitedFor.map((t) => weights[t]));
    const costPenalty = Math.log1p(m.inputCostPer1M + m.outputCostPer1M);
    const latencyBonus = m.latency === 'fast' ? 1.5 : m.latency === 'medium' ? 1.0 : 0.5;
    const complexityBonus = m.suitedFor.includes(complexity) ? weights[complexity] : 0;
    return maxTier + latencyBonus + complexityBonus - costPenalty;
  }

  private byRoundRobin(models: ModelSpec[], complexity: TaskComplexity): ModelSpec[] {
    const suited = models.filter(
      (m) => m.suitedFor.includes(complexity) && this.providers.has(m.provider),
    );
    if (suited.length === 0) return [];
    const chosen = suited[this.rrIndex % suited.length];
    this.rrIndex++;
    return [chosen, ...suited.filter((m) => m !== chosen)];
  }

  private byFallbackChain(models: ModelSpec[], complexity: TaskComplexity): ModelSpec[] {
    // Primary = performance winner; fallbacks ordered by cost
    const [primary, ...rest] = this.byPerformance(models, complexity);
    const fallbacks = this.byCost(rest, complexity);
    return primary ? [primary, ...fallbacks] : fallbacks;
  }

  // ─── Execution with fallback ──────────────────────────────────────────────

  private async callWithFallback(
    request: LlmRequest,
    candidates: ModelSpec[],
    enableFallback: boolean,
  ): Promise<LlmResponse> {
    const attempts = enableFallback ? candidates.slice(0, 3) : candidates.slice(0, 1);

    let lastError: unknown;

    for (const spec of attempts) {
      const provider = this.providers.get(spec.provider);
      if (!provider) continue;

      try {
        this.logger.debug(
          `Routing to ${spec.displayName} [${spec.provider}] for task=${request.taskType ?? 'unknown'}`,
        );
        const response = await provider.call(request, spec);
        this.recordMetrics(spec, response, false);
        return response;
      } catch (err) {
        this.logger.warn(
          `${spec.displayName} failed: ${(err as Error).message} — ${enableFallback ? 'trying next' : 'no fallback'}`,
        );
        this.recordMetrics(spec, null, true);
        lastError = err;
        if (!enableFallback) break;
      }
    }

    throw new Error(`All LLM providers failed. Last error: ${(lastError as Error)?.message}`);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private availableModels(routing: RoutingConfig): ModelSpec[] {
    const excluded = new Set(routing.excludedProviders ?? []);
    const preferred = routing.preferredProviders ?? [];

    let models = Object.values(MODEL_REGISTRY).filter(
      (m) => this.providers.has(m.provider) && !excluded.has(m.provider),
    );

    if (preferred.length > 0) {
      // Sort: preferred providers first
      models = models.sort((a, b) => {
        const ai = preferred.indexOf(a.provider);
        const bi = preferred.indexOf(b.provider);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    }

    return models;
  }

  private inferComplexity(taskType?: string): TaskComplexity {
    if (!taskType) return 'medium';
    return TASK_COMPLEXITY_MAP[taskType] ?? 'medium';
  }

  private recordMetrics(spec: ModelSpec, response: LlmResponse | null, failed: boolean): void {
    const key = `${spec.provider}/${spec.modelId}`;
    const existing = this.metrics.get(key) ?? {
      totalCalls: 0, totalCostUsd: 0, totalTokens: 0, avgLatencyMs: 0, failureCount: 0,
    };

    existing.totalCalls++;
    if (failed) {
      existing.failureCount++;
    } else if (response) {
      existing.totalCostUsd += response.costUsd;
      existing.totalTokens += response.usage.inputTokens + response.usage.outputTokens;
      existing.avgLatencyMs =
        (existing.avgLatencyMs * (existing.totalCalls - 1) + response.latencyMs) /
        existing.totalCalls;
    }

    this.metrics.set(key, existing);
  }

  private initProviders(): void {
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      this.providers.set('anthropic', new AnthropicProvider(anthropicKey));
      this.logger.log('✅ Anthropic provider ready');
    }

    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      this.providers.set('openai', new OpenAiProvider(openaiKey));
      this.logger.log('✅ OpenAI provider ready');
    }

    const googleKey = this.config.get<string>('GEMINI_API_KEY');
    if (googleKey) {
      this.providers.set('google', new GoogleProvider(googleKey));
      this.logger.log('✅ Google Gemini provider ready');
    }

    const xaiKey = this.config.get<string>('XAI_API_KEY');
    if (xaiKey) {
      this.providers.set('xai', new XAiProvider(xaiKey));
      this.logger.log('✅ xAI Grok provider ready');
    }

    const groqKey = this.config.get<string>('GROQ_API_KEY');
    if (groqKey) {
      this.providers.set('meta', new MetaProvider(groqKey));
      this.logger.log('✅ Meta Llama (Groq) provider ready');
    }

    if (this.providers.size === 0) {
      this.logger.warn('⚠️  No LLM providers configured — set at least one API key');
    }
  }
}
