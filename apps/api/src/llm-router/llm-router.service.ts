import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
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

// ── Production-grade services ────────────────────────────────────────────────
import { RouterAdvisorService } from './services/router-advisor.service';
import { RouterGovernorService, GovernorContext } from './services/router-governor.service';
import { ModelSelectorService } from './services/model-selector.service';
import { ProviderHealthService } from './services/provider-health.service';
import { UsageLedgerService } from './services/usage-ledger.service';
import { CreditReservationService } from './services/credit-reservation.service';
import { RoutingPolicyService } from './policies/routing-policy.service';
import { ProviderAdapterFactory } from './adapters/provider-adapter.factory';
import { NormalizedLlmResponse } from './adapters/llm-provider.interface';
import { LLM_ROUTER_EVENTS, LlmRouterEventPayload } from './events/llm-router.events';

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

// ─── Production routing request ───────────────────────────────────────────────
export interface ProductionRouteRequest {
  userId:       string;
  workspaceId:  string;
  agentName?:   string;
  userPrompt:   string;
  systemPrompt?: string;
  planTier:     string;
  subscriptionStatus: string;
  creditsRemaining:   number;
  conversationId?:    string;
  requestId?:         string;
}

export interface ProductionRouteResponse {
  requestId:      string;
  text?:          string;
  assets?:        NormalizedLlmResponse['assets'];
  citations?:     string[];
  toolCalls?:     NormalizedLlmResponse['toolCalls'];
  provider:       string;
  modelId:        string;
  tier:           string;
  latencyMs:      number;
  costUsd:        number;
  creditsDeducted: number;
  fallbackUsed:   boolean;
  governorMods:   string[];
}

@Injectable()
export class LlmRouterService {
  private readonly logger = new Logger(LlmRouterService.name);

  // ── Legacy text providers ────────────────────────────────────────────────────
  private readonly textProviders = new Map<LlmProvider, ITextProvider>();
  private geminiProvider?: GeminiProvider;
  private openAiProvider?: OpenAiProvider;
  private advisor?: RoutingAdvisor;
  private readonly emitter = new EventEmitter();

  constructor(
    private readonly config: ConfigService,
    private readonly costTracker: CostTracker,
    // Production services
    private readonly routerAdvisor: RouterAdvisorService,
    private readonly routerGovernor: RouterGovernorService,
    private readonly modelSelector: ModelSelectorService,
    private readonly providerHealth: ProviderHealthService,
    private readonly usageLedger: UsageLedgerService,
    private readonly creditReservation: CreditReservationService,
    private readonly routingPolicy: RoutingPolicyService,
    private readonly adapterFactory: ProviderAdapterFactory,
  ) {
    this.initProviders();
  }

  // ─── Production pipeline ─────────────────────────────────────────────────────

