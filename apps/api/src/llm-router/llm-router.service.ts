import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LlmProvider,
  LlmRequest,
  LlmResponse,
  ModelSpec,
  MODEL_REGISTRY,
  ImageGenerationRequest,
  ImageGenerationResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
  AudioRequest,
  AudioResponse,
  CreditContext,
  RoutingAdvisorDecision,
  ClassificationResult,
} from './llm-router.types';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { XAiProvider } from './providers/xai.provider';
import { MetaProvider } from './providers/meta.provider';
import { PerplexityProvider } from './providers/perplexity.provider';
import { classifyPrompt } from './classifier/prompt-classifier';
import { resolveModelCandidates } from './routing/routing-rules';
import { RoutingAdvisor } from './routing/routing-advisor';
import { applyGuardrails } from './routing/guardrails';
import { CostTracker } from './cost/cost-tracker';

// Unified provider interface used internally
interface ITextProvider {
  generateText(request: LlmRequest, spec: ModelSpec): Promise<LlmResponse>;
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

  // Text providers (keyed by LlmProvider name)
  private readonly textProviders = new Map<LlmProvider, ITextProvider>();

  // Media-capable providers
  private geminiProvider?: GeminiProvider;
  private openAiProvider?: OpenAiProvider;

  // Routing intelligence
  private advisor?: RoutingAdvisor;

  constructor(
    private readonly config: ConfigService,
    private readonly costTracker: CostTracker,
  ) {
    this.initProviders();
  }

  // ─── Public API — text ───────────────────────────────────────────────────────

  async route(request: LlmRequest): Promise<LlmResponse> {
    const routing = request.routing ?? {};

    // Forced model bypass
    if (routing.forceModel) {
      const spec = MODEL_REGISTRY[routing.forceModel];
      if (!spec) throw new Error(`Unknown model key: ${routing.forceModel}`);
      return this.executeWithFallback(request, [spec], routing.enableFallback ?? true);
    }

    // ── Step 1: Heuristic classification (< 2ms) ────────────────────────────
    const userText = request.messages.at(-1)?.content;
    const promptText = typeof userText === 'string' ? userText : '';
    const heuristic: ClassificationResult = classifyPrompt(promptText, request.systemPrompt);

    this.logger.debug(
      `[Classify] modality=${heuristic.modality} complexity=${heuristic.complexity} ` +
      `task=${heuristic.taskType} web=${heuristic.requiresWebSearch} conf=${heuristic.confidence}`,
    );

    // ── Step 2: Simple prompt shortcut ──────────────────────────────────────
    if (heuristic.complexity === 'low' && heuristic.confidence >= 0.65) {
      const fastModel = this.pickFastModel(heuristic, request.creditContext);
      if (fastModel) {
        return this.executeWithFallback(
          request, [fastModel.spec],
          routing.enableFallback ?? true,
          fastModel.decision,
          heuristic,
        );
      }
    }

    // ── Step 3: Routing advisor (LLM-assisted for complex prompts) ──────────
    let advisorDecision: RoutingAdvisorDecision | undefined;
    if (this.advisor && heuristic.confidence < 0.70) {
      advisorDecision = await this.advisor.advise(promptText, heuristic);
      this.logger.debug(`[Advisor] src=${advisorDecision.source} model=${advisorDecision.recommendedModelKey}`);
    }

    // ── Step 4: Resolve model candidates ────────────────────────────────────
    const classification = advisorDecision ?? this.heuristicToDecision(heuristic);

    // Apply guardrails (plan limits, credit checks)
    const safeDecision = applyGuardrails(
      classification,
      request.creditContext,
      new Set(this.textProviders.keys()),
    );

    // Build ordered candidate list: primary recommendation + routing matrix fallbacks
    const matrixKeys = resolveModelCandidates(
      safeDecision.modality,
      safeDecision.complexity,
      safeDecision.taskType,
    );

    const candidates = this.buildCandidateList(safeDecision.recommendedModelKey, matrixKeys, request.creditContext);

    if (candidates.length === 0) {
      throw new Error(
        `No available model for task=${safeDecision.taskType} complexity=${safeDecision.complexity}`,
      );
    }

    return this.executeWithFallback(
      request,
      candidates,
      routing.enableFallback ?? true,
      safeDecision,
      heuristic,
    );
  }

  /** Convenience alias */
  async call(request: LlmRequest): Promise<LlmResponse> {
    return this.route(request);
  }

  // ─── Public API — image ───────────────────────────────────────────────────────

  async generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const classification = classifyPrompt(req.prompt);
    const keys = resolveModelCandidates('image', classification.complexity, 'chat');
    const orderedKeys = keys.length ? keys : ['dall-e-3', 'gemini-imagen'];
    const excluded = new Set(req.routing?.excludedProviders ?? []);

