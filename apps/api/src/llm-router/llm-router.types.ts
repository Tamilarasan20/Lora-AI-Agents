// ─── Provider catalogue (STRICT: only these 6 providers) ─────────────────────
export type LlmProvider = 'anthropic' | 'openai' | 'google' | 'xai' | 'meta' | 'perplexity';

// ─── Modality ─────────────────────────────────────────────────────────────────
export type ModalityType = 'text' | 'image' | 'video' | 'audio';

// ─── Complexity tiers ─────────────────────────────────────────────────────────
export type ComplexityTier = 'low' | 'medium' | 'high';

// ─── Task categories ──────────────────────────────────────────────────────────
export type TaskCategory = 'coding' | 'analysis' | 'creative' | 'chat' | 'research';

// ─── User plan tiers ──────────────────────────────────────────────────────────
export type UserPlanTier = 'free' | 'starter' | 'pro' | 'enterprise';

// ─── Routing strategies ───────────────────────────────────────────────────────
export type RoutingStrategy = 'cost' | 'speed' | 'quality' | 'balanced';

// ─── Legacy alias kept for backward-compat with agent code ───────────────────
export type TaskComplexity = 'simple' | 'medium' | 'complex';

// ─── Classification result ────────────────────────────────────────────────────
export interface ClassificationResult {
  modality: ModalityType;
  complexity: ComplexityTier;
  taskType: TaskCategory;
  confidence: number;
  requiresWebSearch: boolean;
  estimatedTokens: number;
  signals: {
    highSignals: number;
    lowSignals: number;
    structuralScore: number;
    tokenTier: 'short' | 'medium' | 'long' | 'huge';
  };
}

// ─── Routing advisor decision ─────────────────────────────────────────────────
export interface RoutingAdvisorDecision {
  modality: ModalityType;
  complexity: ComplexityTier;
  taskType: TaskCategory;
  requiresWebSearch: boolean;
  recommendedProvider: LlmProvider;
  recommendedModelKey: string;
  reason: string;
  source: 'heuristic' | 'llm_advisor';
}

// ─── Credit context ───────────────────────────────────────────────────────────
export interface CreditContext {
  userId: string;
  planTier: UserPlanTier;
  creditsRemainingCents: number;
  monthlyTokensUsed: number;
}

// ─── Model spec ───────────────────────────────────────────────────────────────
export interface ModelSpec {
  provider: LlmProvider;
  modelId: string;
  displayName: string;
  modality: ModalityType;
  maxContextTokens: number;
  supportsTools: boolean;
  inputCostPer1M: number;
  outputCostPer1M: number;
  latency: 'fast' | 'medium' | 'slow';
  minPlanTier: UserPlanTier;
  capabilities: TaskCategory[];
  /** @deprecated use capabilities */
  suitedFor?: TaskComplexity[];
}

