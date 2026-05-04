import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod';
import {
  LlmProviderAdapter, LlmTextRequest, LlmStructuredRequest,
  LlmImageRequest, NormalizedLlmResponse, ProviderHealthResult, ProviderError,
} from './llm-provider.interface';

const PERPLEXITY_BASE_URL = 'https://api.perplexity.ai';

export class PerplexityAdapter implements LlmProviderAdapter {
  readonly provider = 'perplexity';
  private readonly logger = new Logger(PerplexityAdapter.name);
  private readonly client: OpenAI;

  constructor(apiKey: string, private readonly modelId: string) {
    this.client = new OpenAI({ apiKey, baseURL: PERPLEXITY_BASE_URL });
  }

  async generateText(input: LlmTextRequest): Promise<NormalizedLlmResponse> {
    const start = Date.now();
    try {
      const completion = await this.client.chat.completions.create({
        model: this.modelId,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user',   content: input.userPrompt },
        ],
        max_tokens:  input.maxTokens  ?? 4096,
        temperature: input.temperature ?? 0.2,
      }, { timeout: input.timeoutMs ?? 45_000 });

      const choice       = completion.choices[0];
      const usage        = completion.usage;
      const latencyMs    = Date.now() - start;
      const inputTokens  = usage?.prompt_tokens ?? 0;
      const outputTokens = usage?.completion_tokens ?? 0;
      const citations: string[] = (completion as any).citations ?? [];
      const costUsd = (inputTokens / 1e6) * 1.00 + (outputTokens / 1e6) * 1.00;

      return {
        text:      choice.message.content ?? '',
        citations: citations.length ? citations : undefined,
        provider:  this.provider,
        modelId:   this.modelId,
        latencyMs,
        costUsd,
        stopReason: 'end_turn',
        usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      };
    } catch (err: any) {
      throw this.wrapError(err);
    }
  }

  async generateStructured<T>(input: LlmStructuredRequest, schema: z.ZodSchema<T>): Promise<T> {
    const response = await this.generateText({ ...input, temperature: 0 });
    const raw = response.text ?? '';
    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
      return schema.parse(JSON.parse(jsonStr));
    } catch {
      throw new ProviderError('Structured output validation failed', 'INVALID_REQUEST', this.provider, false);
    }
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    const start = Date.now();
    try {
      await this.client.chat.completions.create({
        model: this.modelId,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      });
      return { provider: this.provider, healthy: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { provider: this.provider, healthy: false, error: err.message };
    }
  }

  private wrapError(err: any): ProviderError {
    const status = err?.status ?? err?.response?.status ?? 500;
    if (status === 401) return new ProviderError(err.message, 'INVALID_API_KEY', this.provider, false);
    if (status === 429) return new ProviderError(err.message, 'PROVIDER_RATE_LIMIT', this.provider, true);
    if (status >= 500) return new ProviderError(err.message, 'PROVIDER_SERVER_ERROR', this.provider, true);
    return new ProviderError(err.message, 'PROVIDER_ERROR', this.provider, false);
  }
}