    for (const key of orderedKeys) {
      const spec = MODEL_REGISTRY[key];
      if (!spec || excluded.has(spec.provider)) continue;

      try {
        if (spec.provider === 'openai' && this.openAiProvider) {
          return await this.openAiProvider.generateImage(req, spec.modelId);
        }
        if (spec.provider === 'google' && this.geminiProvider) {
          return await this.geminiProvider.generateImage(req, spec.modelId);
        }
      } catch (err) {
        this.logger.warn(`Image provider ${key} failed: ${(err as Error).message}`);
      }
    }

    throw new Error('No image provider available — set OPENAI_API_KEY or GEMINI_API_KEY');
  }

  // ─── Public API — video ───────────────────────────────────────────────────────

  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    if (!this.geminiProvider) {
      throw new Error('Video generation requires GEMINI_API_KEY (Veo 3)');
    }

    const classification = classifyPrompt(req.prompt);
    const keys = resolveModelCandidates('video', classification.complexity, 'chat');
    const modelKey = keys[0] ?? 'veo-3';
    const spec = MODEL_REGISTRY[modelKey];

    if (!spec) throw new Error(`Video model ${modelKey} not found in registry`);

    // Only Veo 3 (Google) is in scope
    return this.geminiProvider.generateVideo(req, spec.modelId);
  }

  // ─── Public API — audio ───────────────────────────────────────────────────────

  async processAudio(req: AudioRequest): Promise<AudioResponse> {
    // Transcription: prefer Whisper
    if (req.type === 'transcribe') {
      if (this.openAiProvider) return this.openAiProvider.processAudio(req);
      if (this.geminiProvider) return this.geminiProvider.processAudio(req);
      throw new Error('Transcription requires OPENAI_API_KEY or GEMINI_API_KEY');
    }

    // TTS: OpenAI TTS
    if (this.openAiProvider) return this.openAiProvider.processAudio(req);
    throw new Error('TTS requires OPENAI_API_KEY');
  }

  // ─── Classify-only (debug / UI) ──────────────────────────────────────────────

  classify(prompt: string, systemPrompt?: string): ClassificationResult {
    return classifyPrompt(prompt, systemPrompt);
  }

  getMetrics() {
    return this.costTracker.getModelMetrics();
  }

  getAvailableProviders(): LlmProvider[] {
    return [...this.textProviders.keys()];
  }

  // ─── Execution engine ─────────────────────────────────────────────────────────

  private async executeWithFallback(
    request: LlmRequest,
    candidates: ModelSpec[],
    enableFallback: boolean,
    decision?: RoutingAdvisorDecision,
    classification?: ClassificationResult,
  ): Promise<LlmResponse> {
    const attempts = enableFallback ? candidates.slice(0, 3) : candidates.slice(0, 1);
    let lastError: unknown;

    for (const spec of attempts) {
      const provider = this.textProviders.get(spec.provider);
      if (!provider) continue;

      try {
        this.logger.debug(`[Route] → ${spec.displayName} [${spec.provider}]`);
        const response = await provider.generateText(request, spec);

        this.costTracker.recordModelSuccess(
          `${spec.provider}/${spec.modelId}`,
          { input: response.usage.inputTokens, output: response.usage.outputTokens },
          response.costUsd,
          response.latencyMs,
        );

        // Deduct credits if context provided
        if (request.creditContext) {
          request.creditContext = this.costTracker.deductCredits(
            request.creditContext,
            response.costUsd,
          );
        }

        response.classification = classification;
        response.routingDecision = decision;
        return response;

      } catch (err) {
        this.logger.warn(
          `${spec.displayName} failed: ${(err as Error).message}${enableFallback ? ' — trying fallback' : ''}`,
        );
        this.costTracker.recordModelFailure(`${spec.provider}/${spec.modelId}`);
        lastError = err;
        if (!enableFallback) break;
      }
    }

    throw new Error(`All providers failed. Last: ${(lastError as Error)?.message}`);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private pickFastModel(
    h: ClassificationResult,
    creditCtx?: CreditContext,
  ): { spec: ModelSpec; decision: RoutingAdvisorDecision } | undefined {
    const candidates = resolveModelCandidates(h.modality, h.complexity, h.taskType);
    const planTier = creditCtx?.planTier ?? 'free';

    const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise'];

    const key = candidates.find((k) => {
      const s = MODEL_REGISTRY[k];
      return s &&
        this.textProviders.has(s.provider) &&
        PLAN_ORDER.indexOf(planTier) >= PLAN_ORDER.indexOf(s.minPlanTier);
    });

    if (!key) return undefined;
    const spec = MODEL_REGISTRY[key];

    return {
      spec,
      decision: {
        modality: h.modality,
        complexity: h.complexity,
        taskType: h.taskType,
        requiresWebSearch: h.requiresWebSearch,
        recommendedProvider: spec.provider,
        recommendedModelKey: key,
        reason: 'Fast-path: low complexity heuristic shortcut',
        source: 'heuristic',
      },
    };
  }

  private heuristicToDecision(h: ClassificationResult): RoutingAdvisorDecision {
    const candidates = resolveModelCandidates(h.modality, h.complexity, h.taskType);
    const key = candidates.find((k) => {
      const s = MODEL_REGISTRY[k];
      return s && this.textProviders.has(s.provider);
    }) ?? candidates[0] ?? 'gemini-2.0-flash';

    const spec = MODEL_REGISTRY[key];
    return {
      modality: h.modality,
      complexity: h.complexity,
      taskType: h.taskType,
      requiresWebSearch: h.requiresWebSearch,
      recommendedProvider: spec?.provider ?? 'google',
      recommendedModelKey: key,
      reason: `Heuristic routing: ${h.modality}:${h.complexity}:${h.taskType}`,
      source: 'heuristic',
    };
  }

  private buildCandidateList(
    primaryKey: string,
    matrixKeys: string[],
    creditCtx?: CreditContext,
  ): ModelSpec[] {
    const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise'];
    const planTier = creditCtx?.planTier ?? 'free';

    const seen = new Set<string>();
    const result: ModelSpec[] = [];

    // Primary first
    const allKeys = [primaryKey, ...matrixKeys.filter((k) => k !== primaryKey)];

    for (const key of allKeys) {
      const spec = MODEL_REGISTRY[key];
      if (!spec) continue;
      if (!this.textProviders.has(spec.provider)) continue;
      if (seen.has(key)) continue;
      if (PLAN_ORDER.indexOf(planTier) < PLAN_ORDER.indexOf(spec.minPlanTier)) continue;
      seen.add(key);
      result.push(spec);
    }

    return result;
  }

  // ─── Provider initialisation ──────────────────────────────────────────────────

  private initProviders(): void {
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      this.textProviders.set('anthropic', new AnthropicProvider(anthropicKey));
      this.logger.log('✅ Anthropic (Claude) ready');
    }

    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      const p = new OpenAiProvider(openaiKey);
      this.textProviders.set('openai', p);
      this.openAiProvider = p;
      this.logger.log('✅ OpenAI (GPT + DALL-E + Whisper) ready');
    }

    const geminiKey = this.config.get<string>('GEMINI_API_KEY');
    if (geminiKey) {
      const p = new GeminiProvider(geminiKey);
      this.textProviders.set('google', p);
      this.geminiProvider = p;
      this.logger.log('✅ Google (Gemini + Imagen + Veo 3) ready');
    }

    const xaiKey = this.config.get<string>('XAI_API_KEY');
    if (xaiKey) {
      this.textProviders.set('xai', new XAiProvider(xaiKey));
      this.logger.log('✅ xAI (Grok) ready');
    }

    const groqKey = this.config.get<string>('GROQ_API_KEY');
    if (groqKey) {
      this.textProviders.set('meta', new MetaProvider(groqKey));
      this.logger.log('✅ Meta (Llama via Groq) ready');
    }

    const perplexityKey = this.config.get<string>('PERPLEXITY_API_KEY');
    if (perplexityKey) {
      this.textProviders.set('perplexity', new PerplexityProvider(perplexityKey));
      this.logger.log('✅ Perplexity (Sonar search-augmented) ready');
    }

    if (this.textProviders.size === 0) {
      this.logger.warn('⚠️  No providers configured — set at least one API key');
      return;
    }

    // Wire routing advisor using cheapest available model
    this.advisor = this.buildAdvisor();

    this.logger.log(
      `🧠 LLM Router ready: ${this.textProviders.size} providers, ` +
      `advisor=${this.advisor ? 'enabled' : 'disabled'}`,
    );
  }

  private buildAdvisor(): RoutingAdvisor {
    const available = new Set(this.textProviders.keys());

    // Prefer cheapest fast model for advisor to minimise routing overhead
    const advisorOrder: Array<[LlmProvider, string]> = [
      ['google', 'gemini-2.0-flash'],
      ['openai', 'gpt-4o-mini'],
      ['anthropic', 'claude-haiku-4-5'],
      ['xai', 'grok-3-mini'],
      ['meta', 'llama-4-maverick'],
    ];

    const [chosenProvider, chosenKey] =
      advisorOrder.find(([p]) => this.textProviders.has(p)) ??
      [undefined, undefined];

    if (!chosenProvider || !chosenKey) {
      return new RoutingAdvisor(async () => '', available);
    }

    const spec = MODEL_REGISTRY[chosenKey];
    const provider = this.textProviders.get(chosenProvider)!;

    const callFn = async (prompt: string, systemPrompt: string): Promise<string> => {
      const resp = await provider.generateText(
        {
          systemPrompt,
          messages: [{ role: 'user', content: prompt }],
          maxTokens: 512,
          temperature: 0.1,
        },
        spec,
      );
      return resp.content;
    };

    return new RoutingAdvisor(callFn, available);
  }
}
