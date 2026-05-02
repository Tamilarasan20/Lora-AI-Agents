import OpenAI from 'openai';
import { LlmRequest, LlmResponse, ModelSpec } from '../llm-router.types';

const PERPLEXITY_BASE_URL = 'https://api.perplexity.ai';

/**
 * Perplexity provider — search-augmented LLM responses.
 * Uses OpenAI-compatible API with special citation metadata in responses.
 * Activate for research, real-time data, news, and web-search tasks.
 */
export class PerplexityProvider {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: PERPLEXITY_BASE_URL,
    });
  }

  async generateText(request: LlmRequest, spec: ModelSpec): Promise<LlmResponse> {
    const start = Date.now();

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: request.systemPrompt },
      ...request.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : this.flattenContent(m.content),
      })),
    ];

    const response = await this.client.chat.completions.create({
      model: spec.modelId,
      messages,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.2, // lower temp for factual/research tasks
    });

    const latencyMs = Date.now() - start;
    const choice = response.choices[0];
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;

    // Perplexity returns citations in the response object (non-standard field)
    const citations: string[] = (response as any).citations ?? [];

    return {
      content: choice.message.content ?? '',
      stopReason: 'end_turn',
      usage: { inputTokens, outputTokens },
      model: spec.modelId,
      provider: 'perplexity',
      latencyMs,
      costUsd: this.calcCost(spec, inputTokens, outputTokens),
      citations: citations.length ? citations : undefined,
    };
  }

  /** Backward-compat alias */
  async call(request: LlmRequest, spec: ModelSpec): Promise<LlmResponse> {
    return this.generateText(request, spec);
  }

  private flattenContent(blocks: unknown[]): string {
    return (blocks as Array<{ text?: string }>)
      .filter((b) => b.text)
      .map((b) => b.text)
      .join('\n');
  }

  private calcCost(spec: ModelSpec, input: number, output: number): number {
    return (input / 1_000_000) * spec.inputCostPer1M +
           (output / 1_000_000) * spec.outputCostPer1M;
  }
}