  async routeProduction(req: ProductionRouteRequest): Promise<ProductionRouteResponse> {
    const requestId  = req.requestId ?? randomUUID();
    const start      = Date.now();
    let ledgerId: string | undefined;
    let reservationId: string | undefined;

    this.emitEvent(LLM_ROUTER_EVENTS.ROUTE_STARTED, {
      requestId,
      conversationId: req.conversationId,
      agentName: req.agentName,
      status: 'started',
    });

    try {
      // Step 1: Advisor — analyze the task
      const availableTiers = this.getAvailableTiers(req.planTier);
      const { decision, source } = await this.routerAdvisor.analyze({
        agentName:      req.agentName,
        prompt:         req.userPrompt,
        availableTiers,
      });

      this.emitEvent(LLM_ROUTER_EVENTS.ADVISOR_COMPLETED, {
        requestId, agentName: req.agentName, status: 'advisor_done',
        message: `Advisor (${source}): ${decision.taskType} ${decision.recommendedTier}`,
      });

      // Step 2: Load routing policy constraints
      const policy = await this.routingPolicy.resolve(req.agentName, decision.taskType, decision.modality);

      // Step 3: Governor — enforce 15 rules
      const govCtx: GovernorContext = {
        userId:             req.userId,
        planTier:           req.planTier,
        subscriptionStatus: req.subscriptionStatus,
        creditsRemaining:   req.creditsRemaining,
        creditsReserved:    0,
        monthlySpendUsd:    await this.usageLedger.getMonthlySpendUsd(req.userId),
        requestsLastMinute: 0,
      };

      const govResult = this.routerGovernor.enforce(decision, govCtx);

      this.emitEvent(LLM_ROUTER_EVENTS.GOVERNOR_COMPLETED, {
        requestId, status: govResult.approved ? 'approved' : 'blocked',
        message: govResult.blockedReason ?? `Approved with ${govResult.modifications.length} mods`,
      });

      if (!govResult.approved) {
        this.emitEvent(LLM_ROUTER_EVENTS.INSUFFICIENT_CREDITS, {
          requestId, status: 'blocked', errorCode: 'GOVERNOR_BLOCKED',
          message: govResult.blockedReason,
        });
        throw new Error(govResult.blockedReason ?? 'Request blocked by governor');
      }

      const approvedDecision = govResult.decision;

      // Step 4: Model selection — scored candidates from DB
      const estimatedInputTokens = Math.ceil(req.userPrompt.length / 4);
      const candidates = await this.modelSelector.select(
        approvedDecision,
        estimatedInputTokens,
        policy.preferredProviders,
        policy.blockedProviders,
      );

      if (candidates.length === 0) {
        throw new Error(`No model available for ${approvedDecision.taskType}/${approvedDecision.modality}`);
      }

      const primary = candidates[0];
      const estimatedCostUsd = primary.estimatedCostUsd;
      const estimatedCredits = this.creditReservation.usdToCredits(estimatedCostUsd);

      this.emitEvent(LLM_ROUTER_EVENTS.MODEL_SELECTED, {
        requestId,
        selectedProvider: primary.provider,
        selectedModel:    primary.modelId,
        routeTier:        primary.tier,
        estimatedCredits,
        status:           'model_selected',
      });

      // Step 5: Reserve credits
      const reservation = await this.creditReservation.reserve({
        workspaceId:      req.workspaceId,
        userId:           req.userId,
        requestId,
        estimatedCostUsd,
      });
      reservationId = reservation.reservationId;

      this.emitEvent(LLM_ROUTER_EVENTS.CREDIT_RESERVED, {
        requestId,
        estimatedCredits: reservation.reservedCredits,
        status:           'credit_reserved',
      });

      // Step 6: Create ledger record
      ledgerId = await this.usageLedger.create({
        workspaceId:      req.workspaceId,
        userId:           req.userId,
        requestId,
        agentName:        req.agentName,
        decision:         approvedDecision,
        selectedProvider: primary.provider,
        selectedModel:    primary.modelId,
        estimatedCostUsd,
        creditsReserved:  reservation.reservedCredits,
      });

      // Step 7: Execute with fallback
      this.emitEvent(LLM_ROUTER_EVENTS.PROVIDER_STARTED, {
        requestId,
        selectedProvider: primary.provider,
        selectedModel:    primary.modelId,
        status:           'provider_started',
      });

      let response: NormalizedLlmResponse | undefined;
      let usedModel = primary.modelId;
      let usedProvider = primary.provider;
      let fallbackUsed = false;
      const fallbackCandidates = candidates.slice(1, 3);

      try {
        response = await this.executeAdapter(primary.provider, primary.modelId, req);
      } catch (primaryErr: any) {
        this.logger.warn(`Primary ${primary.provider}/${primary.modelId} failed: ${primaryErr.message}`);

        for (const fallback of fallbackCandidates) {
          if (!approvedDecision.fallbackRequired) break;
          try {
            this.emitEvent(LLM_ROUTER_EVENTS.FALLBACK_STARTED, {
              requestId, status: 'fallback', message: `Trying ${fallback.provider}/${fallback.modelId}`,
            });
            response = await this.executeAdapter(fallback.provider, fallback.modelId, req);
            fallbackUsed = true;
            usedProvider = fallback.provider;
            usedModel    = fallback.modelId;
            break;
          } catch (fbErr: any) {
            this.logger.warn(`Fallback ${fallback.provider} failed: ${fbErr.message}`);
          }
        }
      }

      if (!response) {
        await this.creditReservation.refund(reservationId);
        await this.usageLedger.fail(ledgerId, 'ALL_PROVIDERS_FAILED', 'All providers failed');
        this.emitEvent(LLM_ROUTER_EVENTS.FAILED, {
          requestId, status: 'failed', errorCode: 'ALL_PROVIDERS_FAILED',
        });
        throw new Error('All providers failed — request could not be completed');
      }

      this.emitEvent(LLM_ROUTER_EVENTS.PROVIDER_COMPLETED, {
        requestId, selectedProvider: usedProvider, selectedModel: usedModel,
        status: 'provider_done',
      });

      // Step 8: Consume credits + update ledger
      const actualCostUsd    = response.costUsd;
      const creditsDeducted  = this.creditReservation.usdToCredits(actualCostUsd);

      await Promise.all([
        this.creditReservation.consume(reservationId, actualCostUsd),
        this.usageLedger.complete({
          ledgerId,
          response,
          actualCostUsd,
          creditsDeducted,
          fallbackUsed,
          fallbackFromModel: fallbackUsed ? primary.modelId : undefined,
          fallbackToModel:   fallbackUsed ? usedModel : undefined,
        }),
      ]);

      this.emitEvent(LLM_ROUTER_EVENTS.COMPLETED, {
        requestId,
        selectedProvider: usedProvider,
        selectedModel:    usedModel,
        routeTier:        primary.tier,
        creditsDeducted,
        fallbackUsed,
        status:           'completed',
      });

      return {
        requestId,
        text:            response.text,
        assets:          response.assets,
        citations:       response.citations,
        toolCalls:       response.toolCalls,
        provider:        usedProvider,
        modelId:         usedModel,
        tier:            primary.tier,
        latencyMs:       Date.now() - start,
        costUsd:         actualCostUsd,
        creditsDeducted,
        fallbackUsed,
        governorMods:    govResult.modifications,
      };
    } catch (err: any) {
      if (reservationId) {
        await this.creditReservation.refund(reservationId).catch(() => {});
      }
      if (ledgerId) {
        await this.usageLedger.fail(ledgerId, 'ROUTING_ERROR', err.message).catch(() => {});
      }
      this.emitEvent(LLM_ROUTER_EVENTS.FAILED, {
        requestId, status: 'failed', errorCode: 'ROUTING_ERROR', message: err.message,
      });
      throw err;
    }
  }