// ─── MODEL REGISTRY ───────────────────────────────────────────────────────────
export const MODEL_REGISTRY: Record<string, ModelSpec> = {

  // ── Anthropic ─────────────────────────────────────────────────────────────
  'claude-haiku-4-5': {
    provider: 'anthropic', modality: 'text',
    modelId: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5',
    maxContextTokens: 200_000, supportsTools: true,
    inputCostPer1M: 0.80, outputCostPer1M: 4.00, latency: 'fast',
    minPlanTier: 'free', capabilities: ['chat', 'coding', 'analysis'],
  },
  'claude-sonnet-4-6': {
    provider: 'anthropic', modality: 'text',
    modelId: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6',
    maxContextTokens: 200_000, supportsTools: true,
    inputCostPer1M: 3.00, outputCostPer1M: 15.00, latency: 'medium',
    minPlanTier: 'starter', capabilities: ['chat', 'coding', 'analysis', 'creative'],
  },
  'claude-opus-4-7': {
    provider: 'anthropic', modality: 'text',
    modelId: 'claude-opus-4-7', displayName: 'Claude Opus 4.7',
    maxContextTokens: 200_000, supportsTools: true,
    inputCostPer1M: 15.00, outputCostPer1M: 75.00, latency: 'slow',
    minPlanTier: 'pro', capabilities: ['chat', 'coding', 'analysis', 'creative', 'research'],
  },

  // ── OpenAI — Text ─────────────────────────────────────────────────────────
  'gpt-4o-mini': {
    provider: 'openai', modality: 'text',
    modelId: 'gpt-4o-mini', displayName: 'GPT-4o Mini',
    maxContextTokens: 128_000, supportsTools: true,
    inputCostPer1M: 0.15, outputCostPer1M: 0.60, latency: 'fast',
    minPlanTier: 'free', capabilities: ['chat', 'coding', 'creative'],
  },
  'gpt-4.1': {
    provider: 'openai', modality: 'text',
    modelId: 'gpt-4.1', displayName: 'GPT-4.1',
    maxContextTokens: 1_000_000, supportsTools: true,
    inputCostPer1M: 2.00, outputCostPer1M: 8.00, latency: 'medium',
    minPlanTier: 'starter', capabilities: ['chat', 'coding', 'analysis', 'creative'],
  },
  'gpt-4o': {
    provider: 'openai', modality: 'text',
    modelId: 'gpt-4o', displayName: 'GPT-4o',
    maxContextTokens: 128_000, supportsTools: true,
    inputCostPer1M: 2.50, outputCostPer1M: 10.00, latency: 'medium',
    minPlanTier: 'starter', capabilities: ['chat', 'coding', 'analysis', 'creative'],
  },
  'o3-mini': {
    provider: 'openai', modality: 'text',
    modelId: 'o3-mini', displayName: 'o3-mini',
    maxContextTokens: 200_000, supportsTools: true,
    inputCostPer1M: 1.10, outputCostPer1M: 4.40, latency: 'medium',
    minPlanTier: 'pro', capabilities: ['coding', 'analysis'],
  },

  // ── OpenAI — Image ────────────────────────────────────────────────────────
  'dall-e-2': {
    provider: 'openai', modality: 'image',
    modelId: 'dall-e-2', displayName: 'DALL-E 2',
    maxContextTokens: 0, supportsTools: false,
    inputCostPer1M: 0, outputCostPer1M: 0, latency: 'fast',
    minPlanTier: 'free', capabilities: [],
  },
  'dall-e-3': {
    provider: 'openai', modality: 'image',
    modelId: 'dall-e-3', displayName: 'DALL-E 3',
    maxContextTokens: 0, supportsTools: false,
    inputCostPer1M: 0, outputCostPer1M: 0, latency: 'medium',
    minPlanTier: 'starter', capabilities: [],
  },

  // ── OpenAI — Audio ────────────────────────────────────────────────────────
  'whisper-1': {
    provider: 'openai', modality: 'audio',
    modelId: 'whisper-1', displayName: 'Whisper v1',
    maxContextTokens: 0, supportsTools: false,
    inputCostPer1M: 6.00, outputCostPer1M: 0, latency: 'fast',
    minPlanTier: 'free', capabilities: [],
  },
  'openai-tts': {
    provider: 'openai', modality: 'audio',
    modelId: 'tts-1', displayName: 'OpenAI TTS',
    maxContextTokens: 0, supportsTools: false,
    inputCostPer1M: 15.00, outputCostPer1M: 0, latency: 'fast',
    minPlanTier: 'starter', capabilities: [],
  },

  // ── Google Gemini — Text ──────────────────────────────────────────────────
  'gemini-2.0-flash': {
    provider: 'google', modality: 'text',
    modelId: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash',
    maxContextTokens: 1_000_000, supportsTools: true,
    inputCostPer1M: 0.10, outputCostPer1M: 0.40, latency: 'fast',
    minPlanTier: 'free', capabilities: ['chat', 'analysis', 'creative'],
  },
  'gemini-2.5-pro': {
    provider: 'google', modality: 'text',
    modelId: 'gemini-2.5-pro-preview-05-06', displayName: 'Gemini 2.5 Pro',
    maxContextTokens: 1_000_000, supportsTools: true,
    inputCostPer1M: 1.25, outputCostPer1M: 10.00, latency: 'medium',
    minPlanTier: 'starter', capabilities: ['chat', 'coding', 'analysis', 'creative', 'research'],
  },

  // ── Google — Image ────────────────────────────────────────────────────────
  'gemini-imagen': {
    provider: 'google', modality: 'image',
    modelId: 'imagen-3.0-generate-002', displayName: 'Imagen 3',
    maxContextTokens: 0, supportsTools: false,
    inputCostPer1M: 0, outputCostPer1M: 0, latency: 'medium',
    minPlanTier: 'free', capabilities: [],
  },

  // ── Google — Video (Veo 3) ────────────────────────────────────────────────
  'veo-3': {
    provider: 'google', modality: 'video',
    modelId: 'veo-3.0-generate-preview', displayName: 'Veo 3',
    maxContextTokens: 0, supportsTools: false,
    inputCostPer1M: 0, outputCostPer1M: 0, latency: 'slow',
    minPlanTier: 'pro', capabilities: [],
  },

  // ── xAI Grok ──────────────────────────────────────────────────────────────
  'grok-3-mini': {
    provider: 'xai', modality: 'text',
    modelId: 'grok-3-mini', displayName: 'Grok 3 Mini',
    maxContextTokens: 131_072, supportsTools: true,
    inputCostPer1M: 0.30, outputCostPer1M: 0.50, latency: 'fast',
    minPlanTier: 'free', capabilities: ['chat', 'creative'],
  },
  'grok-3': {
    provider: 'xai', modality: 'text',
    modelId: 'grok-3', displayName: 'Grok 3',
    maxContextTokens: 131_072, supportsTools: true,
    inputCostPer1M: 3.00, outputCostPer1M: 15.00, latency: 'medium',
    minPlanTier: 'starter', capabilities: ['chat', 'analysis', 'creative', 'research'],
  },

  // ── Meta / Groq ───────────────────────────────────────────────────────────
  'llama-3.3-70b': {
    provider: 'meta', modality: 'text',
    modelId: 'llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B',
    maxContextTokens: 128_000, supportsTools: true,
    inputCostPer1M: 0.59, outputCostPer1M: 0.79, latency: 'fast',
    minPlanTier: 'free', capabilities: ['chat', 'coding', 'analysis'],
  },
  'llama-4-maverick': {
    provider: 'meta', modality: 'text',
    modelId: 'meta-llama/llama-4-maverick-17b-128e-instruct', displayName: 'Llama 4 Maverick',
    maxContextTokens: 524_288, supportsTools: true,
    inputCostPer1M: 0.20, outputCostPer1M: 0.60, latency: 'fast',
    minPlanTier: 'free', capabilities: ['chat', 'analysis', 'creative'],
  },

  // ── Perplexity (search-augmented) ─────────────────────────────────────────
  'perplexity-sonar': {
    provider: 'perplexity', modality: 'text',
    modelId: 'sonar', displayName: 'Perplexity Sonar',
    maxContextTokens: 127_000, supportsTools: false,
    inputCostPer1M: 1.00, outputCostPer1M: 1.00, latency: 'fast',
    minPlanTier: 'starter', capabilities: ['research', 'chat'],
  },
  'perplexity-sonar-pro': {
    provider: 'perplexity', modality: 'text',
    modelId: 'sonar-pro', displayName: 'Perplexity Sonar Pro',
    maxContextTokens: 200_000, supportsTools: false,
    inputCostPer1M: 3.00, outputCostPer1M: 15.00, latency: 'medium',
    minPlanTier: 'pro', capabilities: ['research', 'analysis'],
  },
  'perplexity-sonar-reasoning': {
    provider: 'perplexity', modality: 'text',
    modelId: 'sonar-reasoning', displayName: 'Perplexity Sonar Reasoning',
    maxContextTokens: 127_000, supportsTools: false,
    inputCostPer1M: 1.00, outputCostPer1M: 5.00, latency: 'medium',
    minPlanTier: 'pro', capabilities: ['research', 'analysis'],
  },
};

