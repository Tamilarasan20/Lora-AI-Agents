import { Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import {
  LlmProviderAdapter, LlmTextRequest, LlmStructuredRequest,
  LlmImageRequest, LlmVideoRequest, NormalizedLlmResponse,
  ProviderHealthResult, ProviderError,
} from './llm-provider.interface';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiAdapter implements LlmProviderAdapter {
  readonly provider = 'gemini';
  private readonly logger = new Logger(GeminiAdapter.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(private readonly apiKey: string, private readonly modelId: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateText(input: LlmTextRequest): Promise<NormalizedLlmResponse> {
    const start = Date.now();
    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelId });

      const tools = input.tools?.length
        ? [{
            functionDeclarations: input.tools.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: { type: 'OBJECT' as any, ...t.inputSchema },
            })),
          }] as any
        : undefined;

      const chat = model.startChat({
        systemInstruction: input.systemPrompt
          ? { role: 'user', parts: [{ text: input.systemPrompt }] }
          : undefined,
        tools,
        generationConfig: {
          maxOutputTokens: input.maxTokens ?? 4096,
          temperature: input.temperature ?? 0.7,
        },
      });

      const result = await chat.sendMessage(input.userPrompt);
      const response = result.response;
      const latencyMs = Date.now() - start;

      const text = response.candidates?.[0]?.content?.parts
        ?.filter((p) => 'text' in p)
        .map((p) => (p as { text: string }).text)
        .join('\n') ?? '';

      const toolCalls = response.candidates?.[0]?.content?.parts
        ?.filter((p) => 'functionCall' in p)
        .map((p) => {
          const fc = (p as { functionCall: { name: string; args: Record<string, unknown> } }).functionCall;
          return { id: `${fc.name}-${Date.now()}`, name: fc.name, input: fc.args };
        }) ?? [];

      const usage = response.usageMetadata;
      const inputTokens  = usage?.promptTokenCount ?? 0;
      const outputTokens = usage?.candidatesTokenCount ?? 0;
      const costUsd = (inputTokens / 1e6) * 0.075 + (outputTokens / 1e6) * 0.30;

      return {
        text,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        provider: this.provider,
        modelId: this.modelId,
        latencyMs,
        costUsd,
        stopReason: toolCalls.length ? 'tool_use' : 'end_turn',
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

  async generateImage(input: LlmImageRequest): Promise<NormalizedLlmResponse> {
    const start = Date.now();
    try {
      const modelId = 'imagen-3.0-generate-001';
      const res = await fetch(
        `${GEMINI_API_BASE}/models/${modelId}:predict?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: input.prompt.slice(0, 4000) }],
            parameters: { sampleCount: input.count ?? 1 },
          }),
        },
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Imagen generation failed: ${err}`);
      }

      const data = await res.json() as {
        predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
      };

      const assets = (data.predictions ?? []).map((p) => ({
        type: 'image' as const,
        url: `data:${p.mimeType ?? 'image/png'};base64,${p.bytesBase64Encoded ?? ''}`,
      }));

      return {
        assets,
        provider: this.provider,
        modelId,
        latencyMs: Date.now() - start,
        costUsd: 0.02 * (input.count ?? 1),
      };
    } catch (err: any) {
      throw this.wrapError(err);
    }
  }

  async generateVideo(input: LlmVideoRequest): Promise<NormalizedLlmResponse> {
    const start = Date.now();
    try {
      const modelId = 'veo-3.0-generate-preview';
      const submitRes = await fetch(
        `${GEMINI_API_BASE}/models/${modelId}:predictLongRunning?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{
              prompt: input.prompt,
              ...(input.imageUrl ? { image: { url: input.imageUrl } } : {}),
            }],
            parameters: {
              aspectRatio: input.aspectRatio ?? '16:9',
              durationSeconds: input.durationSeconds ?? 5,
            },
          }),
        },
      );

      if (!submitRes.ok) {
        const err = await submitRes.text();
        throw new Error(`Veo 3 submission failed: ${err}`);
      }

      const operation = await submitRes.json() as { name: string };
      const videoUrl = await this.pollVideoOperation(operation.name, 600_000);

      return {
        assets: [{ type: 'video', url: videoUrl }],
        provider: this.provider,
        modelId,
        latencyMs: Date.now() - start,
        costUsd: (input.durationSeconds ?? 5) * 0.35,
      };
    } catch (err: any) {
      throw this.wrapError(err);
    }
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    const start = Date.now();
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      await model.generateContent('ping');
      return { provider: this.provider, healthy: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { provider: this.provider, healthy: false, error: err.message };
    }
  }

  private async pollVideoOperation(operationName: string, timeoutMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await fetch(`${GEMINI_API_BASE}/${operationName}?key=${this.apiKey}`);
      const op = await res.json() as {
        done?: boolean;
        response?: { predictions?: Array<{ video?: { uri?: string } }> };
        error?: { message: string };
      };
      if (op.error) throw new Error(`Veo 3 error: ${op.error.message}`);
      if (op.done) {
        const uri = op.response?.predictions?.[0]?.video?.uri;
        if (!uri) throw new Error('Veo 3 returned no video URI');
        return uri;
      }
      await new Promise((r) => setTimeout(r, 10_000));
    }
    throw new Error('Veo 3 operation timed out');
  }

  private wrapError(err: any): ProviderError {
    const status = err?.status ?? err?.response?.status ?? 500;
    if (status === 401 || status === 403) return new ProviderError(err.message, 'INVALID_API_KEY', this.provider, false);
    if (status === 429) return new ProviderError(err.message, 'PROVIDER_RATE_LIMIT', this.provider, true);
    if (status >= 500) return new ProviderError(err.message, 'PROVIDER_SERVER_ERROR', this.provider, true);
    return new ProviderError(err.message, 'PROVIDER_ERROR', this.provider, false);
  }
}