  // ─── Legacy public API — text ────────────────────────────────────────────────

  async route(request: LlmRequest): Promise<LlmResponse> {
    const routing = request.routing ?? {};

    if (routing.forceModel) {
      const spec = MODEL_REGISTRY[routing.forceModel];
      if (!spec) throw new Error(`Unknown model key: ${routing.forceModel}`);
      return this.executeWithFallback(request, [spec], routing.enableFallback ?? true);
    }

    const userText  = request.messages.at(-1)?.content;
    const promptText = typeof userText === 'string' ? userText : '';
    const heuristic: ClassificationResult = classifyPrompt(promptText, request.systemPrompt);

    if (heuristic.complexity === 'low' && heuristic.confidence >= 0.65) {
      const fastModel = this.pickFastModel(heuristic, request.creditContext);
      if (fastModel) {
        return this.executeWithFallback(
          request, [fastModel.spec], routing.enableFallback ?? true,
          fastModel.decision, heuristic,
        );
      }
    }

    let advisorDecision: RoutingAdvisorDecision | undefined;
    if (this.advisor && heuristic.confidence < 0.70) {
      advisorDecision = await this.advisor.advise(promptText, heuristic);
    }

    const classification = advisorDecision ?? this.heuristicToDecision(heuristic);
    const safeDecision   = applyGuardrails(classification, request.creditContext, new Set(this.textProviders.keys()));
    const matrixKeys     = resolveModelCandidates(safeDecision.modality, safeDecision.complexity, safeDecision.taskType);
    const candidates     = this.buildCandidateList(safeDecision.recommendedModelKey, matrixKeys, request.creditContext);

    if (candidates.length === 0) {
      throw new Error(`No available model for task=${safeDecision.taskType} complexity=${safeDecision.complexity}`);
    }

    return this.executeWithFallback(request, candidates, routing.enableFallback ?? true, safeDecision, heuristic);
  }

  async call(request: LlmRequest): Promise<LlmResponse> {
    return this.route(request);
  }

  // ─── Legacy public API — image/video/audio ───────────────────────────────────

  async generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const classification = classifyPrompt(req.prompt);
    const keys = resolveModelCandidates('image', classification.complexity, 'chat');
    const orderedKeys = keys.length ? keys : ['dall-e-3', 'gemini-imagen'];
    const excluded = new Set(req.routing?.excludedProviders ?? []);

