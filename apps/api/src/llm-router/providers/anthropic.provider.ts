import Anthropic from '@anthropic-ai/sdk';
import { MessageParam, Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';
import { LlmRequest, LlmResponse, LlmMessage, LlmContentBlock, ModelSpec } from '../llm-router.types';

export class AnthropicProvider {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateText(request: LlmRequest, spec: ModelSpec): Promise<LlmResponse> {
    const start = Date.now();

    const messages: MessageParam[] = request.messages.map((m) => ({
      role: m.role,
      content: this.toAnthropicContent(m),
    }));

    const tools: Tool[] | undefined = request.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: { type: 'object' as const, ...t.inputSchema },
    }));

    const response = await this.client.messages.create({
      model: spec.modelId,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
      system: request.systemPrompt,
      tools: tools?.length ? tools : undefined,
      messages,
    });

    const latencyMs = Date.now() - start;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    const textContent = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('\n');

    const toolCalls = response.content
      .filter((b): b is ToolUseBlock => b.type === 'tool_use')
      .map((b) => ({ id: b.id, name: b.name, input: b.input as Record<string, unknown> }));

    return {
      content: textContent,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      stopReason: response.stop_reason === 'tool_use' ? 'tool_use'
        : response.stop_reason === 'max_tokens' ? 'max_tokens'
        : 'end_turn',
      usage: { inputTokens, outputTokens },
      model: spec.modelId,
      provider: 'anthropic',
      latencyMs,
      costUsd: this.calcCost(spec, inputTokens, outputTokens),
    };
  }

  /** Backward-compat alias */
  async call(request: LlmRequest, spec: ModelSpec): Promise<LlmResponse> {
    return this.generateText(request, spec);
  }

  private toAnthropicContent(msg: LlmMessage): MessageParam['content'] {
    if (typeof msg.content === 'string') return msg.content;
    return (msg.content as LlmContentBlock[]).map((block): any => {
      if (block.type === 'text') return { type: 'text', text: block.text };
      if (block.type === 'tool_use') {
        return { type: 'tool_use', id: block.toolUseId, name: block.toolName, input: block.toolInput };
      }
      if (block.type === 'tool_result') {
        return {
          type: 'tool_result',
          tool_use_id: block.toolUseId,
          content: JSON.stringify(block.toolResult),
          is_error: block.isError ?? false,
        };
      }
      return { type: 'text', text: '' };
    });
  }

  private calcCost(spec: ModelSpec, input: number, output: number): number {
    return (input / 1_000_000) * spec.inputCostPer1M +
           (output / 1_000_000) * spec.outputCostPer1M;
  }
}
