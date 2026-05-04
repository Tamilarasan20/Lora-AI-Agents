import { z } from 'zod';

export interface LlmTextRequest {
  systemPrompt:  string;
  userPrompt:    string;
  maxTokens?:    number;
  temperature?:  number;
  tools?:        LlmToolDef[];
  timeoutMs?:    number;
}

export interface LlmStructuredRequest extends LlmTextRequest {
  jsonMode?: boolean;
}

export interface LlmImageRequest {
  prompt:    string;
  negativePrompt?: string;
  width?:    number;
  height?:   number;
  count?:    number;
  quality?:  'standard' | 'hd';
}

export interface LlmVideoRequest {
  prompt:          string;
  imageUrl?:       string;
  durationSeconds?: number;
  aspectRatio?:    '16:9' | '9:16' | '1:1';
}

export interface LlmToolDef {
  name:        string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface NormalizedLlmResponse {
  text?:    string;
  json?:    unknown;
  assets?:  Array<{
    type:             'image' | 'video' | 'audio';
    url?:             string;
    storageKey?:      string;
    providerAssetId?: string;
  }>;
  toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  usage?: {
    inputTokens?:  number;
    outputTokens?: number;
    totalTokens?:  number;
  };
  provider:  string;
  modelId:   string;
  latencyMs: number;
  costUsd:   number;
  stopReason?: string;
  citations?: string[];
}

export interface ProviderHealthResult {
  provider:   string;
  healthy:    boolean;
  latencyMs?: number;
  error?:     string;
}

export interface LlmProviderAdapter {
  readonly provider: string;

  generateText(input: LlmTextRequest): Promise<NormalizedLlmResponse>;

  generateStructured<T>(
    input: LlmStructuredRequest,
    schema: z.ZodSchema<T>,
  ): Promise<T>;

  generateImage?(input: LlmImageRequest): Promise<NormalizedLlmResponse>;

  generateVideo?(input: LlmVideoRequest): Promise<NormalizedLlmResponse>;

  healthCheck(): Promise<ProviderHealthResult>;
}

// Retryable vs non-retryable error classification
export const RETRYABLE_ERROR_CODES = new Set([
  'PROVIDER_TIMEOUT',
  'PROVIDER_RATE_LIMIT',
  'PROVIDER_SERVER_ERROR',
  'PROVIDER_OVERLOADED',
  'NETWORK_ERROR',
]);

export const NON_RETRYABLE_ERROR_CODES = new Set([
  'INVALID_API_KEY',
  'UNSUPPORTED_MODALITY',
  'INSUFFICIENT_CREDITS',
  'POLICY_BLOCKED',
  'INVALID_REQUEST',
  'MODEL_DEPRECATED',
]);

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
