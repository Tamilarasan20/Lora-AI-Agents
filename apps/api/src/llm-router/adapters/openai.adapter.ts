import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod';
import {
  LlmProviderAdapter, LlmTextRequest, LlmStructuredRequest,
  LlmImageRequest, NormalizedLlmResponse, ProviderHealthResult, ProviderError,
} from './llm-provider.interface';

export class OpenAiAdapter implements LlmProviderAdapter {
  readonly provider = 'openai';
  private readonly logger = new Logger(OpenAiAdapter.name);
  private readonly client: OpenAI;

  constructor(apiKey: string, private readonly modelId: string) {
    this.client = new OpenAI({ apiKey });
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
        max_tokens:  input.maxTokens  ?? 2000,
        temperature: input.temperature ?? 0.7,
      }, { timeout: input.timeoutMs ?? 45_000 });

      const choice   = completion.choices[0];
      const usage    = completion.usage;
      const latencyMs = Date.now() - start;
      const inputTokens  = usage?.prompt_tokens ?? 0;
      const outputTokens = usage?.completion_tokens ?? 0;
      const costUsd = (inputTokens / 1e6) * 2.50 + (outputTokens / 1e6) * 10.00;

      return {
        text:      choice.message.content ?? '',
        provider:  this.provider,
        modelId:   this.modelId,
        latencyMs,
        costUsd,
        stopReason: choice.finish_reason ?? 'end_turn',
        usage:     { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
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

  async generateImage(input: LlmImageRequest): Promise<NormalizedLlmResponse> {
    const start = Date.now();
    try {
      const size = this.mapSize(input.width, input.height);
      const response = await this.client.images.generate({
        model: 'dall-e-3',
        prompt: input.prompt.slice(0, 4000),
        n: 1, size,
        response_format: 'url',
        quality: input.quality ?? 'standard',
      });
      return {
        assets:   [{ type: 'image', url: response.data?.[0]?.url ?? '' }],
        provider: this.provider,
        modelId:  'dall-e-3',
        latencyMs: Date.now() - start,
        costUsd:  input.quality === 'hd' ? 0.080 : 0.040,
      };
    } catch (err: any) {
      throw this.wrapError(err);
    }
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    const start = Date.now();
    try {
      await this.client.models.list();
      return { provider: this.provider, healthy: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { provider: this.provider, healthy: false, error: err.message };
    }
  }

  private mapSize(w?: number, h?: number): '1024x1024' | '1792x1024' | '1024x1792' {
    if (!w || !h) return '1024x1024';
    if (w > h) return '1792x1024';
    if (h > w) return '1024x1792';
    return '1024x1024';
  }

  private wrapError(err: any): ProviderError {
    const status = err?.status ?? err?.response?.status ?? 500;
    if (status === 401) return new ProviderError(err.message, 'INVALID_API_KEY', this.provider, false);
    if (status === 429) return new ProviderError(err.message, 'PROVIDER_RATE_LIMIT', this.provider, true);
    if (status >= 500) return new ProviderError(err.message, 'PROVIDER_SERVER_ERROR', this.provider, true);
    return new ProviderError(err.message, 'PROVIDER_ERROR', this.provider, false);
  }
}
