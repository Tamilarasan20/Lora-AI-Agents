// ─── Provider catalogue ───────────────────────────────────────────────────────

export type LlmProvider = 'anthropic' | 'openai' | 'google' | 'xai' | 'meta';

export type TaskComplexity = 'simple' | 'medium' | 'complex';

// ─── Model registry ───────────────────────────────────────────────────────────

export interface ModelSpec {
  provider: LlmProvider;
  modelId: string;
  displayName: string;
  contextWindow: number;
  supportsTools: boolean;
  /** Input cost per 1M tokens in USD */
  inputCostPer1M: number;
  /** Output cost per 1M tokens in USD */
  outputCostPer1M: number;
  /** Typical latency bucket */
  latency: 'fast' | 'medium' | 'slow';
  /** Which complexity tiers this model is suited for */
  suitedFor: TaskComplexity[];
}

export const MODEL_REGISTRY: Record<string, ModelSpec> = {
  // ── Anthropic ──────────────────────────────────────────────────────────────
  'claude-haiku-4-5': {
    provider: 'anthropic',
    modelId: 'claude-haiku-4-5-20251001',
    displayName: 'Claude Haiku 4.5',
    contextWindow: 200_000,
    supportsTools: true,
    inputCostPer1M: 0.80,
    outputCostPer1M: 4.00,
    latency: 'fast',
    suitedFor: ['simple'],
  },
  'claude-sonnet-4-6': {
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    contextWindow: 200_000,
    supportsTools: true,
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    latency: 'medium',
    suitedFor: ['simple', 'medium'],
  },
  'claude-opus-4-7': {
    provider: 'anthropic',
    modelId: 'claude-opus-4-7',
    displayName: 'Claude Opus 4.7',
    contextWindow: 200_000,
    supportsTools: true,
    inputCostPer1M: 15.00,
    outputCostPer1M: 75.00,
    latency: 'slow',
    suitedFor: ['simple', 'medium', 'complex'],
  },

  // ── OpenAI ─────────────────────────────────────────────────────────────────
  'gpt-4o-mini': {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    contextWindow: 128_000,
    supportsTools: true,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
    latency: 'fast',
    suitedFor: ['simple'],
  },
  'gpt-4o': {
    provider: 'openai',
    modelId: 'gpt-4o',
    displayName: 'GPT-4o',
    contextWindow: 128_000,
    supportsTools: true,
    inputCostPer1M: 2.50,
    outputCostPer1M: 10.00,
    latency: 'medium',
    suitedFor: ['simple', 'medium', 'complex'],
  },
  'o3-mini': {
    provider: 'openai',
    modelId: 'o3-mini',
    displayName: 'o3-mini (reasoning)',
    contextWindow: 200_000,
    supportsTools: true,
    inputCostPer1M: 1.10,
    outputCostPer1M: 4.40,
    latency: 'medium',
    suitedFor: ['medium', 'complex'],
  },

  // ── Google Gemini ──────────────────────────────────────────────────────────
  'gemini-2.0-flash': {
    provider: 'google',
    modelId: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    contextWindow: 1_000_000,
    supportsTools: true,
    inputCostPer1M: 0.10,
    outputCostPer1M: 0.40,
    latency: 'fast',
    suitedFor: ['simple', 'medium'],
  },
  'gemini-2.5-pro': {
    provider: 'google',
    modelId: 'gemini-2.5-pro-preview-05-06',
    displayName: 'Gemini 2.5 Pro',
    contextWindow: 1_000_000,
    supportsTools: true,
    inputCostPer1M: 1.25,
    outputCostPer1M: 10.00,
    latency: 'medium',
    suitedFor: ['medium', 'complex'],
  },

  // ── xAI Grok ──────────────────────────────────────────────────────────────
  'grok-3-mini': {
    provider: 'xai',
    modelId: 'grok-3-mini',
    displayName: 'Grok 3 Mini',
    contextWindow: 131_072,
    supportsTools: true,
    inputCostPer1M: 0.30,
    outputCostPer1M: 0.50,
    latency: 'fast',
    suitedFor: ['simple', 'medium'],
  },
  'grok-3': {
    provider: 'xai',
    modelId: 'grok-3',
    displayName: 'Grok 3',
    contextWindow: 131_072,
    supportsTools: true,
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    latency: 'medium',
    suitedFor: ['medium', 'complex'],
  },

  // ── Meta Llama (via Groq — fastest inference) ──────────────────────────────
  'llama-3.3-70b': {
    provider: 'meta',
    modelId: 'llama-3.3-70b-versatile',
    displayName: 'Llama 3.3 70B',
    contextWindow: 128_000,
    supportsTools: true,
    inputCostPer1M: 0.59,
    outputCostPer1M: 0.79,
    latency: 'fast',
    suitedFor: ['simple', 'medium'],
  },
  'llama-4-maverick': {
    provider: 'meta',
    modelId: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    displayName: 'Llama 4 Maverick',
    contextWindow: 524_288,
    supportsTools: true,
    inputCostPer1M: 0.20,
    outputCostPer1M: 0.60,
    latency: 'fast',
    suitedFor: ['simple', 'medium'],
  },
};

// ─── Routing strategy ─────────────────────────────────────────────────────────

export type RoutingStrategy =
  | 'cost'        // cheapest model that can handle the task
  | 'performance' // best model for the task regardless of cost
  | 'balanced'    // best cost/quality trade-off
  | 'latency'     // fastest response time
  | 'round_robin' // distribute load across providers
  | 'fallback';   // primary + fallback chain

export interface RoutingConfig {
  strategy: RoutingStrategy;
  /** Preferred providers in priority order (empty = all providers) */
  preferredProviders?: LlmProvider[];
  /** Providers to never use for this task */
  excludedProviders?: LlmProvider[];
  /** Force a specific model key (overrides all routing) */
  forceModel?: string;
  /** Enable automatic fallback if primary call fails */
  enableFallback?: boolean;
}

// ─── Task type → complexity mapping ──────────────────────────────────────────

export const TASK_COMPLEXITY_MAP: Record<string, TaskComplexity> = {
  // Simple — short, structured, no deep reasoning
  'clara-adapt-platform':       'simple',
  'generate_hashtags':          'simple',
  'analyze_brand_voice':        'simple',
  'check_posting_cadence':      'simple',
  'draft_reply':                'simple',
  'translate_caption':          'simple',

  // Medium — context-aware, moderate reasoning
  'get_optimal_posting_time':   'medium',
  'sarah-process-engagement':   'medium',
  'mark-analyze-trends':        'medium',
  'flag_escalation':            'medium',
  'plan_one_post':              'medium',
  'sentiment_analysis':         'medium',

  // Complex — multi-step, long output, tool chains
  'clara-generate-content':     'complex',
  'mark-generate-report':       'complex',
  'plan_content_calendar':      'complex',
  'full_brand_audit':           'complex',
  'competitor_analysis':        'complex',
};

// ─── Unified message/response format ─────────────────────────────────────────

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
}

export interface LlmToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}