// ─── Routing config ───────────────────────────────────────────────────────────
export interface RoutingConfig {
  strategy?: RoutingStrategy;
  preferredProviders?: LlmProvider[];
  excludedProviders?: LlmProvider[];
  forceModel?: string;
  enableFallback?: boolean;
}

// ─── Legacy task complexity map (kept for agent backward-compat) ──────────────
export const TASK_COMPLEXITY_MAP: Record<string, TaskComplexity> = {
  'clara-adapt-platform':     'simple',
  'generate_hashtags':        'simple',
  'analyze_brand_voice':      'simple',
  'check_posting_cadence':    'simple',
  'draft_reply':              'simple',
  'translate_caption':        'simple',
  'get_optimal_posting_time': 'medium',
  'sarah-process-engagement': 'medium',
  'mark-analyze-trends':      'medium',
  'flag_escalation':          'medium',
  'plan_one_post':            'medium',
  'sentiment_analysis':       'medium',
  'clara-generate-content':   'complex',
  'mark-generate-report':     'complex',
  'plan_content_calendar':    'complex',
  'full_brand_audit':         'complex',
  'competitor_analysis':      'complex',
};

// ─── Request / Response ───────────────────────────────────────────────────────

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string | LlmContentBlock[];
}

export interface LlmContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  toolName?: string;
  toolUseId?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
  isError?: boolean;
}

export interface LlmTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface LlmRequest {
  systemPrompt: string;
  messages: LlmMessage[];
  tools?: LlmTool[];
  maxTokens?: number;
  temperature?: number;
  taskType?: string;
  routing?: RoutingConfig;
  creditContext?: CreditContext;
}

export interface LlmResponse {
  content: string;
  toolCalls?: LlmToolCall[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'error';
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  provider: LlmProvider;
  latencyMs: number;
  costUsd: number;
  classification?: ClassificationResult;
  routingDecision?: RoutingAdvisorDecision;
  citations?: string[];
}

export interface LlmToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// ─── Media generation ─────────────────────────────────────────────────────────

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  quality?: 'standard' | 'hd';
  style?: string;
  routing?: RoutingConfig;
  creditContext?: CreditContext;
}

export interface ImageGenerationResponse {
  url: string;
  model: string;
  provider: LlmProvider;
  latencyMs: number;
  costUsd: number;
}

export interface VideoGenerationRequest {
  prompt: string;
  imageUrl?: string;
  durationSeconds?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  routing?: RoutingConfig;
  creditContext?: CreditContext;
}

export interface VideoGenerationResponse {
  url: string;
  model: string;
  provider: LlmProvider;
  latencyMs: number;
  costUsd: number;
}

export interface AudioRequest {
  type: 'transcribe' | 'tts';
  audioUrl?: string;
  text?: string;
  voiceId?: string;
  routing?: RoutingConfig;
  creditContext?: CreditContext;
}

export interface AudioResponse {
  text?: string;
  audioUrl?: string;
  model: string;
  provider: LlmProvider;
  latencyMs: number;
  costUsd: number;
}