    for (const key of orderedKeys) {
      const spec = MODEL_REGISTRY[key];
      if (!spec || excluded.has(spec.provider)) continue;
      try {
        if (spec.provider === 'openai' && this.openAiProvider) return await this.openAiProvider.generateImage(req, spec.modelId);
        if (spec.provider === 'google' && this.geminiProvider)  return await this.geminiProvider.generateImage(req, spec.modelId);
      } catch (err) {
        this.logger.warn(`Image provider ${key} failed: ${(err as Error).message}`);
      }
    }
    throw new Error('No image provider available');
  }

  async generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    if (!this.geminiProvider) throw new Error('Video generation requires GEMINI_API_KEY');
    const classification = classifyPrompt(req.prompt);
    const keys = resolveModelCandidates('video', classification.complexity, 'chat');
    const modelKey = keys[0] ?? 'veo-3';
    const spec = MODEL_REGISTRY[modelKey];
    if (!spec) throw new Error(`Video model ${modelKey} not found`);
    return this.geminiProvider.generateVideo(req, spec.modelId);
  }

  async processAudio(req: AudioRequest): Promise<AudioResponse> {
    if (req.type === 'transcribe') {
      if (this.openAiProvider) return this.openAiProvider.processAudio(req);
      if (this.geminiProvider)  return this.geminiProvider.processAudio(req);
      throw new Error('Transcription requires OPENAI_API_KEY or GEMINI_API_KEY');
    }
    if (this.openAiProvider) return this.openAiProvider.processAudio(req);
    throw new Error('TTS requires OPENAI_API_KEY');
  }

  classify(prompt: string, systemPrompt?: string): ClassificationResult {
    return classifyPrompt(prompt, systemPrompt);
  }

  getMetrics() {
    return this.costTracker.getModelMetrics();
  }

  getAvailableProviders(): LlmProvider[] {
    return [...this.textProviders.keys()];
  }

  async getProvidersHealth() {
    return this.providerHealth.getAll();
  }

  // ─── Execution helpers ────────────────────────────────────────────────────────

  private async executeAdapter(
    provider: string,
    modelId: string,
    req: ProductionRouteRequest,
  ): Promise<NormalizedLlmResponse> {
    const adapter = this.adapterFactory.get(provider, modelId);
    if (!adapter) throw new Error(`No adapter for ${provider}/${modelId}`);

    return adapter.generateText({
      systemPrompt: req.systemPrompt ?? 'You are a helpful assistant.',
      userPrompt:   req.userPrompt,
      maxTokens:    2000,
      timeoutMs:    45_000,
    });
  }

  private async executeWithFallback(
    request: LlmRequest,
    candidates: ModelSpec[],
    enableFallback: boolean,
    decision?: RoutingAdvisorDecision,
    classification?: ClassificationResult,
  ): Promise<LlmResponse> {
    const attempts  = enableFallback ? candidates.slice(0, 3) : candidates.slice(0, 1);
    let lastError: unknown;

    for (const spec of attempts) {
      const provider = this.textProviders.get(spec.provider);
      if (!provider) continue;

      try {
        const response = await provider.generateText(request, spec);
        this.costTracker.recordModelSuccess(
          `${spec.provider}/${spec.modelId}`,
          { input: response.usage.inputTokens, output: response.usage.outputTokens },
          response.costUsd,
          response.latencyMs,
        );
        if (request.creditContext) {
          request.creditContext = this.costTracker.deductCredits(request.creditContext, response.costUsd);
        }
        response.classification    = classification;
        response.routingDecision   = decision;
        return response;
      } catch (err) {
        this.logger.warn(`${spec.displayName} failed: ${(err as Error).message}`);
        this.costTracker.recordModelFailure(`${spec.provider}/${spec.modelId}`);
        lastError = err;
        if (!enableFallback) break;
      }
    }

    throw new Error(`All providers failed. Last: ${(lastError as Error)?.message}`);
  }

  private pickFastModel(h: ClassificationResult, creditCtx?: CreditContext) {
    const candidates  = resolveModelCandidates(h.modality, h.complexity, h.taskType);
    const planTier    = creditCtx?.planTier ?? 'free';
    const PLAN_ORDER  = ['free', 'starter', 'pro', 'enterprise'];

    const key = candidates.find((k) => {
      const s = MODEL_REGISTRY[k];
      return s && this.textProviders.has(s.provider) &&
        PLAN_ORDER.indexOf(planTier) >= PLAN_ORDER.indexOf(s.minPlanTier);
    });
    if (!key) return undefined;
    const spec = MODEL_REGISTRY[key];
    return {
      spec,
      decision: {
        modality: h.modality, complexity: h.complexity, taskType: h.taskType,
        requiresWebSearch: h.requiresWebSearch,
        recommendedProvider: spec.provider, recommendedModelKey: key,
        reason: 'Fast-path heuristic', source: 'heuristic' as const,
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
      modality: h.modality, complexity: h.complexity, taskType: h.taskType,
      requiresWebSearch: h.requiresWebSearch,
      recommendedProvider: spec?.provider ?? 'google', recommendedModelKey: key,
      reason: `Heuristic: ${h.modality}:${h.complexity}:${h.taskType}`, source: 'heuristic',
    };
  }

  private buildCandidateList(primaryKey: string, matrixKeys: string[], creditCtx?: CreditContext): ModelSpec[] {
    const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise'];
    const planTier   = creditCtx?.planTier ?? 'free';
    const seen       = new Set<string>();
    const result: ModelSpec[] = [];

    for (const key of [primaryKey, ...matrixKeys.filter((k) => k !== primaryKey)]) {
      const spec = MODEL_REGISTRY[key];
      if (!spec || !this.textProviders.has(spec.provider) || seen.has(key)) continue;
      if (PLAN_ORDER.indexOf(planTier) < PLAN_ORDER.indexOf(spec.minPlanTier)) continue;
      seen.add(key);
      result.push(spec);
    }
    return result;
  }

  private getAvailableTiers(planTier: string): string[] {
    const plan = planTier.toUpperCase();
    if (plan === 'FREE')       return ['router', 'cheap'];
    if (plan === 'SOLO')       return ['router', 'cheap', 'standard'];
    if (plan === 'PRO')        return ['router', 'cheap', 'standard', 'premium'];
    if (plan === 'AGENCY')     return ['router', 'cheap', 'standard', 'premium', 'frontier'];
    return ['router', 'cheap', 'standard', 'premium', 'frontier', 'specialist'];
  }

  private emitEvent(event: string, payload: LlmRouterEventPayload): void {
    try {
      this.emitter.emit(event, payload);
      this.logger.debug(`[Event] ${event}: ${payload.status}`);
    } catch {
      // Non-critical — never let event emission crash the pipeline
    }
  }

  onRouterEvent(event: string, handler: (payload: LlmRouterEventPayload) => void): void {
    this.emitter.on(event, handler);
  }

  // ─── Provider initialisation ──────────────────────────────────────────────────

  private initProviders(): void {
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      this.textProviders.set('anthropic', new AnthropicProvider(anthropicKey));
      this.logger.log('✅ Anthropic ready');
    }

    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      const p = new OpenAiProvider(openaiKey);
      this.textProviders.set('openai', p);
      this.openAiProvider = p;
      this.logger.log('✅ OpenAI ready');
    }

    const geminiKey = this.config.get<string>('GEMINI_API_KEY');
    if (geminiKey) {
      const p = new GeminiProvider(geminiKey);
      this.textProviders.set('google', p);
      this.geminiProvider = p;
      this.logger.log('✅ Google ready');
    }

    const xaiKey = this.config.get<string>('XAI_API_KEY');
    if (xaiKey) {
      this.textProviders.set('xai', new XAiProvider(xaiKey));
      this.logger.log('✅ xAI ready');
    }

    const groqKey = this.config.get<string>('GROQ_API_KEY');
    if (groqKey) {
      this.textProviders.set('meta', new MetaProvider(groqKey));
      this.logger.log('✅ Meta ready');
    }

    const perplexityKey = this.config.get<string>('PERPLEXITY_API_KEY');
    if (perplexityKey) {
      this.textProviders.set('perplexity', new PerplexityProvider(perplexityKey));
      this.logger.log('✅ Perplexity ready');
    }

    if (this.textProviders.size === 0) {
      this.logger.warn('⚠️  No providers configured');
      return;
    }

    this.advisor = this.buildAdvisor();
    this.logger.log(`🧠 LLM Router ready: ${this.textProviders.size} providers`);
  }

  private buildAdvisor(): RoutingAdvisor {
    const available  = new Set(this.textProviders.keys());
    const advisorOrder: Array<[LlmProvider, string]> = [
      ['google',    'gemini-2.0-flash'],
      ['openai',    'gpt-4o-mini'],
      ['anthropic', 'claude-haiku-4-5'],
      ['xai',       'grok-3-mini'],
      ['meta',      'llama-4-maverick'],
    ];

    const [chosenProvider, chosenKey] =
      advisorOrder.find(([p]) => this.textProviders.has(p)) ?? [undefined, undefined];

    if (!chosenProvider || !chosenKey) {
      return new RoutingAdvisor(async () => '', available);
    }

    const spec = MODEL_REGISTRY[chosenKey];
    const provider = this.textProviders.get(chosenProvider)!;

    return new RoutingAdvisor(
      async (prompt: string, systemPrompt: string): Promise<string> => {
        const resp = await provider.generateText(
          { systemPrompt, messages: [{ role: 'user', content: prompt }], maxTokens: 512, temperature: 0.1 },
          spec,
        );
        return resp.content;
      },
      available,
    );
  }
}
