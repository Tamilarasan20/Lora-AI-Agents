import OpenAI from 'openai';
import {
  LlmRequest, LlmResponse, LlmMessage, LlmContentBlock, ModelSpec,
} from '../llm-router.types';

export class OpenAiProvider {
  private client: OpenAI;

  constructor(apiKey: string, baseUrl?: string) {
    this.client = new OpenAI({ apiKey, baseURL: baseUrl });
  }

  async call(request: LlmRequest, spec: ModelSpec): Promise<LlmResponse> {
    const start = Date.now();

    const messages = request.messages.map((m) => this.toOpenAiMessage(m));

    // Prepend system message
    const allMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: request.systemPrompt },
      ...messages,
    ];

    const tools: OpenAI.ChatCompletionTool[] | undefined = request.tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: { type: 'object', ...t.inputSchema },
      },
    }));

    const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model: spec.modelId,
      messages: allMessages,
      max_tokens: request.maxTokens ?? 4096,
      tools: tools?.length ? tools : undefined,
      tool_choice: tools?.length ? 'auto' : undefined,
    };

    // o3-mini and reasoning models don't support temperature
    if (!spec.modelId.startsWith('o')) {
      (params as any).temperature = request.temperature ?? 0.7;
    }

    const response = await this.client.chat.completions.create(params);

    const latencyMs = Date.now() - start;
    const choice = response.choices[0];
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;
    const costUsd = this.calcCost(spec, inputTokens, outputTokens);

    const toolCalls = choice.message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }));

    const stopReason = choice.finish_reason === 'tool_calls'
      ? 'tool_use'
      : choice.finish_reason === 'length'
        ? 'max_tokens'
        : 'end_turn';

    return {
      content: choice.message.content ?? '',
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      stopReason,
      usage: { inputTokens, outputTokens },
      model: spec.modelId,
      provider: spec.provider,
      latencyMs,
      costUsd,
    };
  }

  private toOpenAiMessage(msg: LlmMessage): OpenAI.ChatCompletionMessageParam {
    if (typeof msg.content === 'string') {
      return { role: msg.role, content: msg.content } as OpenAI.ChatCompletionMessageParam;
    }

    // Reconstruct tool calls and results from unified format
    const textBlocks = (msg.content as LlmContentBlock[]).filter((b) => b.type === 'text');
    const toolUseBlocks = (msg.content as LlmContentBlock[]).filter((b) => b.type === 'tool_use');
    const toolResultBlocks = (msg.content as LlmContentBlock[]).filter((b) => b.type === 'tool_result');

    if (toolResultBlocks.length > 0) {
      // OpenAI expects one tool message per result
      return {
        role: 'tool',
        tool_call_id: toolResultBlocks[0].toolUseId!,
        content: JSON.stringify(toolResultBlocks[0].toolResult),
      };
    }

    if (toolUseBlocks.length > 0 && msg.role === 'assistant') {
      return {
        role: 'assistant',
        content: textBlocks[0]?.text ?? null,
        tool_calls: toolUseBlocks.map((b) => ({
          id: b.toolUseId!,
          type: 'function' as const,
          function: {
            name: b.toolName!,
            arguments: JSON.stringify(b.toolInput),
          },
        })),
      };
    }

    return {
      role: msg.role,
      content: textBlocks.map((b) => b.text).join('\n'),
    } as OpenAI.ChatCompletionMessageParam;
  }

  private calcCost(spec: ModelSpec, input: number, output: number): number {
    return (input / 1_000_000) * spec.inputCostPer1M +
           (output / 1_000_000) * spec.outputCostPer1M;
  }
}
