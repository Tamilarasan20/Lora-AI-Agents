import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  LlmProviderAdapter, LlmTextRequest, LlmStructuredRequest,
  LlmImageRequest, NormalizedLlmResponse, ProviderHealthResult, ProviderError,
} from './llm-provider.interface';

export class AnthropicAdapter implements LlmProviderAdapter {
  readonly provider = 'anthropic';
  private readonly logger = new Logger(AnthropicAdapter.name);
  private readonly client: Anthropic;

  constructor(apiKey: string, private readonly modelId: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateText(input: LlmTextRequest): Promise<NormalizedLlmResponse> {
    const start = Date.now();
    try {
      const response = await this.client.messages.create({
        model: this.modelId,
        max_tokens: input.maxTokens ?? 4096,
        temperature: input.temperature ?? 0.7,
        system: input.systemPrompt,
        messages: [{ role: 'user', content: input.userPrompt }],
        ...(input.tools?.length ? {
          tools: input.tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: { type: 'object' as const, ...t.inputSchema },
          })),
        } : {}),
      });

      const latencyMs = Date.now() - start;
      const inputTokens  = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;

      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('\n');

      const toolCalls = response.content
        .filter((b) => b.type === 'tool_use')
        .map((b) => {
          const t = b as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
          return { id: t.id, name: t.name, input: t.input };
        });

      const costUsd =
        (inputTokens / 1e6) * this.inputPrice() +
        (outputTokens / 1e6) * this.outputPrice();

      return {
        text,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        provider: this.provider,
        modelId: this.modelId,
        latencyMs,
        costUsd,
        stopReason: response.stop_reason === 'tool_use' ? 'tool_use'
          : response.stop_reason === 'max_tokens' ? 'max_tokens'
          : 'end_turn',
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
      await this.client.messages.create({
        model: this.modelId,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return { provider: this.provider, healthy: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      const isAuthErr = err?.status === 401;
      return { provider: this.provider, healthy: !isAuthErr, error: err.message };
    }
  }

  private inputPrice(): number {
    if (this.modelId.includes('opus'))   return 15.00;
    if (this.modelId.includes('sonnet')) return  3.00;
    return 0.80; // haiku
  }

  private outputPrice(): number {
    if (this.modelId.includes('opus'))   return 75.00;
    if (this.modelId.includes('sonnet')) return 15.00;
    return 4.00; // haiku
  }

  private wrapError(err: any): ProviderError {
    const status = err?.status ?? err?.response?.status ?? 500;
    if (status === 401) return new ProviderError(err.message, 'INVALID_API_KEY', this.provider, false);
    if (status === 429) return new ProviderError(err.message, 'PROVIDER_RATE_LIMIT', this.provider, true);
    if (status === 529) return new ProviderError(err.message, 'PROVIDER_OVERLOADED', this.provider, true);
    if (status >= 500) return new ProviderError(err.message, 'PROVIDER_SERVER_ERROR', this.provider, true);
    return new ProviderError(err.message, 'PROVIDER_ERROR', this.provider, false);
  }
}
